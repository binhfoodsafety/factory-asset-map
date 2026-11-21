"""Minimal local web server for Factory Asset Map (no caching, so edits show immediately).

Usage (from the project folder):
    python tools/serve.py            # http://127.0.0.1:8765
    python tools/serve.py 9000       # custom port
"""
import http.server
import os
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", PORT), NoCacheHandler) as httpd:
    print(f"Factory Asset Map running at http://127.0.0.1:{PORT}/  (Ctrl+C to stop)")
    httpd.serve_forever()
