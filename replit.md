# Lunch Roulette

## Project Overview
A full-stack team lunch-picker app. Teams spin a wheel to randomly select a restaurant from a curated list. Features include spin history, vetoing results, ratings, tags, an admin dashboard, and a public spin log. No authentication — users enter a name on first visit (stored in localStorage).

## Architecture
- **Frontend**: React 18 + React Router (Vite build), runs on port 5000
- **Backend**: Express.js, runs on port 3001 and 5000
- **Database**: PostgreSQL (Replit built-in), connected via `DATABASE_URL`
- **Testing**: Jest + Supertest (server: 27 tests, client: 45 tests)

## Project Structure
```
client/
  src/
    App.jsx              - Root component; handles name entry gate + routing
    index.css            - Global styles (orange/yellow/teal theme)
    context/
      UserContext.jsx    - localStorage-backed user name context
    components/
      NameEntry.jsx      - Full-screen name entry on first visit
      Layout.jsx         - App shell (header, nav, sidebar)
      RecentHits.jsx     - Sidebar: last 5 non-vetoed spins
      StarRating.jsx     - Interactive/read-only star rating component
      RouletteWheel.jsx  - Casino SVG roulette wheel with spinning base + ball animation + Web Audio sounds
      rouletteUtils.jsx  - Shared utility functions (segment paths, clamp, shuffle, stop angle math)
    pages/
      SpinPage.jsx       - Casino roulette wheel with animated ball + veto
      RestaurantList.jsx - Add/edit/delete restaurants, tags, ratings
      AdminDashboard.jsx - Table-based availability toggler
      SpinLog.jsx        - Full spin history log
  vite.config.js         - Vite config (proxies /api to backend port 3001)

server/
  server.js              - Express entry point; mounts routes; runs migration on start
  db/
    pool.js              - PostgreSQL connection pool
    schema.sql           - Real schema (restaurants, spins, tags, ratings)
    migrate.js           - Runs schema.sql on server startup
  lib/
    spinAlgorithm.js     - Pure spin selection fn (last-5 exclusion, fallback)
    autofill.js          - Mock restaurant autofill fixture
    ratingAvg.js         - Pure average rating calculation
  routes/
    restaurants.js       - CRUD + autofill + toggle routes
    spins.js             - Spin creation + veto + history routes
    tags.js              - Tag add/delete routes
    ratings.js           - Rating upsert route
  __tests__/
    health.test.js       - Health endpoint tests
    spinAlgorithm.test.js - Unit tests for spin selection logic
    autofill.test.js     - Unit tests for autofill lookup
    ratingAvg.test.js    - Unit tests for rating average calculation
    api.test.js          - Integration tests for all REST endpoints

client/
  src/__tests__/
    rouletteUtils.test.js   - Unit tests for wheel utility functions (33 tests)
    RouletteWheel.test.jsx  - Component rendering tests (12 tests)
  jest.config.cjs           - Jest config for client (jsdom environment)
  babel.config.cjs          - Babel config for Jest transforms

start.sh                 - Startup: builds React, starts Express, watches for changes
```

## Data Schema
- **restaurants**: id (UUID), name, cuisine, price_range (1-4), address, added_by, active, created_at
- **spins**: id (UUID), restaurant_id (FK), spun_by, is_vetoed, created_at
- **tags**: id (UUID), restaurant_id (FK), label, created_at (unique per restaurant+label)
- **ratings**: id (UUID), restaurant_id (FK), rated_by, score (1-5), created_at (unique per restaurant+user)

## API Routes
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/health | DB health check |
| GET | /api/restaurants | List all with tags + avg rating |
| POST | /api/restaurants | Create restaurant |
| PUT | /api/restaurants/:id | Update restaurant |
| PATCH | /api/restaurants/:id/toggle | Toggle active status |
| DELETE | /api/restaurants/:id | Delete restaurant |
| GET | /api/restaurants/autofill?name= | Mock autofill by name |
| GET | /api/spins | Spin history |
| POST | /api/spins | Spin (with exclusion logic) |
| POST | /api/spins/:id/veto | Veto + re-spin |
| POST | /api/tags | Add tag to restaurant |
| DELETE | /api/tags/:id | Remove tag |
| POST | /api/ratings | Upsert user rating (1-5) |

## Running Tests
```bash
cd server && npm test    # 27 server-side tests
cd client && npm test    # 45 client-side tests
```

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (set automatically by Replit)
- `NODE_ENV` - Set to "production" for SSL mode on DB

## Key Design Decisions
- **Identity**: Username stored in localStorage, matched against `added_by`/`created_by` fields. No passwords.
- **Spin algorithm**: Excludes restaurants from last 5 non-vetoed spins (toggle-able). Falls back to full active list if all eligible are excluded.
- **Temporary disable**: Client-side only (stored in React state). Resets on refresh by design.
- **Mock autofill**: Local fixture of 15 restaurants; fuzzy/partial name match.
- **Ratings**: Upsert pattern — one rating per user per restaurant, updates in place.

## Prompting rules
- For every prompt given to the agent, write in PROMPTS.md based on the following format:
```
[Current Date / Current Time]
Prompt: [the prompt used]

Author: [Current Replit User Account Name. If not provided, ask during sesion]
```