#!/bin/bash
# Build the React app first
echo "Building React app..."
(cd client && npm run build)

# Watch for React changes and rebuild in background
(cd client && npx vite build --watch) &

# Start Express (serves built React + API) on port 5000
cd server && node server.js
