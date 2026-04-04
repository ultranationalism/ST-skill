#!/bin/bash
# Wrapper: start Chrome in headless port mode, then launch chrome-devtools-mcp connected to it.
# This works around the --remote-debugging-pipe failure in WSL2/root environments.

PORT=9222

# Kill any existing Chrome on this port
pkill -f "remote-debugging-port=$PORT" 2>/dev/null
sleep 0.5

# Start Chrome headless with port-based debugging
google-chrome \
  --headless \
  --no-sandbox \
  --disable-setuid-sandbox \
  --disable-gpu \
  --remote-debugging-port=$PORT \
  --no-first-run \
  --incognito \
  about:blank &>/dev/null &

# Wait for Chrome to be ready
for i in $(seq 1 10); do
  curl -s "http://127.0.0.1:$PORT/json/version" &>/dev/null && break
  sleep 0.5
done

# Launch MCP server, connecting to the running Chrome
exec npx -y chrome-devtools-mcp@latest --browser-url "http://127.0.0.1:$PORT" "$@"
