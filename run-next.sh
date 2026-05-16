#!/bin/bash
cd /home/z/my-project
while true; do
  NODE_ENV=production PORT=3000 node .next/standalone/server.js 2>&1
  echo "[$(date)] Server exited, restarting in 2s..."
  sleep 2
done
