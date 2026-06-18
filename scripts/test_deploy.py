"""Behavioural test for deploy.sh's post-deploy smoke gate (issue #38).

deploy.sh pulls the blessed :prod images, recreates the stack, then smoke-tests
the live box. The contract that matters: a failed post-deploy smoke must fail
the deploy (non-zero exit, logged) so the systemd timer surfaces it in journald.

docker is stubbed (no daemon on the test box) and smoke is pointed at a local
stub server, mirroring scripts/test_smoke.py.
"""
import http.server
import os
import stat
import subprocess
import tempfile
import threading
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
DEPLOY = str(REPO / "deploy.sh")


def _make_handler(routes):
    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            status, body = routes.get(self.path, (404, b"not found"))
            self.send_response(status)
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *args):
            pass

    return Handler


HEALTHY = {
    "/api/tei/": (200, b"[]"),
    "/": (200, b'<!doctype html><html><body><div id="root"></div></body></html>'),
}


def run_deploy(routes, extra_env=None):
    """Serve `routes`, run deploy.sh with docker stubbed, return the result."""
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), _make_handler(routes))
    port = server.server_address[1]
    threading.Thread(target=server.serve_forever, daemon=True).start()

    # Stub `docker` so `docker compose pull/up` are no-ops without a daemon.
    bindir = tempfile.mkdtemp()
    docker = os.path.join(bindir, "docker")
    with open(docker, "w") as f:
        f.write("#!/bin/sh\nexit 0\n")
    os.chmod(docker, os.stat(docker).st_mode | stat.S_IEXEC)

    env = {
        **os.environ,
        "PATH": bindir + os.pathsep + os.environ["PATH"],
        "APP_DIR": str(REPO),
        "SMOKE_URL": f"http://127.0.0.1:{port}",
        "SMOKE_RETRIES": "3",
        "SMOKE_DELAY": "0",
        **(extra_env or {}),
    }
    try:
        return subprocess.run(
            ["sh", DEPLOY], capture_output=True, text=True, timeout=30, env=env,
        )
    finally:
        server.shutdown()
        server.server_close()


class DeployScriptTests(unittest.TestCase):
    def test_succeeds_when_post_deploy_smoke_passes(self):
        result = run_deploy(HEALTHY)
        self.assertEqual(result.returncode, 0, msg=f"stderr={result.stderr}")

    def test_fails_and_logs_when_post_deploy_smoke_fails(self):
        routes = {**HEALTHY, "/api/tei/": (500, b"boom")}
        result = run_deploy(routes)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("smoke", (result.stdout + result.stderr).lower())


if __name__ == "__main__":
    unittest.main()