import { and, desc, eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db/index.js';
import {
	attachDropInPaymentsToGroups,
	buildClassGroups,
	type ClassGroup
} from '$lib/groups.js';
import { type Weekday } from '$lib/courses.js';
import {
	groups,
	programs,
	paymentItems,
	paymentPlans,
	payments,
	studentEntitlements,
	students
} from '$lib/server/db/schema/index.js';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ params }) => {
	const groupId = Number(params.groupId);

	if (!groupId) {
		error(404, 'Clase no encontrada');
	}

	const db = getDb();
	const now = new Date();

	const [groupRow, entitlementRows, dropInPaymentRows] = await Promise.all([
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
			.where(eq(groups.id, groupId))
			.limit(1),
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
				groupId: paymentItems.groupId,
				paymentId: payments.id,
				studentName: students.fullName,
				planName: paymentPlans.name,
				totalAmount: payments.totalAmount,
				paymentMethod: payments.paymentMethod,
				paidAt: payments.paidAt
			})
			.from(payments)
			.innerJoin(paymentItems, eq(paymentItems.paymentId, payments.id))
			.innerJoin(paymentPlans, eq(paymentItems.paymentPlanId, paymentPlans.id))
			.leftJoin(students, eq(payments.studentId, students.id))
			.where(
				and(eq(payments.purchaseType, 'drop_in_only'), eq(paymentItems.itemType, 'drop_in'))
			)
			.orderBy(desc(payments.paidAt))
	]);

	const row = groupRow[0];

	if (!row) {
		error(404, 'Clase no encontrada');
	}

	const serialized = {
		id: row.id,
		programId: row.programId,
		name: row.programName,
		description: row.programDescription,
		schedule: row.schedule,
		days: row.days as Weekday[],
		startDate: row.startDate,
		endDate: row.endDate
	};

	const [classGroup] = attachDropInPaymentsToGroups(
		buildClassGroups([serialized], entitlementRows, now),
		dropInPaymentRows
	);

	return { classGroup: classGroup as ClassGroup };
};
