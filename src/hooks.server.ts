import { auth } from '$lib/server/auth.js';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { building } from '$app/environment';
import { redirect } from '@sveltejs/kit';
import { canAccessRoute, getAppRole } from '$lib/server/auth/access.js';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({
		headers: event.request.headers
	});

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	} else {
		event.locals.session = null;
		event.locals.user = null;
	}

	// Use the matched route so encoded URLs cannot bypass the dashboard boundary.
	const pathname = event.route.id ?? event.url.pathname;
	if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
		if (!event.locals.user || !event.locals.session) {
			redirect(303, '/login');
		}
		if (!canAccessRoute(getAppRole(event.locals.user), pathname)) {
			redirect(303, '/dashboard?error=unauthorized');
		}
	}

	return svelteKitHandler({ event, resolve, auth, building });
};
