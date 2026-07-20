"""allauth throttles verification-email resends (`confirm_email`, 1 per 3
minutes per address) through Django's cache framework. That throttle only
holds under gunicorn's multiple workers if the cache is actually shared
across OS processes — see ADR-0009.

LocMemCache's backing store is a module-level dict
(django.core.cache.backends.locmem._caches), private to one Python process.
A single test process can't tell that apart from a real shared cache by
juggling several LocMemCache objects in-process: a fresh instance with the
same LOCATION still reads the same process-global dict. So this test crosses
a real process boundary with multiprocessing, forking a worker with its own
DB connection, to prove a value set by one process is visible from another —
which only holds for a cache actually backed by Postgres.
"""
import multiprocessing

from django.core.cache import cache
from django.db import connections
from django.test import TransactionTestCase

KEY = "cross-process-probe"
VALUE = "set-by-worker-a"


def _read_once_signalled(ready, queue):
    ready.wait(timeout=10)
    queue.put(cache.get(KEY))


class DatabaseCacheSharedAcrossWorkersTests(TransactionTestCase):
    def test_a_value_set_by_one_worker_is_visible_to_another(self):
        # Close the inherited DB connection before forking: sharing one open
        # socket across a fork() corrupts both ends. The child reconnects
        # lazily on its first query.
        connections.close_all()

        ctx = multiprocessing.get_context("fork")
        ready = ctx.Event()
        queue = ctx.Queue()
        worker = ctx.Process(target=_read_once_signalled, args=(ready, queue))
        # Fork the worker *before* the value exists, so it can't simply inherit
        # the answer through copy-on-write memory the way it would if a
        # LocMemCache dict already held the key at fork time — this mirrors
        # gunicorn forking workers once at startup, long before any particular
        # request arrives.
        worker.start()

        cache.set(KEY, VALUE, timeout=180)
        ready.set()

        try:
            seen_by_worker_b = queue.get(timeout=10)
        finally:
            worker.join(timeout=10)

        self.assertEqual(seen_by_worker_b, VALUE)
