#!/bin/bash
set -e
cd client
npm install
npm run build
cd ../server
npm install
