import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = ({ url }) => {
	const target = new URL('/dashboard/clases/asistencia', url.origin);
	url.searchParams.forEach((value, key) => {
		if (key === 'courseId' && !url.searchParams.has('groupId')) {
			target.searchParams.set('groupId', value);
			return;
		}
		target.searchParams.set(key, value);
	});
	redirect(301, `${target.pathname}${target.search}`);
};
