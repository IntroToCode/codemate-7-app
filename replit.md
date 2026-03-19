# MBA App Starter

## Project Overview
A full-stack starter app with a React frontend and Express backend, using PostgreSQL for data storage.

## Architecture
- **Frontend**: React (Vite), runs on port 5000
- **Backend**: Express.js, runs on port 3001
- **Database**: PostgreSQL (Replit built-in), connected via `DATABASE_URL`

## Project Structure
```
client/       - React frontend (Vite)
  src/
    App.jsx   - Main application component
    main.jsx  - Entry point
  vite.config.js - Vite config (proxies /api to backend)
server/       - Express backend
  server.js   - Main server file
  db/
    pool.js   - PostgreSQL connection pool
    SCHEMA_PLACEHOLDER.sql - Example SQL schema
start.sh      - Startup script (runs both server and client)
```

## Running the App
The `Start application` workflow runs `bash start.sh`, which:
1. Starts the Express backend on port 3001
2. Starts the Vite dev server on port 5000

## API Proxy
The Vite dev server proxies `/api/*` requests to `http://localhost:3001`, so the frontend can call `fetch('/api/health')` without CORS issues.

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (set automatically by Replit)
- `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` - Individual DB credentials

## Development Notes
- Frontend: `cd client && npm run dev`
- Backend: `cd server && node server.js`
- The health check at `/api/health` verifies both Express and database connectivity

## Prompting rules
- For every prompt given to the agent, write in PROMPTS.md based on the following format:
```
[Current Date / Current Time]
Prompt: [the prompt used]

Author: [Current Replit User Account Name]
```