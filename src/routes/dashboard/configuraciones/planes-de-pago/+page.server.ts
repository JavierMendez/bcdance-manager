import { fail } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import { paymentPlans } from '$lib/server/db/schema/index.js';
import {
	validatePaymentPlanInput,
	type BillingPeriod,
	type PlanType,
	type SerializedPaymentPlan
} from '$lib/payment-plans.js';
import type { Actions, PageServerLoad } from './$types.js';

function serializePaymentPlan(
	plan: typeof paymentPlans.$inferSelect
): SerializedPaymentPlan {
	return {
		id: plan.id,
		name: plan.name,
		description: plan.description,
		planType: plan.planType as PlanType,
		price: plan.price,
		billingPeriod: plan.billingPeriod as BillingPeriod,
		classesIncluded: plan.classesIncluded,
		hoursIncluded: plan.hoursIncluded
	};
}

function parsePaymentPlanForm(formData: FormData) {
	return validatePaymentPlanInput({
		name: String(formData.get('name') ?? ''),
		description: String(formData.get('description') ?? ''),
		planType: String(formData.get('planType') ?? 'monthly') as PlanType,
		price: String(formData.get('price') ?? ''),
		billingPeriod: String(formData.get('billingPeriod') ?? '') as BillingPeriod,
		classesIncluded: String(formData.get('classesIncluded') ?? ''),
		hoursIncluded: String(formData.get('hoursIncluded') ?? '')
	});
}

export const load: PageServerLoad = async () => {
	const db = getDb();
	const rows = await db.select().from(paymentPlans).orderBy(desc(paymentPlans.createdAt));

	return {
		paymentPlans: rows.map(serializePaymentPlan)
	};
};

export const actions: Actions = {
	create: async ({ request }) => {
		const formData = await request.formData();
		const { errors, values, parsed } = parsePaymentPlanForm(formData);

		if (Object.keys(errors).length > 0) {
			return fail(400, { errors, values, mode: 'create' as const });
		}

		const db = getDb();

		const [created] = await db
			.insert(paymentPlans)
			.values({
				name: parsed.name,
				description: parsed.description,
				planType: parsed.planType,
				price: parsed.price,
				billingPeriod: parsed.billingPeriod,
				classesIncluded: parsed.classesIncluded,
				hoursIncluded: parsed.hoursIncluded,
				updatedAt: new Date()
			})
			.returning();

		return {
			success: true,
			mode: 'create' as const,
			paymentPlan: serializePaymentPlan(created)
		};
	},

	update: async ({ request }) => {
		const formData = await request.formData();
		const id = Number(formData.get('id'));
		const { errors, values, parsed } = parsePaymentPlanForm(formData);

		if (!id) {
			return fail(400, { message: 'Plan de pago no válido.' });
		}

		if (Object.keys(errors).length > 0) {
			return fail(400, { errors, values, mode: 'edit' as const, id });
		}

		const db = getDb();

		const [updated] = await db
			.update(paymentPlans)
			.set({
				name: parsed.name,
				description: parsed.description,
				planType: parsed.planType,
				price: parsed.price,
				billingPeriod: parsed.billingPeriod,
				classesIncluded: parsed.classesIncluded,
				hoursIncluded: parsed.hoursIncluded,
				updatedAt: new Date()
			})
			.where(eq(paymentPlans.id, id))
			.returning();

		if (!updated) {
			return fail(404, { message: 'Plan de pago no encontrado.' });
		}

		return {
			success: true,
			mode: 'edit' as const,
			paymentPlan: serializePaymentPlan(updated)
		};
	}
};
