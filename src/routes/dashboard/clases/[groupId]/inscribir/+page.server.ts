import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import {
	groups,
	paymentPlans,
	programs,
	students
} from '$lib/server/db/schema/index.js';
import type { BillingPeriod } from '$lib/payment-plans.js';
import type { PlanType } from '$lib/payment-plans.js';
import { PAYMENT_METHODS, type WizardPaymentPlan, type WizardStudent } from '$lib/payments.js';
import {
	loadClassOptions,
	loadEnrolledStudentIds,
	registerPaymentWizard
} from '$lib/server/register-payment-wizard.js';
import type { Actions, PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ params }) => {
	const groupId = Number(params.groupId);

	if (!groupId) {
		error(404, 'Clase no encontrada');
	}

	const db = getDb();

	const [classRow, studentRows, classRows, planRows, enrolledStudentIds] = await Promise.all([
		db
			.select({
				id: groups.id,
				name: programs.name,
				schedule: groups.schedule
			})
			.from(groups)
			.innerJoin(programs, eq(groups.programId, programs.id))
			.where(eq(groups.id, groupId))
			.limit(1),
		db
			.select({
				id: students.id,
				fullName: students.fullName,
				phone: students.phone
			})
			.from(students)
			.where(eq(students.active, true)),
		loadClassOptions(db),
		db.select().from(paymentPlans),
		loadEnrolledStudentIds(db, groupId)
	]);

	const classGroup = classRow[0];

	if (!classGroup) {
		error(404, 'Clase no encontrada');
	}

	return {
		classGroup: {
			id: classGroup.id,
			name: `${classGroup.name} — ${classGroup.schedule}`
		},
		students: studentRows as WizardStudent[],
		enrolledStudentIds,
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
	register: async ({ request, params }) => {
		const groupId = Number(params.groupId);

		if (!groupId) {
			error(404, 'Clase no encontrada');
		}

		const db = getDb();

		return registerPaymentWizard(request, db, {
			requireStudent: true,
			redirectTo: `/dashboard/clases/${groupId}`,
			enrollmentGroupId: groupId
		});
	}
};
