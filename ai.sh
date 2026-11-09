#!/usr/bin/env bash
# CAI: ai.sh [start|run|stop|restart] = photo scan page (count objects + photo location) on :5180
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
PORT="${CAI_PORT:-5180}"
PIDF="$HOME/.cai.pid"
URL="http://127.0.0.1:$PORT/cai-scan.html"
stop_cai() { [ -f "$PIDF" ] && kill "$(cat "$PIDF")" 2>/dev/null; rm -f "$PIDF"; pkill -f "serve.py $PORT" 2>/dev/null; return 0; }
start_cai() {
  if curl -fs -m 2 "$URL" >/dev/null 2>&1; then echo "  ✔ CAI scan       :$PORT (already running)"; return 0; fi
  stop_cai
  command -v python >/dev/null || { echo "  x CAI: python not found"; return 1; }
  ( cd "$ROOT" && exec python "$ROOT/serve.py" "$PORT" >"$HOME/cai.log" 2>&1 ) &
  echo $! > "$PIDF"
  for _ in $(seq 1 15); do
    curl -fs -m 2 "$URL" >/dev/null 2>&1 && { echo "  ✔ CAI scan       :$PORT  (/cai-scan.html)"; return 0; }
    sleep 1
  done
  echo "  ✘ CAI not ready (log: ~/cai.log)"; return 1
}
SPORT="${CAI_SHARE_PORT:-5181}"; SPIDF="$HOME/.cai-share.pid"
stop_share() { [ -f "$SPIDF" ] && kill "$(cat "$SPIDF")" 2>/dev/null; rm -f "$SPIDF"; pkill -f "share-server.mjs $SPORT" 2>/dev/null; return 0; }
start_share() {
  command -v node >/dev/null || { echo "  x CAI share: node not found"; return 1; }
  if curl -fs -m 2 "http://127.0.0.1:$SPORT/health" >/dev/null 2>&1; then echo "  ✔ CAI share      :$SPORT (already running)"; return 0; fi
  stop_share
  ( cd "$ROOT" && exec node "$ROOT/share-server.mjs" "$SPORT" >"$HOME/cai-share.log" 2>&1 ) &
  echo $! > "$SPIDF"
  for _ in $(seq 1 10); do
    curl -fs -m 2 "http://127.0.0.1:$SPORT/health" >/dev/null 2>&1 && { echo "  ✔ CAI share      :$SPORT"; return 0; }
    sleep 1
  done
  echo "  ✘ CAI share not ready (log: ~/cai-share.log)"; return 1
}
case "${1:-run}" in
  start)   start_cai; start_share ;;
  stop)    stop_cai; stop_share; echo "CAI stopped" ;;
  restart) stop_cai; stop_share; start_cai; start_share ;;
  run)     start_cai && { start_share; trap 'stop_cai; stop_share; exit' INT TERM; wait "$(cat "$PIDF")"; } ;;
  sync)    D="${CAI_UI_DIR:-$HOME/ai-project/AI/public/cai}"; mkdir -p "$D" && rm -f "$D/index.html" && cp "$ROOT/cai-scan.html" "$D/" && echo "  ✔ synced → $D" ;;
  tunnel)  command -v cloudflared >/dev/null || { echo "pkg install cloudflared"; exit 1; }; start_share; echo "  → add the https://….trycloudflare.com address to Google Authorized origins, then open it on the other phone"; exec cloudflared tunnel --url "http://127.0.0.1:$SPORT" ;;
  *) echo "usage: $0 [start|run|stop|restart|sync|tunnel]"; exit 1 ;;
esac
