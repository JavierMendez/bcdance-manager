import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { type TodayClassItem } from '$lib/dashboard.js';
import { buildClassGroups, isClassActive } from '$lib/groups.js';
import { WEEKDAYS, type Weekday } from '$lib/courses.js';
import { getWeekdayIndexInAppTimezone } from '$lib/locale.js';
import {
	groups,
	programs,
	studentEntitlements,
	students,
	paymentPlans
} from '$lib/server/db/schema/index.js';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async () => {
	const db = getDb();
	const now = new Date();

	const [entitlementRows, groupRows] = await Promise.all([
		db
			.select({
				entitlementType: studentEntitlements.entitlementType,
				groupId: studentEntitlements.groupId,
				endsAt: studentEntitlements.endsAt,
				hoursRemaining: studentEntitlements.hoursRemaining,
				classesRemaining: studentEntitlements.classesRemaining,
				planName: paymentPlans.name,
				student: {
					id: students.id,
					fullName: students.fullName,
					phone: students.phone,
					active: students.active
				}
			})
			.from(studentEntitlements)
			.innerJoin(students, eq(studentEntitlements.studentId, students.id))
			.innerJoin(paymentPlans, eq(studentEntitlements.paymentPlanId, paymentPlans.id))
			.where(eq(studentEntitlements.active, true)),
		db
			.select({
				id: groups.id,
				programId: groups.programId,
				schedule: groups.schedule,
				days: groups.days,
				startDate: groups.startDate,
				endDate: groups.endDate,
				programName: programs.name,
				programDescription: programs.description
			})
			.from(groups)
			.innerJoin(programs, eq(groups.programId, programs.id))
	]);

	const todayWeekday = WEEKDAYS[getWeekdayIndexInAppTimezone(now)] as Weekday;
	const serializedClasses = groupRows.map((row) => ({
		id: row.id,
		programId: row.programId,
		name: row.programName,
		description: row.programDescription,
		schedule: row.schedule,
		days: row.days as Weekday[],
		startDate: row.startDate,
		endDate: row.endDate
	}));
	const classGroups = buildClassGroups(serializedClasses, entitlementRows, now);
	const todayClasses: TodayClassItem[] = classGroups
		.filter(
			(classGroup) =>
				classGroup.active &&
				classGroup.days.includes(todayWeekday) &&
				isClassActive(classGroup, now)
		)
		.map((classGroup) => ({
			id: classGroup.id,
			name: classGroup.name,
			schedule: classGroup.schedule,
			enrolledCount: classGroup.enrolledCount
		}))
		.sort((a, b) => a.schedule.localeCompare(b.schedule, 'es'));

	return { todayClasses };
};
