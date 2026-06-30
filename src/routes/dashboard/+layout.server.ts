import { redirect } from '@sveltejs/kit';
import { canAccessRoute, getAppRole } from '$lib/server/auth/access.js';
import type { LayoutServerLoad } from './$types.js';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	if (!locals.user || !locals.session) {
		redirect(303, '/login');
	}

	const role = getAppRole(locals.user);

	if (!canAccessRoute(role, url.pathname)) {
		redirect(303, '/dashboard?error=unauthorized');
	}

	return {
		user: locals.user,
		role
	};
};
