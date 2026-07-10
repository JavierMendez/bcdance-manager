import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { admin } from 'better-auth/plugins';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import { createPostgresClient } from './lib/postgres-client.mjs';
import { authSchema } from './auth-schema.mjs';

const databaseUrl = process.env.DATABASE_URL;
const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
const adminName = process.env.ADMIN_NAME ?? 'Administrador';
const authSecret = process.env.BETTER_AUTH_SECRET;
const authUrl = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000';

if (!databaseUrl) {
	console.error('DATABASE_URL is not set');
	process.exit(1);
}

if (!adminEmail || !adminPassword) {
	console.error('ADMIN_EMAIL and ADMIN_PASSWORD must be set to seed the initial admin user');
	process.exit(1);
}

if (!authSecret) {
	console.error('BETTER_AUTH_SECRET is not set');
	process.exit(1);
}

const client = createPostgresClient(databaseUrl, { max: 1 });
const db = drizzle(client, { schema: authSchema });

const existingAdmin = await db.execute(
	sql`SELECT id FROM "user" WHERE role = 'admin' LIMIT 1`
);

if (existingAdmin.length > 0) {
	console.log('Admin user already exists, skipping seed.');
	await client.end();
	process.exit(0);
}

const auth = betterAuth({
	secret: authSecret,
	baseURL: authUrl,
	database: drizzleAdapter(db, { provider: 'pg', schema: authSchema }),
	emailAndPassword: {
		enabled: true,
		disableSignUp: false
	},
	plugins: [admin({ defaultRole: 'user' })]
});

try {
	await auth.api.signUpEmail({
		body: {
			name: adminName,
			email: adminEmail,
			password: adminPassword
		}
	});
} catch (error) {
	const message = error instanceof Error ? error.message : String(error);
	if (!message.toLowerCase().includes('already exists')) {
		console.error('Failed to create admin user:', message);
		await client.end();
		process.exit(1);
	}
}

await db.execute(sql`UPDATE "user" SET role = 'admin' WHERE email = ${adminEmail}`);

console.log(`Admin user seeded: ${adminEmail}`);
await client.end();
