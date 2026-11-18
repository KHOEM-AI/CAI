import os
import sys
import urllib.error
import urllib.request
import http.server as h

KI = "http://127.0.0.1:5001"
ALLOWED = {("GET", "/api/healthz"), ("GET", "/api/scans"), ("POST", "/api/scans"), ("POST", "/api/scan")}
MAX_BODY = 8 * 1024 * 1024


def ki_token():
    try:
        with open(os.path.expanduser("~/KI/.env"), encoding="utf8") as f:
            for line in f:
                if line.startswith("KI_API_TOKEN="):
                    return line.split("=", 1)[1].strip()
    except OSError:
        pass
    return ""


class H(h.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def reply(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def ki_proxy(self):
        sub = self.path.split("?")[0][3:].rstrip("/")
        if (self.command, sub) not in ALLOWED:
            return self.reply(403, b'{"error":"KI route not allowed"}')
        try:
            n = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            n = 0
        if n > MAX_BODY:
            return self.reply(413, b'{"error":"too large"}')
        body = self.rfile.read(n) if n else None
        req = urllib.request.Request(KI + sub, data=body, method=self.command)
        if body is not None:
            req.add_header("Content-Type", "application/json")
        t = ki_token()
        if t:
            req.add_header("x-ki-token", t)
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                code, data = r.status, r.read()
        except urllib.error.HTTPError as e:
            code, data = e.code, e.read()
        except Exception:
            code, data = 502, b'{"error":"KI unreachable"}'
        self.reply(code, data)

    def do_GET(self):
        if self.path.startswith("/ki/"):
            return self.ki_proxy()
        super().do_GET()

    def do_POST(self):
        if self.path.startswith("/ki/"):
            return self.ki_proxy()
        self.reply(405, b'{"error":"method not allowed"}')


h.ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1])), H).serve_forever()
