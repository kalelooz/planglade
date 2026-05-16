#!/bin/bash
# FlowBoard Server Manager - keeps the Next.js server alive
cd /home/z/my-project

echo "[$(date)] Starting FlowBoard production server..."

# Start the server
NODE_ENV=production node .next/standalone/server.js &
SERVER_PID=$!
echo "[$(date)] Server started with PID $SERVER_PID"

# Keep-alive loop
while true; do
  sleep 5
  if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo "[$(date)] Server died, restarting..."
    NODE_ENV=production node .next/standalone/server.js &
    SERVER_PID=$!
    echo "[$(date)] Server restarted with PID $SERVER_PID"
    sleep 3
  fi
  # Send a lightweight keep-alive request
  curl -s -o /dev/null -m 5 http://localhost:3000/favicon.ico 2>/dev/null || true
done
