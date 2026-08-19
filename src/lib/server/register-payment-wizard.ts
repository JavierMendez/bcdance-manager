import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { getDb } from '$lib/server/db/index.js';
import {
	groups,
	programs,
	paymentItems,
	paymentPlans,
	payments,
	studentEntitlements,
	students
} from '$lib/server/db/schema/index.js';
import type { BillingPeriod } from '$lib/payment-plans.js';
import type { PlanType } from '$lib/payment-plans.js';
import {
	addOneMonth,
	calculatePaymentTotals,
	calculateWizardTotal,
	DROP_IN_DEFAULT_CLASSES,
	FULL_PASS_DEFAULT_HOURS,
	validatePaymentWizard,
	type PaymentMethod,
	type PurchaseType,
	type WizardCourse,
	type WizardPaymentPlan
} from '$lib/payments.js';
import { getEnrolledStudentIdsForClass } from '$lib/groups.js';
import { validateStudentInput } from '$lib/students.js';

export function parseWizardForm(formData: FormData) {
	return {
		studentMode: String(formData.get('studentMode') ?? 'existing'),
		studentId: String(formData.get('studentId') ?? ''),
		newFullName: String(formData.get('newFullName') ?? ''),
		newPhone: String(formData.get('newPhone') ?? ''),
		purchaseType: String(formData.get('purchaseType') ?? '') as PurchaseType,
		courseId: String(formData.get('courseId') ?? formData.get('groupId') ?? ''),
		monthlyPlanId: String(formData.get('monthlyPlanId') ?? ''),
		fullPassPlanId: String(formData.get('fullPassPlanId') ?? ''),
		dropInPlanId: String(formData.get('dropInPlanId') ?? ''),
		paymentMethod: String(formData.get('paymentMethod') ?? '') as PaymentMethod,
		paidAt: String(formData.get('paidAt') ?? ''),
		discountPercent: String(formData.get('discountPercent') ?? '0'),
		notes: String(formData.get('notes') ?? '').trim()
	};
}

export type ParsedWizardForm = ReturnType<typeof parseWizardForm>;

export async function loadClassOptions(db: ReturnType<typeof getDb>): Promise<WizardCourse[]> {
	const rows = await db
		.select({
			id: groups.id,
			name: programs.name,
			schedule: groups.schedule
		})
		.from(groups)
		.innerJoin(programs, eq(groups.programId, programs.id))
		.where(eq(groups.isActive, true))
		.orderBy(programs.name);

	return rows.map((row) => ({
		id: row.id,
		name: `${row.name} — ${row.schedule}`
	}));
}

export async function loadEnrolledStudentIds(
	db: ReturnType<typeof getDb>,
	groupId: number
): Promise<number[]> {
	const [groupRow, entitlementRows] = await Promise.all([
		db
			.select({
				id: groups.id
			})
			.from(groups)
			.where(eq(groups.id, groupId))
			.limit(1),
		db
			.select({
				entitlementType: studentEntitlements.entitlementType,
				groupId: studentEntitlements.groupId,
				startsAt: studentEntitlements.startsAt,
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
			.where(eq(studentEntitlements.active, true))
	]);

	const classGroup = groupRow[0];

	if (!classGroup) {
		return [];
	}

	return getEnrolledStudentIdsForClass(classGroup, entitlementRows);
}

type RegisterPaymentWizardOptions = {
	requireStudent?: boolean;
	redirectTo: string;
	enrollmentGroupId?: number;
};

export async function registerPaymentWizard(
	request: Request,
	db: ReturnType<typeof getDb>,
	options: RegisterPaymentWizardOptions
) {
	const formData = await request.formData();
	const wizardData = parseWizardForm(formData);
	const requireStudent = options.requireStudent ?? false;

	const planRows = await db.select().from(paymentPlans);
	const coursesList = await loadClassOptions(db);

	const plans: WizardPaymentPlan[] = planRows.map((plan) => ({
		id: plan.id,
		name: plan.name,
		description: plan.description,
		planType: plan.planType as PlanType,
		price: plan.price,
		billingPeriod: plan.billingPeriod as BillingPeriod,
		classesIncluded: plan.classesIncluded,
		hoursIncluded: plan.hoursIncluded
	}));

	const paymentWizardData = {
		studentId: wizardData.studentMode === 'new' ? '' : wizardData.studentId,
		purchaseType: wizardData.purchaseType,
		courseId: wizardData.courseId,
		monthlyPlanId: wizardData.monthlyPlanId,
		fullPassPlanId: wizardData.fullPassPlanId,
		dropInPlanId: wizardData.dropInPlanId,
		paymentMethod: wizardData.paymentMethod,
		paidAt: wizardData.paidAt,
		discountPercent: wizardData.discountPercent,
		notes: wizardData.notes
	};

	const { errors, studentId: existingStudentId, courseId, monthlyPlanId, fullPassPlanId, dropInPlanId, discountPercent } =
		validatePaymentWizard(paymentWizardData, plans, coursesList);

	const formErrors: Record<string, string> = { ...errors };

	if (wizardData.studentMode === 'new') {
		delete formErrors.studentId;
	}

	let studentId = existingStudentId;

	if (requireStudent || wizardData.studentMode === 'new') {
		if (wizardData.studentMode === 'new') {
			const { errors: studentErrors, values } = validateStudentInput({
				fullName: wizardData.newFullName,
				phone: wizardData.newPhone
			});

			if (Object.keys(studentErrors).length > 0) {
				if (studentErrors.fullName) formErrors.newFullName = studentErrors.fullName;
				if (studentErrors.phone) formErrors.newPhone = studentErrors.phone;
			} else {
				const [created] = await db
					.insert(students)
					.values({
						fullName: values.fullName,
						phone: values.phone,
						updatedAt: new Date()
					})
					.returning({ id: students.id });

				studentId = created.id;
				wizardData.studentId = String(created.id);
			}
		} else if (!studentId) {
			formErrors.studentId = 'Selecciona un alumno.';
		}
	}

	if (options.enrollmentGroupId && studentId) {
		const enrolledStudentIds = await loadEnrolledStudentIds(db, options.enrollmentGroupId);

		if (enrolledStudentIds.includes(studentId)) {
			formErrors.studentId = 'Este alumno ya está inscrito en esta clase.';
		}
	}

	if (Object.keys(formErrors).length > 0) {
		return fail(400, { errors: formErrors, values: wizardData });
	}

	const purchaseType = wizardData.purchaseType;

	if (studentId) {
		const [student] = await db
			.select({ id: students.id, fullName: students.fullName })
			.from(students)
			.where(eq(students.id, studentId))
			.limit(1);

		if (!student) {
			return fail(400, { errors: { studentId: 'El alumno no existe.' }, values: wizardData });
		}
	} else if (purchaseType !== 'drop_in_only') {
		return fail(400, { errors: { studentId: 'Selecciona un alumno.' }, values: wizardData });
	}

	const subtotalAmount = calculateWizardTotal(
		purchaseType,
		plans,
		monthlyPlanId,
		fullPassPlanId,
		dropInPlanId
	);
	const paymentTotals = calculatePaymentTotals(subtotalAmount, discountPercent);
	const paidAt = new Date(wizardData.paidAt);
	const startsAt = paidAt;

	const monthlyPlan = plans.find((plan) => plan.id === monthlyPlanId);
	const fullPassPlan = plans.find((plan) => plan.id === fullPassPlanId);
	const dropInPlan = plans.find((plan) => plan.id === dropInPlanId);
	const classGroup = coursesList.find((entry) => entry.id === courseId);

	await db.transaction(async (tx) => {
		const [payment] = await tx
			.insert(payments)
			.values({
				studentId: studentId ?? null,
				purchaseType,
				subtotalAmount: paymentTotals.subtotalAmount,
				discountPercent: paymentTotals.discountPercent,
				totalAmount: paymentTotals.totalAmount,
				paymentMethod: wizardData.paymentMethod,
				notes: wizardData.notes || null,
				paidAt
			})
			.returning();

		if (purchaseType === 'monthly_only' || purchaseType === 'combined') {
			if (!monthlyPlan || !classGroup || !studentId) {
				throw new Error('Missing monthly plan data');
			}

			await tx.insert(paymentItems).values({
				paymentId: payment.id,
				itemType: 'monthly_plan',
				paymentPlanId: monthlyPlan.id,
				groupId: classGroup.id,
				amount: monthlyPlan.price
			});

			await tx.insert(studentEntitlements).values({
				studentId,
				paymentId: payment.id,
				entitlementType: 'monthly_plan',
				paymentPlanId: monthlyPlan.id,
				groupId: classGroup.id,
				startsAt,
				endsAt: addOneMonth(startsAt),
				active: true
			});
		}

		if (purchaseType === 'full_pass_only' || purchaseType === 'combined') {
			if (!fullPassPlan || !studentId) {
				throw new Error('Missing full pass plan data');
			}

			const hoursGranted = fullPassPlan.hoursIncluded ?? FULL_PASS_DEFAULT_HOURS;

			await tx.insert(paymentItems).values({
				paymentId: payment.id,
				itemType: 'full_pass',
				paymentPlanId: fullPassPlan.id,
				amount: fullPassPlan.price,
				hoursGranted
			});

			await tx.insert(studentEntitlements).values({
				studentId,
				paymentId: payment.id,
				entitlementType: 'full_pass',
				paymentPlanId: fullPassPlan.id,
				hoursRemaining: hoursGranted,
				startsAt,
				endsAt: addOneMonth(startsAt),
				active: true
			});
		}

		if (purchaseType === 'drop_in_only') {
			if (!dropInPlan || !classGroup) {
				throw new Error('Missing drop-in plan data');
			}

			const classesGranted = dropInPlan.classesIncluded ?? DROP_IN_DEFAULT_CLASSES;

			await tx.insert(paymentItems).values({
				paymentId: payment.id,
				itemType: 'drop_in',
				paymentPlanId: dropInPlan.id,
				groupId: classGroup.id,
				amount: dropInPlan.price,
				classesGranted
			});

			if (studentId) {
				await tx.insert(studentEntitlements).values({
					studentId,
					paymentId: payment.id,
					entitlementType: 'drop_in',
					paymentPlanId: dropInPlan.id,
					groupId: classGroup.id,
					classesRemaining: classesGranted,
					startsAt,
					active: true
				});
			}
		}
	});

	redirect(303, options.redirectTo);
}
