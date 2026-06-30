import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user && locals.session) {
		redirect(303, '/dashboard');
	}
};
