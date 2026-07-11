import { and, desc, eq } from 'drizzle-orm';
import { error, fail } from '@sveltejs/kit';
import { getDb } from '$lib/server/db/index.js';
import {
	attachDropInPaymentsToGroups,
	buildClassGroups,
	type ClassGroup
} from '$lib/groups.js';
import { validateClassScheduleInput, type Weekday } from '$lib/courses.js';
import {
	groups,
	programs,
	paymentItems,
	paymentPlans,
	payments,
	studentEntitlements,
	students
} from '$lib/server/db/schema/index.js';
import type { Actions, PageServerLoad } from './$types.js';

function serializeClassGroup(row: {
	id: number;
	programId: number;
	schedule: string;
	days: string[];
	startDate: string;
	endDate: string;
	programName: string;
	programDescription: string;
}) {
	return {
		id: row.id,
		programId: row.programId,
		name: row.programName,
		description: row.programDescription,
		schedule: row.schedule,
		days: row.days as Weekday[],
		startDate: row.startDate,
		endDate: row.endDate
	};
}

async function loadClassGroup(groupId: number) {
	const db = getDb();
	const now = new Date();

	const [groupRow, entitlementRows, dropInPaymentRows, programRows] = await Promise.all([
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
				classesGranted: paymentItems.classesGranted,
				paidAt: payments.paidAt
			})
			.from(payments)
			.innerJoin(paymentItems, eq(paymentItems.paymentId, payments.id))
			.innerJoin(paymentPlans, eq(paymentItems.paymentPlanId, paymentPlans.id))
			.leftJoin(students, eq(payments.studentId, students.id))
			.where(
				and(eq(payments.purchaseType, 'drop_in_only'), eq(paymentItems.itemType, 'drop_in'))
			)
			.orderBy(desc(payments.paidAt)),
		db
			.select({ id: programs.id, name: programs.name, description: programs.description })
			.from(programs)
			.orderBy(programs.name)
	]);

	const row = groupRow[0];

	if (!row) {
		return null;
	}

	const serialized = serializeClassGroup(row);
	const [classGroup] = attachDropInPaymentsToGroups(
		buildClassGroups([serialized], entitlementRows, now),
		dropInPaymentRows
	);

	return {
		classGroup: classGroup as ClassGroup,
		programs: programRows
	};
}

function parseClassUpdateForm(formData: FormData) {
	const programId = Number(formData.get('programId'));
	const scheduleValidation = validateClassScheduleInput({
		schedule: String(formData.get('schedule') ?? ''),
		days: formData.getAll('days').map(String) as Weekday[],
		startDate: String(formData.get('startDate') ?? ''),
		endDate: String(formData.get('endDate') ?? '')
	});

	const errors: Record<string, string> = { ...scheduleValidation.errors };

	if (!programId) {
		errors.programId = 'Selecciona un programa válido.';
	}

	return {
		errors,
		programId,
		scheduleValues: scheduleValidation.values,
		formValues: {
			programId: String(formData.get('programId') ?? ''),
			schedule: String(formData.get('schedule') ?? ''),
			days: formData.getAll('days').map(String) as Weekday[],
			startDate: String(formData.get('startDate') ?? ''),
			endDate: String(formData.get('endDate') ?? '')
		}
	};
}

export const load: PageServerLoad = async ({ params }) => {
	const groupId = Number(params.groupId);

	if (!groupId) {
		error(404, 'Clase no encontrada');
	}

	const result = await loadClassGroup(groupId);

	if (!result) {
		error(404, 'Clase no encontrada');
	}

	return result;
};

export const actions: Actions = {
	updateClass: async ({ request, params }) => {
		const groupId = Number(params.groupId);

		if (!groupId) {
			return fail(400, { message: 'Clase no válida.' });
		}

		const formData = await request.formData();
		const parsed = parseClassUpdateForm(formData);

		if (Object.keys(parsed.errors).length > 0) {
			return fail(400, {
				mode: 'updateClass' as const,
				errors: parsed.errors,
				values: parsed.formValues
			});
		}

		const db = getDb();
		const now = new Date();

		const [existingProgram] = await db
			.select({ id: programs.id })
			.from(programs)
			.where(eq(programs.id, parsed.programId))
			.limit(1);

		if (!existingProgram) {
			return fail(400, {
				mode: 'updateClass' as const,
				errors: { programId: 'El programa seleccionado no existe.' },
				values: parsed.formValues
			});
		}

		const [updated] = await db
			.update(groups)
			.set({
				programId: parsed.programId,
				schedule: parsed.scheduleValues.schedule,
				days: parsed.scheduleValues.days,
				startDate: parsed.scheduleValues.startDate,
				endDate: parsed.scheduleValues.endDate,
				updatedAt: now
			})
			.where(eq(groups.id, groupId))
			.returning();

		if (!updated) {
			return fail(404, { message: 'Clase no encontrada.' });
		}

		const result = await loadClassGroup(groupId);

		if (!result) {
			return fail(404, { message: 'Clase no encontrada.' });
		}

		return {
			success: true,
			mode: 'updateClass' as const,
			classGroup: result.classGroup
		};
	}
};
