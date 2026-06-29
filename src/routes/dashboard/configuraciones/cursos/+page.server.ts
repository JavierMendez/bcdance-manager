import { fail } from '@sveltejs/kit';
import { desc } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { courses } from '$lib/server/db/schema/index.js';
import {
	validateCourseInput,
	type SerializedCourse,
	type Weekday
} from '$lib/courses.js';
import type { Actions, PageServerLoad } from './$types.js';

function serializeCourse(course: typeof courses.$inferSelect): SerializedCourse {
	return {
		id: course.id,
		name: course.name,
		description: course.description,
		schedule: course.schedule,
		days: course.days as Weekday[],
		startDate: course.startDate,
		endDate: course.endDate
	};
}

function parseCourseForm(formData: FormData) {
	return validateCourseInput({
		name: String(formData.get('name') ?? ''),
		description: String(formData.get('description') ?? ''),
		schedule: String(formData.get('schedule') ?? ''),
		days: formData.getAll('days').map(String) as Weekday[],
		startDate: String(formData.get('startDate') ?? ''),
		endDate: String(formData.get('endDate') ?? '')
	});
}

export const load: PageServerLoad = async () => {
	const db = getDb();
	const rows = await db.select().from(courses).orderBy(desc(courses.startDate));

	return {
		courses: rows.map(serializeCourse)
	};
};

export const actions: Actions = {
	create: async ({ request }) => {
		const formData = await request.formData();
		const { errors, values } = parseCourseForm(formData);

		if (Object.keys(errors).length > 0) {
			return fail(400, { errors, values, mode: 'create' as const });
		}

		const db = getDb();

		const [created] = await db
			.insert(courses)
			.values({
				name: values.name,
				description: values.description,
				schedule: values.schedule,
				days: values.days,
				startDate: values.startDate,
				endDate: values.endDate,
				updatedAt: new Date()
			})
			.returning();

		return { success: true, mode: 'create' as const, course: serializeCourse(created) };
	}
};
