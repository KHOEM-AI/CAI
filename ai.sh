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
    curl -fs -m 2 "$URL" >/dev/null 2>&1 && { echo "  ✔ CAI scan       :$PORT"; return 0; }
    sleep 1
  done
  echo "  ✘ CAI not ready (log: ~/cai.log)"; return 1
}
case "${1:-run}" in
  start)   start_cai ;;
  stop)    stop_cai; echo "CAI stopped" ;;
  restart) stop_cai; start_cai ;;
  run)     start_cai && { trap 'stop_cai; exit' INT TERM; wait "$(cat "$PIDF")"; } ;;
  *) echo "usage: $0 [start|run|stop|restart]"; exit 1 ;;
esac
