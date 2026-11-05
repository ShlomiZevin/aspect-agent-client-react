// A throwaway stand: real routes and services on a local Postgres. Nothing here reaches a real DB.
const path = require('path');
const fs = require('fs');
const Module = require('module');
const EmbeddedPostgres = require('embedded-postgres').default;

const SERVER = 'G:/Shlomi/freeda2/aspect-agent-server';
const req = Module.createRequire(path.join(SERVER, 'server.js'));
const DATA = path.join(__dirname, 'data');
const PORT = 55433;

Object.assign(process.env, {
  DB_HOST: '127.0.0.1', DB_PORT: String(PORT), DB_NAME: 'agents_platform_db',
  DB_USER: 'agent_admin', DB_PASSWORD: 'test', DB_SSL: 'false', DB_POOL_MIN: '1',
});
req('dotenv').config({ path: path.join(SERVER, '.env'), quiet: true });

(async () => {
  fs.rmSync(DATA, { recursive: true, force: true });
  const pg = new EmbeddedPostgres({ databaseDir: DATA, user: 'agent_admin', password: 'test', port: PORT, persistent: false, initdbFlags: ['--encoding=UTF8', '--locale=C'] });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('agents_platform_db');

  const db = req('./services/db.pg');
  await db.initialize();
  await db.query(fs.readFileSync(path.join(SERVER, 'db/migrations/066_aspect_management.sql'), 'utf8'));
  await db.query(fs.readFileSync(path.join(SERVER, 'db/migrations/066_aspect_management.sql'), 'utf8')); // re-run must be safe
  await db.query(`CREATE TABLE allowed_emails (
    id SERIAL PRIMARY KEY, email VARCHAR(255) NOT NULL, tenants TEXT[], role VARCHAR(20) NOT NULL DEFAULT 'user',
    invited_by VARCHAR(255), note TEXT, revoked_at TIMESTAMPTZ, password_hash TEXT, password_set_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  await db.query(`INSERT INTO allowed_emails (email, tenants, role) VALUES ('admin@aspect.test', NULL, 'admin'), ('stranger@aspect.test', ARRAY['aspect'], 'user')`);

  const express = req('express');
  const cors = req('cors');
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api/management', req('./aspect-management/routes/management.routes'));
  app.listen(3000, () => console.log('STAND READY on 3000'));
})().catch(err => { console.error(err); process.exit(1); });
