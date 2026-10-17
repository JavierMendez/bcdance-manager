import type { PaymentPlanFormValues } from '$lib/payment-plans';
import { monthlyPlan, fullPassPlan, dropInPlan } from './classes';

export const planValues: PaymentPlanFormValues = {
	name: 'Mensual salsa', description: 'Plan de un mes', planType: 'monthly',
	price: '500', billingPeriod: 'Mensual', classesIncluded: '', hoursIncluded: ''
};
export const planCases = [
	{ type: 'monthly' as const, plan: monthlyPlan, values: planValues },
	{ type: 'full_pass' as const, plan: fullPassPlan, values: { ...planValues, name: fullPassPlan.name, planType: 'full_pass' as const, price: '700', hoursIncluded: '12' } },
	{ type: 'drop_in' as const, plan: dropInPlan, values: { ...planValues, name: dropInPlan.name, planType: 'drop_in' as const, price: '100', billingPeriod: 'Por clase' as const } }
];
