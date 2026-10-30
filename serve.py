import sys
import http.server as h

class H(h.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

h.ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1])), H).serve_forever()
