export const BILLING_PERIODS = [
	'Mensual',
	'Trimestral',
	'Semestral',
	'Anual',
	'Por clase'
] as const;

export type BillingPeriod = (typeof BILLING_PERIODS)[number];

export type SerializedPaymentPlan = {
	id: number;
	name: string;
	description: string;
	planType: PlanType;
	price: number;
	billingPeriod: BillingPeriod;
	classesIncluded: number | null;
	hoursIncluded: number | null;
};

export type PlanType = 'monthly' | 'full_pass' | 'drop_in';

export const PLAN_TYPES = [
	{ value: 'monthly' as const, label: 'Plan mensual' },
	{ value: 'full_pass' as const, label: 'Full pass' },
	{ value: 'drop_in' as const, label: 'Por clase' }
];

export type PaymentPlanFormValues = {
	name: string;
	description: string;
	planType: PlanType;
	price: string;
	billingPeriod: BillingPeriod;
	classesIncluded: string;
	hoursIncluded: string;
};

export function validatePaymentPlanInput(data: PaymentPlanFormValues) {
	const errors: Record<string, string> = {};
	const name = data.name.trim();
	const description = data.description.trim();
	const priceValue = data.price.trim();
	const billingPeriod = data.billingPeriod;
	const planType = data.planType;
	const classesIncludedValue = data.classesIncluded.trim();
	const hoursIncludedValue = data.hoursIncluded.trim();

	if (!name) {
		errors.name = 'El nombre es obligatorio.';
	}

	if (!description) {
		errors.description = 'La descripción es obligatoria.';
	}

	if (!priceValue) {
		errors.price = 'El precio es obligatorio.';
	} else {
		const price = Number(priceValue);
		if (!Number.isFinite(price) || price <= 0) {
			errors.price = 'Ingresa un precio válido mayor a cero.';
		}
	}

	if (!BILLING_PERIODS.includes(billingPeriod)) {
		errors.billingPeriod = 'Selecciona una periodicidad válida.';
	}

	if (planType !== 'monthly' && planType !== 'full_pass' && planType !== 'drop_in') {
		errors.planType = 'Selecciona un tipo de plan válido.';
	}

	let classesIncluded: number | null = null;
	let hoursIncluded: number | null = null;

	if (planType === 'monthly' && classesIncludedValue) {
		const parsed = Number(classesIncludedValue);
		if (!Number.isInteger(parsed) || parsed <= 0) {
			errors.classesIncluded = 'Ingresa una cantidad de clases válida.';
		} else {
			classesIncluded = parsed;
		}
	}

	if (planType === 'full_pass') {
		if (!hoursIncludedValue) {
			errors.hoursIncluded = 'Las horas incluidas son obligatorias para full pass.';
		} else {
			const parsed = Number(hoursIncludedValue);
			if (!Number.isInteger(parsed) || parsed <= 0) {
				errors.hoursIncluded = 'Ingresa una cantidad de horas válida.';
			} else {
				hoursIncluded = parsed;
			}
		}
	}

	if (planType === 'drop_in') {
		if (!classesIncludedValue) {
			classesIncluded = 1;
		} else {
			const parsed = Number(classesIncludedValue);
			if (!Number.isInteger(parsed) || parsed <= 0) {
				errors.classesIncluded = 'Ingresa una cantidad de clases válida.';
			} else {
				classesIncluded = parsed;
			}
		}
	}

	return {
		errors,
		values: {
			name,
			description,
			planType,
			price: priceValue,
			billingPeriod,
			classesIncluded: classesIncludedValue,
			hoursIncluded: hoursIncludedValue
		},
		parsed: {
			name,
			description,
			planType,
			price: Number(priceValue),
			billingPeriod,
			classesIncluded,
			hoursIncluded
		}
	};
}

import { APP_LOCALE, PAYMENT_CURRENCY } from '$lib/locale.js';

export function formatPrice(price: number) {
	return new Intl.NumberFormat(APP_LOCALE, {
		style: 'currency',
		currency: PAYMENT_CURRENCY,
		maximumFractionDigits: 0
	}).format(price);
}

export function formatClassesIncluded(classesIncluded: number | null) {
	return classesIncluded ? `${classesIncluded} clases` : '—';
}

export function formatHoursIncluded(hoursIncluded: number | null) {
	return hoursIncluded ? `${hoursIncluded} horas` : '—';
}

export function formatPlanType(planType: PlanType) {
	switch (planType) {
		case 'monthly':
			return 'Plan mensual';
		case 'full_pass':
			return 'Full pass';
		case 'drop_in':
			return 'Por clase';
	}
}
