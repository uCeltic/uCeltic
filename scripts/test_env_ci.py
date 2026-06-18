"""Contract test for .env.ci (issue #37, AC7).

.env.ci holds throwaway, committable values that let the CI release job boot a
disposable stack for smoke. The real "does it boot" proof is the CI smoke job;
this locks the invariants settings.py enforces under DEBUG=False, so a broken
.env.ci fails in a PR rather than mid-deploy.
"""
import unittest
from pathlib import Path

ENV_CI = Path(__file__).resolve().parents[1] / ".env.ci"


def _parse(path):
    values = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        key, _, val = line.partition("=")
        values[key.strip()] = val.strip()
    return values


class EnvCiContractTests(unittest.TestCase):
    def setUp(self):
        self.assertTrue(ENV_CI.exists(), f"{ENV_CI} is missing")
        self.env = _parse(ENV_CI)

    def test_debug_is_off(self):
        self.assertEqual(self.env.get("DEBUG"), "False")

    def test_allowed_hosts_cover_localhost(self):
        hosts = self.env.get("ALLOWED_HOSTS", "")
        self.assertIn("localhost", hosts)
        self.assertIn("127.0.0.1", hosts)

    def test_django_boot_secrets_present(self):
        # settings.py raises under DEBUG=False unless SECRET_KEY (non-default)
        # and DB_PASSWORD are set; lock that these are non-empty.
        for key in ("SECRET_KEY", "DB_NAME", "DB_USER", "DB_PASSWORD"):
            self.assertTrue(self.env.get(key), f"{key} must be set in .env.ci")


if __name__ == "__main__":
    unittest.main()