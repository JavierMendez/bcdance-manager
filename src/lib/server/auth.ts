import { dev } from '$app/environment';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { admin } from 'better-auth/plugins';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { getDb } from '$lib/server/db/index.js';
import * as schema from '$lib/server/db/schema/index.js';
import { env } from '$env/dynamic/private';

export const auth = betterAuth({
	secret: env.BETTER_AUTH_SECRET,
	// In dev, omit baseURL so auth routes match the request origin (e.g. :5173 vs :5174).
	baseURL: dev ? undefined : env.BETTER_AUTH_URL,
	database: drizzleAdapter(getDb(), {
		provider: 'pg',
		schema
	}),
	emailAndPassword: {
		enabled: true,
		disableSignUp: true
	},
	plugins: [admin({ defaultRole: 'user' }), sveltekitCookies(getRequestEvent)]
});

export type Session = typeof auth.$Infer.Session;
export type User = Session['user'];
export type AuthSessionResult = Awaited<ReturnType<typeof auth.api.getSession>>;
