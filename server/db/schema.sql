CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS restaurants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  cuisine     VARCHAR(100),
  price_range SMALLINT CHECK (price_range BETWEEN 1 AND 4),
  address     TEXT,
  created_by  VARCHAR(100) NOT NULL,
  google_place_id VARCHAR(255),
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS spins (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  UUID REFERENCES restaurants(id) ON DELETE SET NULL,
  spun_by        VARCHAR(100) NOT NULL,
  is_vetoed      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tags (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  label          VARCHAR(100) NOT NULL,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(restaurant_id, label)
);

CREATE TABLE IF NOT EXISTS ratings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  rated_by       VARCHAR(100) NOT NULL,
  score          SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(restaurant_id, rated_by)
);

CREATE TABLE IF NOT EXISTS app_settings (
  key   VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admins (
  username    VARCHAR(100) PRIMARY KEY,
  promoted_by VARCHAR(100) NOT NULL,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
