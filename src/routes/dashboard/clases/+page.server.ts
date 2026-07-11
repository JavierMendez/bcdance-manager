import { desc, eq, and } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import { getDb } from '$lib/server/db/index.js';
import {
	attachDropInPaymentsToGroups,
	buildClassGroups,
	countMonthlyEnrolledStudents,
	countFullPassStudents,
	type ClassGroup,
	type GroupsPageData,
	type SerializedClassGroup
} from '$lib/groups.js';
import { validateClassScheduleInput, type Weekday } from '$lib/courses.js';
import { validateProgramInput } from '$lib/programs.js';
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
}): SerializedClassGroup {
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

export const load: PageServerLoad = async () => {
	const db = getDb();
	const now = new Date();

	const [groupRows, entitlementRows, dropInPaymentRows, programRows] = await Promise.all([
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
			.orderBy(desc(groups.startDate)),
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
				and(
					eq(payments.purchaseType, 'drop_in_only'),
					eq(paymentItems.itemType, 'drop_in')
				)
			)
			.orderBy(desc(payments.paidAt)),
		db.select({ id: programs.id, name: programs.name, description: programs.description }).from(programs).orderBy(programs.name)
	]);

	const serializedClasses = groupRows.map(serializeClassGroup);
	const classGroups = attachDropInPaymentsToGroups(
		buildClassGroups(serializedClasses, entitlementRows, now),
		dropInPaymentRows
	);

	const pageData: GroupsPageData = {
		groups: classGroups.sort((a, b) => {
			if (a.active !== b.active) {
				return a.active ? -1 : 1;
			}

			return a.name.localeCompare(b.name, 'es');
		}),
		activeClassCount: classGroups.filter((group) => group.active).length,
		enrolledStudentCount: countMonthlyEnrolledStudents(entitlementRows),
		fullPassStudentCount: countFullPassStudents(entitlementRows)
	};

	return {
		...pageData,
		programs: programRows
	};
};

function parseClassCreationForm(formData: FormData) {
	const programSelection = String(formData.get('programSelection') ?? '');
	const programIdValue = Number(formData.get('programId'));
	const isNewProgram = programSelection === '__new__';
	const programId = isNewProgram ? 0 : programIdValue || Number(programSelection);

	const programValidation = isNewProgram
		? validateProgramInput({
				name: String(formData.get('newProgramName') ?? ''),
				description: String(formData.get('newProgramDescription') ?? '')
			})
		: { errors: {} as Record<string, string>, values: null };

	const scheduleValidation = validateClassScheduleInput({
		schedule: String(formData.get('schedule') ?? ''),
		days: formData.getAll('days').map(String) as Weekday[],
		startDate: String(formData.get('startDate') ?? ''),
		endDate: String(formData.get('endDate') ?? '')
	});

	const errors: Record<string, string> = {
		...programValidation.errors,
		...scheduleValidation.errors
	};

	if (!isNewProgram && !programId) {
		errors.programId = 'Selecciona un programa válido.';
	}

	return {
		errors,
		programId,
		isNewProgram,
		programValues: programValidation.values,
		scheduleValues: scheduleValidation.values,
		formValues: Object.fromEntries(
			[...formData.entries()].map(([key, value]) => [key, String(value)])
		) as Record<string, string>
	};
}

export const actions: Actions = {
	createClass: async ({ request }) => {
		const formData = await request.formData();
		const parsed = parseClassCreationForm(formData);

		if (Object.keys(parsed.errors).length > 0) {
			return fail(400, {
				mode: 'createClass' as const,
				errors: parsed.errors,
				values: parsed.formValues
			});
		}

		const db = getDb();
		const now = new Date();

		if (!parsed.isNewProgram && parsed.programId) {
			const [existingProgram] = await db
				.select({ id: programs.id })
				.from(programs)
				.where(eq(programs.id, parsed.programId))
				.limit(1);

			if (!existingProgram) {
				return fail(400, {
					mode: 'createClass' as const,
					errors: { programId: 'El programa seleccionado no existe.' },
					values: parsed.formValues
				});
			}
		}

		const created = await db.transaction(async (tx) => {
			let programId = parsed.programId;

			if (parsed.isNewProgram && parsed.programValues) {
				const [program] = await tx
					.insert(programs)
					.values({
						name: parsed.programValues.name,
						description: parsed.programValues.description,
						updatedAt: now
					})
					.returning();
				programId = program.id;
			}

			const [group] = await tx
				.insert(groups)
				.values({
					programId,
					schedule: parsed.scheduleValues.schedule,
					days: parsed.scheduleValues.days,
					startDate: parsed.scheduleValues.startDate,
					endDate: parsed.scheduleValues.endDate,
					updatedAt: now
				})
				.returning();

			const [program] = await tx
				.select()
				.from(programs)
				.where(eq(programs.id, programId))
				.limit(1);

			return serializeClassGroup({
				...group,
				programName: program.name,
				programDescription: program.description
			});
		});

		const classGroup: ClassGroup = {
			...created,
			active: true,
			enrolledCount: 0,
			fullPassCount: 0,
			dropInCount: 0,
			members: [],
			dropInPayments: []
		};

		return { success: true, mode: 'createClass' as const, classGroup };
	}
};
