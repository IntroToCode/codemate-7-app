#!/bin/bash
# Start Express immediately so the port is open right away
cd server && node server.js &
SERVER_PID=$!

# Build the React app (server will serve updated files once done)
echo "Building React app..."
(cd client && npm run build)

# Watch for React changes and rebuild in background
(cd client && npx vite build --watch) &

# Wait for the server process
wait $SERVER_PID
