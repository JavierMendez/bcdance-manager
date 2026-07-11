import { fail, redirect } from '@sveltejs/kit';
import { and, eq, sql } from 'drizzle-orm';
import {
	buildAttendanceMembers,
	buildEligibleFullPassStudents,
	buildSessionDropInPayments,
	formatSessionDate,
	getTodaySessionDate,
	parseAttendanceEntries,
	DROP_IN_CLASSES_PER_SESSION,
	FULL_PASS_HOURS_PER_CLASS,
	type AttendanceStatus
} from '$lib/attendance.js';
import { APP_TIMEZONE } from '$lib/locale.js';
import { type Weekday } from '$lib/courses.js';
import type { BillingPeriod } from '$lib/payment-plans.js';
import type { PlanType } from '$lib/payment-plans.js';
import {
	calculatePaymentTotals,
	DROP_IN_DEFAULT_CLASSES,
	PAYMENT_METHODS,
	validateQuickDropInRegistration,
	type PaymentMethod,
	type QuickDropInFormData,
	type WizardPaymentPlan,
	type WizardStudent
} from '$lib/payments.js';
import { getDb } from '$lib/server/db/index.js';
import {
	classAttendance,
	groups,
	programs,
	paymentItems,
	paymentPlans,
	payments,
	studentEntitlements,
	students
} from '$lib/server/db/schema/index.js';
import type { Actions, PageServerLoad } from './$types.js';

function parseSessionDate(value: string | null) {
	if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return getTodaySessionDate();
	}

	return value;
}

function parseGroupId(url: URL) {
	const groupId = Number(url.searchParams.get('groupId') ?? url.searchParams.get('courseId'));
	return groupId > 0 ? groupId : 0;
}

function paidOnSessionDate(sessionDate: string) {
	return sql`(${payments.paidAt} AT TIME ZONE ${APP_TIMEZONE})::date = ${sessionDate}::date`;
}

function parseQuickDropInForm(formData: FormData): QuickDropInFormData {
	return {
		studentId: String(formData.get('studentId') ?? ''),
		dropInPlanId: String(formData.get('dropInPlanId') ?? ''),
		paymentMethod: String(formData.get('paymentMethod') ?? '') as PaymentMethod,
		discountPercent: String(formData.get('discountPercent') ?? '0'),
		notes: String(formData.get('notes') ?? '').trim()
	};
}

function serializeDropInPlans(planRows: (typeof paymentPlans.$inferSelect)[]): WizardPaymentPlan[] {
	return planRows.map((plan) => ({
		id: plan.id,
		name: plan.name,
		description: plan.description,
		planType: plan.planType as PlanType,
		price: plan.price,
		billingPeriod: plan.billingPeriod as BillingPeriod,
		classesIncluded: plan.classesIncluded,
		hoursIncluded: plan.hoursIncluded
	}));
}

async function loadClassGroupOptions(db: ReturnType<typeof getDb>) {
	return db
		.select({
			id: groups.id,
			name: programs.name,
			schedule: groups.schedule
		})
		.from(groups)
		.innerJoin(programs, eq(groups.programId, programs.id))
		.orderBy(programs.name);
}

async function loadGroupContext(db: ReturnType<typeof getDb>, groupId: number) {
	const [row] = await db
		.select({
			id: groups.id,
			name: programs.name,
			schedule: groups.schedule,
			days: groups.days
		})
		.from(groups)
		.innerJoin(programs, eq(groups.programId, programs.id))
		.where(eq(groups.id, groupId))
		.limit(1);

	return row ?? null;
}

function parseGroupIdFromForm(formData: FormData) {
	const groupId = Number(formData.get('groupId') ?? formData.get('courseId'));
	return groupId > 0 ? groupId : 0;
}

export const load: PageServerLoad = async ({ url }) => {
	const db = getDb();
	const groupId = parseGroupId(url);
	const sessionDate = parseSessionDate(url.searchParams.get('date'));
	const classOptions = await loadClassGroupOptions(db);

	if (!groupId) {
		return {
			course: null,
			sessionDate,
			members: [],
			courses: classOptions.map((entry) => ({
				id: entry.id,
				name: `${entry.name} — ${entry.schedule}`
			})),
			eligibleStudents: [],
			eligibleFullPassStudents: [],
			dropInPlans: [],
			sessionDropInPayments: [],
			paymentMethods: PAYMENT_METHODS
		};
	}

	const classGroup = await loadGroupContext(db, groupId);

	if (!classGroup) {
		return {
			course: null,
			sessionDate,
			members: [],
			courses: classOptions.map((entry) => ({
				id: entry.id,
				name: `${entry.name} — ${entry.schedule}`
			})),
			eligibleStudents: [],
			eligibleFullPassStudents: [],
			dropInPlans: [],
			sessionDropInPayments: [],
			paymentMethods: PAYMENT_METHODS
		};
	}

	const [entitlementRows, attendanceRows, studentRows, planRows, sessionPaymentRows] =
		await Promise.all([
			db
				.select({
					id: studentEntitlements.id,
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
					studentId: classAttendance.studentId,
					status: classAttendance.status
				})
				.from(classAttendance)
				.where(
					and(eq(classAttendance.groupId, groupId), eq(classAttendance.sessionDate, sessionDate))
				),
			db
				.select({
					id: students.id,
					fullName: students.fullName,
					phone: students.phone
				})
				.from(students)
				.where(eq(students.active, true))
				.orderBy(students.fullName),
			db.select().from(paymentPlans),
			db
				.select({
					paymentId: payments.id,
					studentId: payments.studentId,
					studentName: students.fullName,
					planName: paymentPlans.name,
					totalAmount: payments.totalAmount,
					discountPercent: payments.discountPercent,
					paymentMethod: payments.paymentMethod,
					classesGranted: paymentItems.classesGranted
				})
				.from(payments)
				.innerJoin(paymentItems, eq(paymentItems.paymentId, payments.id))
				.innerJoin(paymentPlans, eq(paymentItems.paymentPlanId, paymentPlans.id))
				.leftJoin(students, eq(payments.studentId, students.id))
				.where(
					and(
						eq(payments.purchaseType, 'drop_in_only'),
						eq(paymentItems.itemType, 'drop_in'),
						eq(paymentItems.groupId, groupId),
						paidOnSessionDate(sessionDate)
					)
				)
		]);

	const attendanceByStudent = new Map<number, AttendanceStatus>();
	for (const row of attendanceRows) {
		attendanceByStudent.set(row.studentId, row.status as AttendanceStatus);
	}

	const members = buildAttendanceMembers(groupId, entitlementRows, attendanceByStudent);
	const memberStudentIds = new Set(members.map((member) => member.studentId));
	const attendedStudentIds = new Set(
		attendanceRows.filter((row) => row.status === 'attended').map((row) => row.studentId)
	);

	const eligibleStudents = studentRows.filter(
		(student) => !memberStudentIds.has(student.id) && !attendedStudentIds.has(student.id)
	) as WizardStudent[];

	const eligibleFullPassStudents = buildEligibleFullPassStudents(
		groupId,
		entitlementRows,
		memberStudentIds
	);

	const dropInPlans = serializeDropInPlans(planRows).filter((plan) => plan.planType === 'drop_in');
	const sessionDropInPayments = buildSessionDropInPayments(sessionPaymentRows, attendanceByStudent);

	return {
		course: {
			id: classGroup.id,
			name: classGroup.name,
			schedule: classGroup.schedule,
			days: classGroup.days as Weekday[]
		},
		sessionDate,
		sessionDateLabel: formatSessionDate(sessionDate),
		members,
		courses: classOptions.map((entry) => ({
			id: entry.id,
			name: `${entry.name} — ${entry.schedule}`
		})),
		eligibleStudents,
		eligibleFullPassStudents,
		dropInPlans,
		sessionDropInPayments,
		paymentMethods: PAYMENT_METHODS
	};
};

export const actions: Actions = {
	save: async ({ request }) => {
		const formData = await request.formData();
		const groupId = parseGroupIdFromForm(formData);
		const sessionDate = parseSessionDate(String(formData.get('sessionDate') ?? ''));
		const { entries, errors: parseErrors } = parseAttendanceEntries(
			String(formData.get('entries') ?? '[]')
		);

		if (!groupId) {
			return fail(400, { message: 'Selecciona una clase válida.' });
		}

		if (parseErrors.length > 0) {
			return fail(400, { message: parseErrors[0] });
		}

		if (entries.length === 0) {
			return fail(400, { message: 'Registra la asistencia de al menos un alumno.' });
		}

		const db = getDb();
		const classGroup = await loadGroupContext(db, groupId);

		if (!classGroup) {
			return fail(404, { message: 'Clase no encontrada.' });
		}

		try {
			await db.transaction(async (tx) => {
				for (const entry of entries) {
					const [entitlement] = await tx
						.select()
						.from(studentEntitlements)
						.where(
							and(
								eq(studentEntitlements.id, entry.entitlementId),
								eq(studentEntitlements.studentId, entry.studentId),
								eq(studentEntitlements.active, true)
							)
						)
						.limit(1);

					if (!entitlement) {
						throw new Error(`Vigencia no válida para el alumno ${entry.studentId}.`);
					}

					if (
						entitlement.entitlementType === 'monthly_plan' &&
						entitlement.groupId !== groupId
					) {
						throw new Error(`El plan mensual no corresponde a esta clase.`);
					}

					if (entitlement.entitlementType === 'drop_in' && entitlement.groupId !== groupId) {
						throw new Error(`El plan por clase no corresponde a esta clase.`);
					}

					const [existing] = await tx
						.select()
						.from(classAttendance)
						.where(
							and(
								eq(classAttendance.studentId, entry.studentId),
								eq(classAttendance.groupId, groupId),
								eq(classAttendance.sessionDate, sessionDate),
								eq(classAttendance.entitlementId, entry.entitlementId)
							)
						)
						.limit(1);

					let hoursDeducted = existing?.hoursDeducted ?? 0;
					let classesDeducted = existing?.classesDeducted ?? 0;

					if (entitlement.entitlementType === 'full_pass') {
						const statusChanged = !existing || existing.status !== entry.status;

						if (statusChanged) {
							let currentHours = entitlement.hoursRemaining ?? 0;

							if (existing?.status === 'attended' && existing.hoursDeducted > 0) {
								currentHours += existing.hoursDeducted;
							}

							if (entry.status === 'attended') {
								if (currentHours < FULL_PASS_HOURS_PER_CLASS) {
									throw new Error(
										'El alumno no tiene horas suficientes en su full pass para registrar asistencia.'
									);
								}

								hoursDeducted = FULL_PASS_HOURS_PER_CLASS;
								currentHours -= hoursDeducted;
							} else {
								hoursDeducted = 0;
							}

							await tx
								.update(studentEntitlements)
								.set({ hoursRemaining: currentHours })
								.where(eq(studentEntitlements.id, entitlement.id));
						}
					} else if (entitlement.entitlementType === 'drop_in') {
						const statusChanged = !existing || existing.status !== entry.status;

						if (statusChanged) {
							let currentClasses = entitlement.classesRemaining ?? 0;

							if (existing?.status === 'attended' && existing.classesDeducted > 0) {
								currentClasses += existing.classesDeducted;
							}

							if (entry.status === 'attended') {
								if (currentClasses < DROP_IN_CLASSES_PER_SESSION) {
									throw new Error(
										'El alumno no tiene clases restantes para registrar asistencia.'
									);
								}

								classesDeducted = DROP_IN_CLASSES_PER_SESSION;
								currentClasses -= classesDeducted;
							} else {
								classesDeducted = 0;
							}

							await tx
								.update(studentEntitlements)
								.set({ classesRemaining: currentClasses })
								.where(eq(studentEntitlements.id, entitlement.id));
						}
					} else {
						hoursDeducted = 0;
						classesDeducted = 0;
					}

					if (existing) {
						await tx
							.update(classAttendance)
							.set({
								status: entry.status,
								hoursDeducted,
								classesDeducted,
								updatedAt: new Date()
							})
							.where(eq(classAttendance.id, existing.id));
					} else {
						await tx.insert(classAttendance).values({
							studentId: entry.studentId,
							groupId,
							entitlementId: entry.entitlementId,
							entitlementType: entitlement.entitlementType,
							sessionDate,
							status: entry.status,
							hoursDeducted,
							classesDeducted,
							updatedAt: new Date()
						});
					}
				}
			});
		} catch (error) {
			return fail(400, {
				message:
					error instanceof Error ? error.message : 'No se pudo guardar la asistencia.'
			});
		}

		redirect(
			303,
			`/dashboard/clases/asistencia?groupId=${groupId}&date=${sessionDate}&saved=1`
		);
	},

	registerDropIn: async ({ request }) => {
		const formData = await request.formData();
		const groupId = parseGroupIdFromForm(formData);
		const sessionDate = parseSessionDate(String(formData.get('sessionDate') ?? ''));
		const quickDropInData = parseQuickDropInForm(formData);

		if (!groupId) {
			return fail(400, {
				mode: 'registerDropIn' as const,
				message: 'Selecciona una clase válida.',
				values: quickDropInData
			});
		}

		const db = getDb();

		const [classGroup, studentRows, planRows, entitlementRows, attendanceRows] = await Promise.all([
			loadGroupContext(db, groupId),
			db
				.select({ id: students.id })
				.from(students)
				.where(eq(students.active, true)),
			db.select().from(paymentPlans),
			db
				.select({
					id: studentEntitlements.id,
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
					studentId: classAttendance.studentId,
					status: classAttendance.status
				})
				.from(classAttendance)
				.where(
					and(eq(classAttendance.groupId, groupId), eq(classAttendance.sessionDate, sessionDate))
				)
		]);

		if (!classGroup) {
			return fail(404, {
				mode: 'registerDropIn' as const,
				message: 'Clase no encontrada.',
				values: quickDropInData
			});
		}

		const attendanceByStudent = new Map<number, AttendanceStatus>();
		for (const row of attendanceRows) {
			attendanceByStudent.set(row.studentId, row.status as AttendanceStatus);
		}

		const members = buildAttendanceMembers(groupId, entitlementRows, attendanceByStudent);
		const memberStudentIds = new Set(members.map((member) => member.studentId));
		const attendedStudentIds = new Set(
			attendanceRows.filter((row) => row.status === 'attended').map((row) => row.studentId)
		);

		const eligibleStudentIds = studentRows
			.filter(
				(student) => !memberStudentIds.has(student.id) && !attendedStudentIds.has(student.id)
			)
			.map((student) => student.id);

		const dropInPlans = serializeDropInPlans(planRows).filter((plan) => plan.planType === 'drop_in');
		const { errors, studentId, dropInPlanId, discountPercent } = validateQuickDropInRegistration(
			quickDropInData,
			dropInPlans,
			eligibleStudentIds
		);

		if (Object.keys(errors).length > 0) {
			return fail(400, {
				mode: 'registerDropIn' as const,
				errors,
				values: quickDropInData
			});
		}

		const dropInPlan = dropInPlans.find((plan) => plan.id === dropInPlanId);

		if (!dropInPlan) {
			return fail(400, {
				mode: 'registerDropIn' as const,
				errors: { dropInPlanId: 'El plan por clase seleccionado no es válido.' },
				values: quickDropInData
			});
		}

		const classesGranted = dropInPlan.classesIncluded ?? DROP_IN_DEFAULT_CLASSES;
		const paymentTotals = calculatePaymentTotals(dropInPlan.price, discountPercent);

		if (studentId && classesGranted < DROP_IN_CLASSES_PER_SESSION) {
			return fail(400, {
				mode: 'registerDropIn' as const,
				errors: {
					dropInPlanId: 'El plan no incluye clases suficientes para registrar asistencia.'
				},
				values: quickDropInData
			});
		}

		const paidAt = new Date();
		const startsAt = paidAt;

		try {
			await db.transaction(async (tx) => {
				const [payment] = await tx
					.insert(payments)
					.values({
						studentId: studentId ?? null,
						purchaseType: 'drop_in_only',
						subtotalAmount: paymentTotals.subtotalAmount,
						discountPercent: paymentTotals.discountPercent,
						totalAmount: paymentTotals.totalAmount,
						paymentMethod: quickDropInData.paymentMethod,
						notes: quickDropInData.notes || null,
						paidAt
					})
					.returning();

				await tx.insert(paymentItems).values({
					paymentId: payment.id,
					itemType: 'drop_in',
					paymentPlanId: dropInPlan.id,
					groupId,
					amount: dropInPlan.price,
					classesGranted
				});

				if (studentId) {
					const classesRemaining = classesGranted - DROP_IN_CLASSES_PER_SESSION;

					const [entitlement] = await tx
						.insert(studentEntitlements)
						.values({
							studentId,
							paymentId: payment.id,
							entitlementType: 'drop_in',
							paymentPlanId: dropInPlan.id,
							groupId,
							classesRemaining,
							startsAt,
							active: true
						})
						.returning();

					await tx.insert(classAttendance).values({
						studentId,
						groupId,
						entitlementId: entitlement.id,
						entitlementType: 'drop_in',
						sessionDate,
						status: 'attended',
						hoursDeducted: 0,
						classesDeducted: DROP_IN_CLASSES_PER_SESSION,
						updatedAt: new Date()
					});
				}
			});
		} catch (error) {
			return fail(400, {
				mode: 'registerDropIn' as const,
				message:
					error instanceof Error
						? error.message
						: 'No se pudo registrar el pago por clase.',
				values: quickDropInData
			});
		}

		const redirectParams = new URLSearchParams({
			groupId: String(groupId),
			date: sessionDate,
			saved: '1',
			dropIn: '1'
		});

		if (studentId) {
			redirectParams.set('attended', '1');
		}

		redirect(303, `/dashboard/clases/asistencia?${redirectParams.toString()}`);
	}
};
