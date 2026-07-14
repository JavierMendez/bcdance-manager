import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { buildExpiringFullPassStudents, buildExpiringPaymentStudents, type TodayClassItem } from '$lib/dashboard.js';
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

	const [studentRows, entitlementRows, groupRows] = await Promise.all([
		db
			.select({
				id: students.id,
				fullName: students.fullName,
				phone: students.phone,
				active: students.active
			})
			.from(students)
			.where(eq(students.active, true)),
		db
			.select({
				studentId: studentEntitlements.studentId,
				entitlementType: studentEntitlements.entitlementType,
				groupId: studentEntitlements.groupId,
				endsAt: studentEntitlements.endsAt,
				hoursRemaining: studentEntitlements.hoursRemaining,
				classesRemaining: studentEntitlements.classesRemaining,
				active: studentEntitlements.active,
				planName: paymentPlans.name,
				hoursIncluded: paymentPlans.hoursIncluded
			})
			.from(studentEntitlements)
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

	const entitlementsByStudent = new Map<
		number,
		{
			entitlementType: string;
			endsAt: Date | null;
			hoursRemaining: number | null;
			classesRemaining: number | null;
			active: boolean;
			planName: string;
			hoursIncluded: number | null;
		}[]
	>();

	for (const row of entitlementRows) {
		const current = entitlementsByStudent.get(row.studentId) ?? [];
		current.push({
			entitlementType: row.entitlementType,
			endsAt: row.endsAt,
			hoursRemaining: row.hoursRemaining,
			classesRemaining: row.classesRemaining,
			active: row.active,
			planName: row.planName,
			hoursIncluded: row.hoursIncluded
		});
		entitlementsByStudent.set(row.studentId, current);
	}

	const expiringPayments = buildExpiringPaymentStudents(
		studentRows,
		entitlementsByStudent,
		now
	);
	const expiringFullPassPayments = buildExpiringFullPassStudents(
		studentRows,
		entitlementsByStudent,
		now
	);

	const entitlementRowsForClasses = entitlementRows.map((row) => ({
		entitlementType: row.entitlementType,
		groupId: row.groupId,
		endsAt: row.endsAt,
		hoursRemaining: row.hoursRemaining,
		classesRemaining: row.classesRemaining,
		planName: row.planName,
		student: studentRows.find((student) => student.id === row.studentId) ?? {
			id: row.studentId,
			fullName: '',
			phone: null,
			active: true
		}
	}));

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
	const classGroups = buildClassGroups(serializedClasses, entitlementRowsForClasses, now);
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

	return {
		todayClasses,
		expiringPayments: expiringPayments.items,
		expiringPaymentsTotal: expiringPayments.total,
		expiringFullPassPayments: expiringFullPassPayments.items,
		expiringFullPassPaymentsTotal: expiringFullPassPayments.total
	};
};
