import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

if (!process.env.DATABASE_URL) {
	throw new Error('DATABASE_URL is not set');
}

const databaseUrl = process.env.DATABASE_URL;
const needsSsl =
	databaseUrl.includes('supabase.co') ||
	databaseUrl.includes('sslmode=require') ||
	databaseUrl.includes('ssl=true');

// drizzle-kit ignores dbCredentials.ssl when only `url` is set; embed sslmode instead.
const migrateUrl =
	needsSsl && !/[?&]sslmode=/.test(databaseUrl)
		? `${databaseUrl}${databaseUrl.includes('?') ? '&' : '?'}sslmode=require`
		: databaseUrl;

export default defineConfig({
	schema: './src/lib/server/db/schema/index.ts',
	out: './drizzle',
	dialect: 'postgresql',
	dbCredentials: {
		url: migrateUrl
	}
});
