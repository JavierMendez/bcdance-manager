import { desc, eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import {
	buildCourseGroups,
	type GroupsPageData
} from '$lib/groups.js';
import { type SerializedCourse, type Weekday } from '$lib/courses.js';
import {
	courses,
	paymentPlans,
	studentEntitlements,
	students
} from '$lib/server/db/schema/index.js';
import type { PageServerLoad } from './$types.js';

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

export const load: PageServerLoad = async () => {
	const db = getDb();
	const now = new Date();

	const [courseRows, entitlementRows] = await Promise.all([
		db.select().from(courses).orderBy(desc(courses.startDate)),
		db
			.select({
				entitlementType: studentEntitlements.entitlementType,
				courseId: studentEntitlements.courseId,
				endsAt: studentEntitlements.endsAt,
				hoursRemaining: studentEntitlements.hoursRemaining,
				planName: paymentPlans.name,
				student: {
					id: students.id,
					fullName: students.fullName,
					phone: students.phone,
					email: students.email,
					active: students.active
				}
			})
			.from(studentEntitlements)
			.innerJoin(students, eq(studentEntitlements.studentId, students.id))
			.innerJoin(paymentPlans, eq(studentEntitlements.paymentPlanId, paymentPlans.id))
			.where(eq(studentEntitlements.active, true))
	]);

	const serializedCourses = courseRows.map(serializeCourse);
	const groups = buildCourseGroups(serializedCourses, entitlementRows, now);

	const pageData: GroupsPageData = {
		groups: groups.sort((a, b) => {
			if (a.active !== b.active) {
				return a.active ? -1 : 1;
			}

			return a.name.localeCompare(b.name, 'es');
		}),
		activeCourseCount: groups.filter((group) => group.active).length,
		totalEnrollments: groups.reduce((sum, group) => sum + group.enrolledCount, 0)
	};

	return pageData;
};
