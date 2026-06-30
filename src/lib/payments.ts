import type { BillingPeriod } from '$lib/payment-plans.js';
import { APP_LOCALE } from '$lib/locale.js';
import { formatPrice } from '$lib/payment-plans.js';

export const FULL_PASS_DEFAULT_HOURS = 12;
export const DROP_IN_DEFAULT_CLASSES = 1;
export const DROP_IN_GUEST_LABEL = 'Sin alumno';
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
	classesRemaining: number | null;
	active: boolean;
};

function hasActiveDropIn(entitlements: EntitlementSnapshot[]) {
	return entitlements.some(
		(entry) => entry.entitlementType === 'drop_in' && (entry.classesRemaining ?? 0) > 0
	);
}

function hasActiveFullPass(entitlements: EntitlementSnapshot[]) {
	return entitlements.some(
		(entry) => entry.entitlementType === 'full_pass' && (entry.hoursRemaining ?? 0) > 0
	);
}

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
	const activeFullPass = hasActiveFullPass(activeEntitlements);
	const activeDropIn = hasActiveDropIn(activeEntitlements);

	if (latestMonthlyEnd) {
		if (latestMonthlyEnd <= now) {
			return activeFullPass || activeDropIn ? 'vigente' : 'vencido';
		}

		const daysUntilExpiry =
			(latestMonthlyEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

		if (daysUntilExpiry <= PAYMENT_EXPIRING_SOON_DAYS) {
			return 'por_vencer';
		}

		return 'vigente';
	}

	return activeFullPass || activeDropIn ? 'vigente' : 'vencido';
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

export const PURCHASE_TYPES = ['monthly_only', 'full_pass_only', 'combined', 'drop_in_only'] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type PurchaseType = (typeof PURCHASE_TYPES)[number];
export type PlanType = 'monthly' | 'full_pass' | 'drop_in';

export type WizardStudent = {
	id: number;
	fullName: string;
	phone: string;
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
	dropInPlanId: string;
	paymentMethod: PaymentMethod;
	paidAt: string;
	discountPercent: string;
	notes: string;
};

export type PaymentTotals = {
	subtotalAmount: number;
	discountPercent: number;
	discountAmount: number;
	totalAmount: number;
};

export type SerializedPayment = {
	id: number;
	studentId: number | null;
	studentName: string;
	purchaseType: PurchaseType;
	subtotalAmount: number;
	discountPercent: number;
	totalAmount: number;
	paymentMethod: PaymentMethod;
	notes: string | null;
	paidAt: string;
	summary: string;
};

export const PURCHASE_TYPE_LABELS: Record<PurchaseType, string> = {
	monthly_only: 'Plan mensual para una clase',
	full_pass_only: 'Full pass (12 horas)',
	combined: 'Plan mensual + Full pass',
	drop_in_only: 'Clase suelta (por clase)'
};

export function getPurchaseTypeDescription(type: PurchaseType) {
	switch (type) {
		case 'monthly_only':
			return 'Acceso mensual a una clase específica.';
		case 'full_pass_only':
			return '12 horas disponibles para usar en cualquier clase.';
		case 'combined':
			return 'Combina un plan mensual para una clase y 12 horas de full pass.';
		case 'drop_in_only':
			return 'Pago por clase sin inscripción mensual. El alumno asiste con créditos de clase.';
	}
}

export function normalizeStudentId(value: string | number | null | undefined): number | null {
	const parsed = typeof value === 'number' ? value : Number(value);
	return parsed > 0 ? parsed : null;
}

export function validatePaymentWizard(
	data: PaymentWizardData,
	plans: WizardPaymentPlan[],
	courses: WizardCourse[]
) {
	const errors: Partial<Record<keyof PaymentWizardData, string>> = {};
	const studentId = normalizeStudentId(data.studentId);
	const purchaseType = data.purchaseType;
	const courseId = Number(data.courseId);
	const monthlyPlanId = Number(data.monthlyPlanId);
	const fullPassPlanId = Number(data.fullPassPlanId);
	const dropInPlanId = Number(data.dropInPlanId);
	const needsStudent = purchaseType !== 'drop_in_only';

	if (needsStudent && !studentId) {
		errors.studentId = 'Selecciona un alumno.';
	}

	if (!PURCHASE_TYPES.includes(purchaseType)) {
		errors.purchaseType = 'Selecciona un tipo de compra.';
	}

	const needsMonthly = purchaseType === 'monthly_only' || purchaseType === 'combined';
	const needsFullPass = purchaseType === 'full_pass_only' || purchaseType === 'combined';
	const needsDropIn = purchaseType === 'drop_in_only';

	if (needsMonthly) {
		if (!courseId) {
			errors.courseId = 'Selecciona una clase.';
		} else if (!courses.some((course) => course.id === courseId)) {
			errors.courseId = 'La clase seleccionada no es válida.';
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

	if (needsDropIn) {
		if (!courseId) {
			errors.courseId = 'Selecciona una clase.';
		} else if (!courses.some((course) => course.id === courseId)) {
			errors.courseId = 'La clase seleccionada no es válida.';
		}

		if (!dropInPlanId) {
			errors.dropInPlanId = 'Selecciona un plan por clase.';
		} else {
			const plan = plans.find((entry) => entry.id === dropInPlanId);
			if (!plan || plan.planType !== 'drop_in') {
				errors.dropInPlanId = 'El plan por clase seleccionado no es válido.';
			}
		}
	}

	if (!data.paymentMethod || !PAYMENT_METHODS.includes(data.paymentMethod)) {
		errors.paymentMethod = 'Selecciona un método de pago.';
	}

	if (!data.paidAt) {
		errors.paidAt = 'La fecha de pago es obligatoria.';
	}

	const discountPercent = parseDiscountPercent(data.discountPercent);
	if (Number.isNaN(discountPercent)) {
		errors.discountPercent = 'Ingresa un descuento válido entre 0 y 100.';
	}

	return {
		errors,
		studentId,
		courseId,
		monthlyPlanId,
		fullPassPlanId,
		dropInPlanId,
		discountPercent: Number.isNaN(discountPercent) ? 0 : discountPercent
	};
}

export function calculateWizardTotal(
	purchaseType: PurchaseType,
	plans: WizardPaymentPlan[],
	monthlyPlanId: number,
	fullPassPlanId: number,
	dropInPlanId: number
) {
	let total = 0;

	if (purchaseType === 'monthly_only' || purchaseType === 'combined') {
		total += plans.find((plan) => plan.id === monthlyPlanId)?.price ?? 0;
	}

	if (purchaseType === 'full_pass_only' || purchaseType === 'combined') {
		total += plans.find((plan) => plan.id === fullPassPlanId)?.price ?? 0;
	}

	if (purchaseType === 'drop_in_only') {
		total += plans.find((plan) => plan.id === dropInPlanId)?.price ?? 0;
	}

	return total;
}

export function parseDiscountPercent(value: string): number {
	const trimmed = value.trim();
	if (!trimmed) {
		return 0;
	}

	const parsed = Number(trimmed);
	if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
		return NaN;
	}

	return parsed;
}

export function calculatePaymentTotals(
	subtotalAmount: number,
	discountPercent: number
): PaymentTotals {
	const discountAmount = Math.round(subtotalAmount * discountPercent / 100);
	const totalAmount = subtotalAmount - discountAmount;

	return {
		subtotalAmount,
		discountPercent,
		discountAmount,
		totalAmount
	};
}

export function formatDiscountPercent(discountPercent: number) {
	return `${discountPercent}%`;
}

export function buildPaymentSummary(
	purchaseType: PurchaseType,
	studentName: string,
	courseName: string | null,
	monthlyPlanName: string | null,
	fullPassPlanName: string | null,
	dropInPlanName: string | null,
	dropInClasses: number | null,
	totals: PaymentTotals
) {
	const parts: string[] = [studentName || DROP_IN_GUEST_LABEL];

	if (purchaseType === 'monthly_only' || purchaseType === 'combined') {
		parts.push(`Plan mensual: ${monthlyPlanName} (${courseName})`);
	}

	if (purchaseType === 'full_pass_only' || purchaseType === 'combined') {
		parts.push(`Full pass: ${fullPassPlanName} (${FULL_PASS_DEFAULT_HOURS} h)`);
	}

	if (purchaseType === 'drop_in_only') {
		const classes = dropInClasses ?? DROP_IN_DEFAULT_CLASSES;
		parts.push(
			`Clase suelta: ${dropInPlanName} (${courseName}) — ${classes} clase${classes === 1 ? '' : 's'}`
		);
	}

	if (totals.discountPercent > 0) {
		parts.push(
			`Descuento ${formatDiscountPercent(totals.discountPercent)} (-${formatPrice(totals.discountAmount)})`
		);
	}

	parts.push(formatPrice(totals.totalAmount));
	return parts.join(' · ');
}

export type QuickDropInFormData = {
	studentId: string;
	dropInPlanId: string;
	paymentMethod: PaymentMethod;
	discountPercent: string;
	notes: string;
};

export function validateQuickDropInRegistration(
	data: QuickDropInFormData,
	plans: WizardPaymentPlan[],
	eligibleStudentIds: number[]
) {
	const errors: Partial<Record<keyof QuickDropInFormData, string>> = {};
	const studentId = normalizeStudentId(data.studentId);
	const dropInPlanId = Number(data.dropInPlanId);

	if (studentId && !eligibleStudentIds.includes(studentId)) {
		errors.studentId = 'El alumno seleccionado no está disponible para esta clase.';
	}

	if (!dropInPlanId) {
		errors.dropInPlanId = 'Selecciona un plan por clase.';
	} else {
		const plan = plans.find((entry) => entry.id === dropInPlanId);
		if (!plan || plan.planType !== 'drop_in') {
			errors.dropInPlanId = 'El plan por clase seleccionado no es válido.';
		}
	}

	if (!data.paymentMethod || !PAYMENT_METHODS.includes(data.paymentMethod)) {
		errors.paymentMethod = 'Selecciona un método de pago.';
	}

	const discountPercent = parseDiscountPercent(data.discountPercent);
	if (Number.isNaN(discountPercent)) {
		errors.discountPercent = 'Ingresa un descuento válido entre 0 y 100.';
	}

	return {
		errors,
		studentId,
		dropInPlanId,
		discountPercent: Number.isNaN(discountPercent) ? 0 : discountPercent
	};
}

export function formatStudentName(studentName: string | null | undefined) {
	return studentName || DROP_IN_GUEST_LABEL;
}

export function formatPaymentDate(isoDate: string) {
	return new Intl.DateTimeFormat(APP_LOCALE, {
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
