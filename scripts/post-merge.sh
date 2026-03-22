#!/bin/bash
set -e

cd "$(dirname "$0")/.."

npm install --no-fund --no-audit
cd server && npm install --no-fund --no-audit
cd ../client && npm install --no-fund --no-audit
cd ..

cd server && node -e "require('./db/migrate')()" 
