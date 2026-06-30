import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ parent }) => {
	const { role } = await parent();

	if (role !== 'admin') {
		redirect(303, '/dashboard?error=unauthorized');
	}
};
