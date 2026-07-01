import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { paymentPlans, students } from '$lib/server/db/schema/index.js';
import type { BillingPeriod } from '$lib/payment-plans.js';
import type { PlanType } from '$lib/payment-plans.js';
import { PAYMENT_METHODS, type WizardPaymentPlan, type WizardStudent } from '$lib/payments.js';
import {
	loadClassOptions,
	registerPaymentWizard
} from '$lib/server/register-payment-wizard.js';
import type { Actions, PageServerLoad } from './$types.js';

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
		const db = getDb();

		return registerPaymentWizard(request, db, {
			redirectTo: '/dashboard/pagos'
		});
	}
};
