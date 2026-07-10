import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createPostgresClient } from './lib/postgres-client.mjs';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
	console.error('DATABASE_URL is not set');
	process.exit(1);
}

const client = createPostgresClient(databaseUrl, { max: 1 });
const db = drizzle(client);

await migrate(db, { migrationsFolder: 'drizzle' });
await client.end();

console.log('Database migrations completed');
