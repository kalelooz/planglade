#!/bin/bash
# Start FlowBoard production server with auto-restart
cd /home/z/my-project

while true; do
  echo "[$(date)] Starting FlowBoard server..."
  NODE_ENV=production node .next/standalone/server.js 2>&1
  EXIT_CODE=$?
  echo "[$(date)] Server exited with code $EXIT_CODE, restarting in 3s..."
  sleep 3
done
