import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
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
	PAYMENT_METHODS,
	validatePaymentWizard,
	type PaymentMethod,
	type PurchaseType,
	type WizardCourse,
	type WizardPaymentPlan,
	type WizardStudent
} from '$lib/payments.js';
import type { Actions, PageServerLoad } from './$types.js';

function parseWizardForm(formData: FormData) {
	return {
		studentId: String(formData.get('studentId') ?? ''),
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

async function loadClassOptions(db: ReturnType<typeof getDb>): Promise<WizardCourse[]> {
	const rows = await db
		.select({
			id: groups.id,
			name: programs.name,
			schedule: groups.schedule
		})
		.from(groups)
		.innerJoin(programs, eq(groups.programId, programs.id))
		.orderBy(programs.name);

	return rows.map((row) => ({
		id: row.id,
		name: `${row.name} — ${row.schedule}`
	}));
}

export const load: PageServerLoad = async () => {
	const db = getDb();

	const [studentRows, classRows, planRows] = await Promise.all([
		db
			.select({
				id: students.id,
				fullName: students.fullName,
				phone: students.phone
			})
			.from(students)
			.where(eq(students.active, true)),
		loadClassOptions(db),
		db.select().from(paymentPlans)
	]);

	return {
		students: studentRows as WizardStudent[],
		courses: classRows,
		plans: planRows.map((plan) => ({
			id: plan.id,
			name: plan.name,
			description: plan.description,
			planType: plan.planType as PlanType,
			price: plan.price,
			billingPeriod: plan.billingPeriod as BillingPeriod,
			classesIncluded: plan.classesIncluded,
			hoursIncluded: plan.hoursIncluded
		})) satisfies WizardPaymentPlan[],
		paymentMethods: PAYMENT_METHODS
	};
};

export const actions: Actions = {
	register: async ({ request }) => {
		const formData = await request.formData();
		const wizardData = parseWizardForm(formData);
		const db = getDb();

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

		const { errors, studentId, courseId, monthlyPlanId, fullPassPlanId, dropInPlanId, discountPercent } =
			validatePaymentWizard(wizardData, plans, coursesList);

		if (Object.keys(errors).length > 0) {
			return fail(400, { errors, values: wizardData });
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

		redirect(303, '/dashboard/pagos');
	}
};
