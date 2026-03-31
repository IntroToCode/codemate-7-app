const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Client } = require('pg');

const runId = process.argv[3];
if (!runId) {
  console.error('Usage: node server/scripts/seedRecentFilterScenario.js <seed|cleanup> <runId>');
  process.exit(1);
}

const command = process.argv[2];
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const firstName = `E2E${runId}`;
const lastName = 'Filter';
const userName = `${firstName} ${lastName}`;
const seederName = `Seeder ${runId}`;
const password = 'pw1234';
const restaurantNames = {
  italianRecentA: `${runId} Italian Recent A`,
  italianRecentB: `${runId} Italian Recent B`,
  italianPremium: `${runId} Italian Premium`,
  mexicanBudget: `${runId} Mexican Budget`,
};

async function cleanup() {
  await client.query('DELETE FROM spins WHERE spun_by = $1 OR spun_by = $2', [userName, seederName]);
  await client.query('DELETE FROM ratings WHERE rated_by = $1', [userName]);
  await client.query(
    `DELETE FROM restaurants
     WHERE name = ANY($1::text[])
        OR created_by = $2`,
    [Object.values(restaurantNames), userName]
  );
  await client.query(
    `DELETE FROM user_profiles
     WHERE CONCAT(first_name, ' ', last_name) IN ($1, $2)`,
    [userName, seederName]
  );
}

async function seed() {
  await cleanup();

  await client.query(
    `INSERT INTO user_profiles (first_name, last_name, password)
     VALUES ($1, $2, $3)`,
    [firstName, lastName, password]
  );

  await client.query(
    `INSERT INTO user_profiles (first_name, last_name, password)
     VALUES ('Seeder', $1, 'pw1234')`,
    [runId]
  );

  const restaurants = [
    [restaurantNames.italianRecentA, 'Italian', 2, `${runId} Main St`, userName],
    [restaurantNames.italianRecentB, 'Italian', 2, `${runId} Side St`, userName],
    [restaurantNames.italianPremium, 'Italian', 3, `${runId} Premium Ave`, userName],
    [restaurantNames.mexicanBudget, 'Mexican', 1, `${runId} Budget Rd`, userName],
  ];

  const inserted = [];
  for (const row of restaurants) {
    const { rows } = await client.query(
      `INSERT INTO restaurants (name, cuisine, price_range, address, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name`,
      row
    );
    inserted.push(rows[0]);
  }

  const byName = Object.fromEntries(inserted.map((row) => [row.name, row.id]));
  await client.query(
    `INSERT INTO spins (restaurant_id, spun_by, created_at)
     VALUES ($1, $2, NOW() - INTERVAL '1 day'),
            ($3, $2, NOW() - INTERVAL '2 days')`,
    [byName[restaurantNames.italianRecentA], seederName, byName[restaurantNames.italianRecentB]]
  );

  console.log(JSON.stringify({ userName, password, restaurantNames }));
}

async function main() {
  await client.connect();
  try {
    if (command === 'seed') await seed();
    else if (command === 'cleanup') await cleanup();
    else throw new Error(`Unknown command: ${command}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});