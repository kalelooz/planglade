#!/bin/bash
# FlowBoard server with keep-alive
cd /home/z/my-project

while true; do
  NODE_OPTIONS="--max-old-space-size=256" NODE_ENV=production node .next/standalone/server.js &
  PID=$!
  echo "[$(date)] Server started PID=$PID"
  
  # Keep-alive loop
  while kill -0 $PID 2>/dev/null; do
    sleep 3
    curl -s -o /dev/null -m 5 http://localhost:3000/ 2>/dev/null || true
  done
  
  echo "[$(date)] Server died, restarting in 2s..."
  sleep 2
done
