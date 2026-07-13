"""Behavioural tests for scripts/smoke.sh.

smoke.sh gates every deploy: in CI it runs against the assembled stack, and on
the VPS the identical script runs with CURL_OPTS="-k -u ...". These tests drive
it against a stub HTTP server so we can assert pass/fail behaviour locally,
without docker.
"""
import http.server
import os
import socket
import subprocess
import threading
import time
import unittest
from pathlib import Path
import ssl
import tempfile

SMOKE = str(Path(__file__).resolve().parent / "smoke.sh")

#create a handler for the routes
def _make_handler(routes):
    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            status, body = routes.get(self.path, (404, b"not found"))
            self.send_response(status)
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *args):
            pass  # keep test output quiet

    return Handler

#find a free port
def _free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port

def _make_self_signed_cert(dirpath):
      cert = os.path.join(dirpath, "cert.pem")
      key = os.path.join(dirpath, "key.pem")
      subprocess.run(
          ["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes",
           "-keyout", key, "-out", cert, "-days", "1", "-subj", "/CN=localhost"],
          check=True, capture_output=True,
      )
      return cert, key

#run the smoke script against the routes
def run_smoke(routes, env=None):
    """Serve `routes` on a throwaway port, run smoke.sh against it, return the result."""
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), _make_handler(routes))
    port = server.server_address[1]
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        return subprocess.run(
            ["sh", SMOKE, f"http://127.0.0.1:{port}"],
            capture_output=True, text=True, timeout=30,
            env={**os.environ, "SMOKE_RETRIES": "3", "SMOKE_DELAY": "0", **(env or {})},
        )
    finally:
        server.shutdown()
        server.server_close()


HEALTHY = {
    "/api/tei/": (200, b"[]"),
    "/": (200, b'<!doctype html><html><body><div id="root"></div></body></html>'),
}


class SmokeScriptTests(unittest.TestCase):
    def test_passes_against_healthy_stack(self):
        result = run_smoke(HEALTHY)
        self.assertEqual(result.returncode, 0, msg=f"stderr={result.stderr}")
        self.assertIn("smoke OK", result.stdout)

    def test_fails_clearly_when_tei_not_200(self):
        routes = {**HEALTHY, "/api/tei/": (500, b"boom")}
        result = run_smoke(routes)
        self.assertNotEqual(result.returncode, 0)
        output = result.stdout + result.stderr
        self.assertIn("/api/tei/", output)   # which endpoint failed
        self.assertIn("500", output)         # what it returned



    def test_fails_clearly_when_root_html_missing_marker(self):
        routes = {**HEALTHY, "/": (200, b"<html><body>no marker here</body></html>")}
        result = run_smoke(routes)
        self.assertNotEqual(result.returncode, 0)
        output = result.stdout + result.stderr
        self.assertIn("root", output)   # error points to missing id="root" 
    
    def test_retries_until_stack_is_up(self):
        # Mimic a cold start: nothing listens yet (curl gets connection refused),
        # then the stack comes up mid-run. smoke.sh must keep retrying, not bail.
        port = _free_port()
        servers = []

        def start_later():
            time.sleep(1.0)
            srv = http.server.ThreadingHTTPServer(("127.0.0.1", port), _make_handler(HEALTHY))
            servers.append(srv)
            threading.Thread(target=srv.serve_forever, daemon=True).start()

        threading.Thread(target=start_later, daemon=True).start()
        try:
            result = subprocess.run(
                ["sh", SMOKE, f"http://127.0.0.1:{port}"],
                capture_output=True, text=True, timeout=30,
                env={**os.environ, "SMOKE_RETRIES": "30", "SMOKE_DELAY": "0.2"},
            )
        finally:
            for srv in servers:
                srv.shutdown()
                srv.server_close()
        self.assertEqual(result.returncode, 0, msg=f"stdout={result.stdout} stderr={result.stderr}")
        self.assertIn("smoke OK", result.stdout)

    def test_gives_up_on_a_black_hole_instead_of_hanging(self):
        # A dropped port (cloud firewall, wedged proxy) is not a refused one: the
        # TCP connect completes but nothing ever answers. curl has no total
        # timeout by default, so each attempt blocks indefinitely and the whole
        # retry budget stops meaning anything -- on the VPS this wedged the
        # deploy unit, and with it the CD timer, for the better part of an hour.
        server = socket.socket()
        server.bind(("127.0.0.1", 0))
        server.listen(5)  # accept the connection, then never respond
        port = server.getsockname()[1]
        try:
            result = subprocess.run(
                ["sh", SMOKE, f"http://127.0.0.1:{port}"],
                capture_output=True, text=True, timeout=20,
                env={**os.environ, "SMOKE_RETRIES": "2", "SMOKE_DELAY": "0",
                     "SMOKE_MAX_TIME": "1"},
            )
        finally:
            server.close()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("/api/tei/", result.stdout + result.stderr)

    def test_honours_curl_opts_for_self_signed_tls(self):
        # The VPS serves self-signed HTTPS and sets CURL_OPTS="-k -u ...". Prove
        # smoke.sh threads CURL_OPTS into curl: same stack, -k flips fail -> pass.
        with tempfile.TemporaryDirectory() as d:
            cert, key = _make_self_signed_cert(d)
            server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), _make_handler(HEALTHY))
            ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            ctx.load_cert_chain(cert, key)
            server.socket = ctx.wrap_socket(server.socket, server_side=True)
            base = f"https://127.0.0.1:{server.server_address[1]}"
            threading.Thread(target=server.serve_forever, daemon=True).start()
            fast = {"SMOKE_RETRIES": "2", "SMOKE_DELAY": "0"}
            try:
                without = subprocess.run(
                    ["sh", SMOKE, base], capture_output=True, text=True, timeout=30,
                    env={**os.environ, **fast},
                )
                with_k = subprocess.run(
                    ["sh", SMOKE, base], capture_output=True, text=True, timeout=30,
                    env={**os.environ, **fast, "CURL_OPTS": "-k"},
                )
            finally:
                server.shutdown()
                server.server_close()
        self.assertNotEqual(without.returncode, 0, msg="self-signed TLS should fail without -k")
        self.assertEqual(with_k.returncode, 0, msg=f"stderr={with_k.stderr}")
        self.assertIn("smoke OK", with_k.stdout)

if __name__ == "__main__":
    unittest.main()