// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { AuthSessionResult } from '$lib/server/auth.js';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			session: NonNullable<AuthSessionResult>['session'] | null;
			user: NonNullable<AuthSessionResult>['user'] | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
