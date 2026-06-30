import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = () => {
	redirect(301, '/dashboard/clases');
};
