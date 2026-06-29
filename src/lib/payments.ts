import type { BillingPeriod } from '$lib/payment-plans.js';
import { formatPrice } from '$lib/payment-plans.js';

export const FULL_PASS_DEFAULT_HOURS = 12;
export const PAYMENT_EXPIRING_SOON_DAYS = 7;

export type PaymentStatus = 'vigente' | 'por_vencer' | 'vencido';

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
	vigente: 'Vigente',
	por_vencer: 'Por vencer',
	vencido: 'Vencido'
};

export type EntitlementSnapshot = {
	entitlementType: string;
	endsAt: Date | null;
	hoursRemaining: number | null;
	active: boolean;
};

export function resolvePaymentStatus(
	entitlements: EntitlementSnapshot[],
	now = new Date()
): PaymentStatus {
	const activeEntitlements = entitlements.filter((entry) => entry.active);

	const monthlyEndsAt = activeEntitlements
		.filter((entry) => entry.entitlementType === 'monthly_plan' && entry.endsAt)
		.map((entry) => entry.endsAt!)
		.sort((a, b) => b.getTime() - a.getTime());

	const latestMonthlyEnd = monthlyEndsAt[0];
	const hasActiveFullPass = activeEntitlements.some(
		(entry) => entry.entitlementType === 'full_pass' && (entry.hoursRemaining ?? 0) > 0
	);

	if (latestMonthlyEnd) {
		if (latestMonthlyEnd <= now) {
			return hasActiveFullPass ? 'vigente' : 'vencido';
		}

		const daysUntilExpiry =
			(latestMonthlyEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

		if (daysUntilExpiry <= PAYMENT_EXPIRING_SOON_DAYS) {
			return 'por_vencer';
		}

		return 'vigente';
	}

	return hasActiveFullPass ? 'vigente' : 'vencido';
}

export function getPaymentStatusBadgeVariant(
	status: PaymentStatus
): 'default' | 'secondary' | 'destructive' {
	switch (status) {
		case 'vigente':
			return 'default';
		case 'por_vencer':
			return 'secondary';
		case 'vencido':
			return 'destructive';
	}
}

export const PAYMENT_METHODS = [
	'Efectivo',
	'Transferencia',
	'Tarjeta débito',
	'Tarjeta crédito',
	'Otro'
] as const;

export const PURCHASE_TYPES = ['monthly_only', 'full_pass_only', 'combined'] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type PurchaseType = (typeof PURCHASE_TYPES)[number];
export type PlanType = 'monthly' | 'full_pass';

export type WizardStudent = {
	id: number;
	fullName: string;
	email: string;
};

export type WizardCourse = {
	id: number;
	name: string;
};

export type WizardPaymentPlan = {
	id: number;
	name: string;
	description: string;
	planType: PlanType;
	price: number;
	billingPeriod: BillingPeriod;
	classesIncluded: number | null;
	hoursIncluded: number | null;
};

export type PaymentWizardData = {
	studentId: string;
	purchaseType: PurchaseType;
	courseId: string;
	monthlyPlanId: string;
	fullPassPlanId: string;
	paymentMethod: PaymentMethod;
	paidAt: string;
	notes: string;
};

export type SerializedPayment = {
	id: number;
	studentId: number;
	studentName: string;
	purchaseType: PurchaseType;
	totalAmount: number;
	paymentMethod: PaymentMethod;
	notes: string | null;
	paidAt: string;
	summary: string;
};

export const PURCHASE_TYPE_LABELS: Record<PurchaseType, string> = {
	monthly_only: 'Plan mensual para un curso',
	full_pass_only: 'Full pass (12 horas)',
	combined: 'Plan mensual + Full pass'
};

export function getPurchaseTypeDescription(type: PurchaseType) {
	switch (type) {
		case 'monthly_only':
			return 'Acceso mensual a un curso específico del catálogo.';
		case 'full_pass_only':
			return '12 horas disponibles para usar en cualquier curso.';
		case 'combined':
			return 'Combina un plan mensual para un curso y 12 horas de full pass.';
	}
}

export function validatePaymentWizard(
	data: PaymentWizardData,
	plans: WizardPaymentPlan[],
	courses: WizardCourse[]
) {
	const errors: Partial<Record<keyof PaymentWizardData, string>> = {};
	const studentId = Number(data.studentId);
	const purchaseType = data.purchaseType;
	const courseId = Number(data.courseId);
	const monthlyPlanId = Number(data.monthlyPlanId);
	const fullPassPlanId = Number(data.fullPassPlanId);

	if (!studentId) {
		errors.studentId = 'Selecciona un alumno.';
	}

	if (!PURCHASE_TYPES.includes(purchaseType)) {
		errors.purchaseType = 'Selecciona un tipo de compra.';
	}

	const needsMonthly = purchaseType === 'monthly_only' || purchaseType === 'combined';
	const needsFullPass = purchaseType === 'full_pass_only' || purchaseType === 'combined';

	if (needsMonthly) {
		if (!courseId) {
			errors.courseId = 'Selecciona un curso.';
		} else if (!courses.some((course) => course.id === courseId)) {
			errors.courseId = 'El curso seleccionado no es válido.';
		}

		if (!monthlyPlanId) {
			errors.monthlyPlanId = 'Selecciona un plan mensual.';
		} else {
			const plan = plans.find((entry) => entry.id === monthlyPlanId);
			if (!plan || plan.planType !== 'monthly') {
				errors.monthlyPlanId = 'El plan mensual seleccionado no es válido.';
			}
		}
	}

	if (needsFullPass) {
		if (!fullPassPlanId) {
			errors.fullPassPlanId = 'Selecciona un plan full pass.';
		} else {
			const plan = plans.find((entry) => entry.id === fullPassPlanId);
			if (!plan || plan.planType !== 'full_pass') {
				errors.fullPassPlanId = 'El plan full pass seleccionado no es válido.';
			}
		}
	}

	if (!data.paymentMethod || !PAYMENT_METHODS.includes(data.paymentMethod)) {
		errors.paymentMethod = 'Selecciona un método de pago.';
	}

	if (!data.paidAt) {
		errors.paidAt = 'La fecha de pago es obligatoria.';
	}

	return { errors, studentId, courseId, monthlyPlanId, fullPassPlanId };
}

export function calculateWizardTotal(
	purchaseType: PurchaseType,
	plans: WizardPaymentPlan[],
	monthlyPlanId: number,
	fullPassPlanId: number
) {
	let total = 0;

	if (purchaseType === 'monthly_only' || purchaseType === 'combined') {
		total += plans.find((plan) => plan.id === monthlyPlanId)?.price ?? 0;
	}

	if (purchaseType === 'full_pass_only' || purchaseType === 'combined') {
		total += plans.find((plan) => plan.id === fullPassPlanId)?.price ?? 0;
	}

	return total;
}

export function buildPaymentSummary(
	purchaseType: PurchaseType,
	studentName: string,
	courseName: string | null,
	monthlyPlanName: string | null,
	fullPassPlanName: string | null,
	totalAmount: number
) {
	const parts: string[] = [studentName];

	if (purchaseType === 'monthly_only' || purchaseType === 'combined') {
		parts.push(`Plan mensual: ${monthlyPlanName} (${courseName})`);
	}

	if (purchaseType === 'full_pass_only' || purchaseType === 'combined') {
		parts.push(`Full pass: ${fullPassPlanName} (${FULL_PASS_DEFAULT_HOURS} h)`);
	}

	parts.push(formatPrice(totalAmount));
	return parts.join(' · ');
}

export function formatPaymentDate(isoDate: string) {
	return new Intl.DateTimeFormat('es-CL', {
		day: '2-digit',
		month: 'long',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	}).format(new Date(isoDate));
}

export function addOneMonth(date: Date) {
	const next = new Date(date);
	next.setMonth(next.getMonth() + 1);
	return next;
}
