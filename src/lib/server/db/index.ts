import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { env } from '$env/dynamic/private';
import { createPostgresClient } from './postgres-client.js';
import * as schema from './schema/index.js';

let database: PostgresJsDatabase<typeof schema>;

export function getDb() {
	if (!env.DATABASE_URL) {
		throw new Error('DATABASE_URL is not set');
	}

	if (!database) {
		const client = createPostgresClient(env.DATABASE_URL);
		database = drizzle(client, { schema });
	}

	return database;
}
