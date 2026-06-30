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
	baseURL: env.BETTER_AUTH_URL,
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
