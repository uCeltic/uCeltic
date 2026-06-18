"""Contract test for docker-compose.prod.yml (issue #38).

The prod overlay must switch the VPS from on-box builds to pulling the blessed
registry images. The footgun this locks: the *service* is `web` but its image
is `client` (backend's service and image share a name). A swap here means the
VPS pulls the wrong image, so assert each service pins the right `:prod` tag.

Parsed without PyYAML on purpose: the CI `smoke-script` job runs a bare
`python -m unittest` with no pip install, so the test must stay dependency-free.
"""
import unittest
from pathlib import Path

COMPOSE = Path(__file__).resolve().parents[1] / "docker-compose.prod.yml"


def _service_images(path):
    """Map service name -> image string, from a 2-space-indented compose file.

    A service header is `  <name>:` (2 spaces); its keys are indented further.
    Good enough for this small, hand-maintained overlay; not a general parser.
    """
    images = {}
    current = None
    for line in path.read_text().splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        indent = len(line) - len(line.lstrip(" "))
        if indent == 2 and line.rstrip().endswith(":"):
            current = line.strip().rstrip(":")
        elif indent >= 4 and current and line.strip().startswith("image:"):
            images[current] = line.split("image:", 1)[1].strip()
    return images


class ComposeProdContractTests(unittest.TestCase):
    def setUp(self):
        self.assertTrue(COMPOSE.exists(), f"{COMPOSE} is missing")
        self.images = _service_images(COMPOSE)

    def test_backend_pins_prod_image(self):
        self.assertEqual(
            self.images.get("backend"),
            "ghcr.io/uceltic/uceltic/backend:prod",
        )

    def test_web_pins_client_prod_image(self):
        # service is `web`, image is `client` -- the swap this test guards.
        self.assertEqual(
            self.images.get("web"),
            "ghcr.io/uceltic/uceltic/client:prod",
        )


if __name__ == "__main__":
    unittest.main()