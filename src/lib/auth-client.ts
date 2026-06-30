import { createAuthClient } from 'better-auth/svelte';
import { adminClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
	plugins: [adminClient()]
});

export type AuthClient = typeof authClient;
