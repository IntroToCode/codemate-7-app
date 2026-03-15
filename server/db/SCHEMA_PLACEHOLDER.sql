-- ⚠️  DO NOT BUILD ON THIS TABLE ⚠️
-- ─────────────────────────────────────────────────────────────────────────────
-- This file exists only to show you the SQL syntax for creating a table.
-- It is NOT the schema for your app.
--
-- YOUR JOB:
--   1. Look at your app's suggested schema in the assignment doc.
--   2. Write your own CREATE TABLE statements below (or in a new file).
--   3. Delete or ignore this example_items table entirely.
--   4. Document your schema decisions in GitHub Issue #2 BEFORE writing
--      any code that touches the database.
-- ─────────────────────────────────────────────────────────────────────────────

-- EXAMPLE ONLY — replace this with your real schema
CREATE TABLE IF NOT EXISTS example_items (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- HOW TO RUN YOUR SCHEMA:
--
-- Option 1 (Replit): Open the Database tab, click "Query", paste your
--   CREATE TABLE statements and run them.
--
-- Option 2 (psql locally):
--   psql $DATABASE_URL -f db/your-schema.sql
--
-- Run CREATE TABLE IF NOT EXISTS so re-running the file doesn't error out
-- when the tables already exist.
-- ─────────────────────────────────────────────────────────────────────────────
