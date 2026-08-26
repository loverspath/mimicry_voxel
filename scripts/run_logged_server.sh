#!/data/data/com.termux/files/usr/bin/sh
# Kill any existing server on port 8080
pkill -f "dev_server.py" 2>/dev/null || true
pkill -f "http.server 8080" 2>/dev/null || true
pkill -f "python3.*8080" 2>/dev/null || true
sleep 0.5

DIR="/data/data/com.termux/files/home/opendcmart/mimicry_voxel"
LOG_DIR="$DIR/logs"
LOG_FILE="$DIR/server.log"
ACCESS_LOG="$LOG_DIR/http_access.log"

mkdir -p "$LOG_DIR"

python3 - <<EOF
import os, sys, subprocess, time

if os.fork() > 0:
    sys.exit(0)
os.setsid()
if os.fork() > 0:
    sys.exit(0)

log_path = "$LOG_FILE"
root_dir = "$DIR"
server_script = os.path.join(root_dir, "scripts", "dev_server.py")

with open(log_path, 'a') as f:
    now_str = time.strftime('%Y-%m-%d %H:%M:%S')
    f.write(f"[{now_str}] Starting Mimicry No-Cache Dev Server on port 8080 (root: {root_dir})\n")
    f.flush()
    proc = subprocess.Popen(
        [sys.executable, '-u', server_script, '--port', '8080', '--dir', root_dir],
        stdout=f,
        stderr=f,
        stdin=subprocess.DEVNULL,
        start_new_session=True
    )
EOF

sleep 0.5
echo "Mimicry Dev Server started in background daemon mode."
echo "Log file: $LOG_FILE"
