import type { BillingPeriod } from '$lib/payment-plans.js';
import { APP_LOCALE, APP_TIMEZONE } from '$lib/locale.js';
import { formatPrice } from '$lib/payment-plans.js';

export const FULL_PASS_DEFAULT_HOURS = 12;
export const DROP_IN_DEFAULT_CLASSES = 1;
export const DROP_IN_GUEST_LABEL = 'Sin alumno';
export const PAYMENT_EXPIRING_SOON_DAYS = 7;

export function getFullPassExpiringSoonThreshold(
	hoursIncluded: number | null = FULL_PASS_DEFAULT_HOURS
) {
	const total = hoursIncluded ?? FULL_PASS_DEFAULT_HOURS;
	return Math.max(1, Math.ceil(total * (PAYMENT_EXPIRING_SOON_DAYS / 30)));
}

export function addOneMonth(date: Date) {
	const next = new Date(date);
	next.setMonth(next.getMonth() + 1);
	return next;
}

export function resolveFullPassEndsAt(startsAt: Date | null | undefined, endsAt: Date | null) {
	if (endsAt) {
		return endsAt;
	}

	if (startsAt) {
		return addOneMonth(startsAt);
	}

	return null;
}

export function getEffectiveFullPassHours(
	hoursRemaining: number | null,
	startsAt: Date | null | undefined,
	endsAt: Date | null,
	now = new Date()
) {
	const resolvedEndsAt = resolveFullPassEndsAt(startsAt, endsAt);

	if (resolvedEndsAt && resolvedEndsAt <= now) {
		return 0;
	}

	return hoursRemaining ?? 0;
}

export function isFullPassEntitlementVigente(
	hoursRemaining: number | null,
	startsAt: Date | null | undefined,
	endsAt: Date | null,
	now = new Date()
) {
	return getEffectiveFullPassHours(hoursRemaining, startsAt, endsAt, now) > 0;
}

export function isFullPassExpiringSoon(
	hoursRemaining: number | null,
	hoursIncluded: number | null = FULL_PASS_DEFAULT_HOURS
) {
	const hours = hoursRemaining ?? 0;

	if (hours <= 0) {
		return false;
	}

	return hours <= getFullPassExpiringSoonThreshold(hoursIncluded);
}

export type PaymentStatus = 'vigente' | 'por_vencer' | 'vencido';

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
	vigente: 'Vigente',
	por_vencer: 'Por vencer',
	vencido: 'Vencido'
};

export type EntitlementSnapshot = {
	entitlementType: string;
	startsAt?: Date | null;
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

function hasActiveFullPass(entitlements: EntitlementSnapshot[], now = new Date()) {
	return entitlements.some(
		(entry) =>
			entry.entitlementType === 'full_pass' &&
			isFullPassEntitlementVigente(entry.hoursRemaining, entry.startsAt, entry.endsAt, now)
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
	const activeFullPass = hasActiveFullPass(activeEntitlements, now);
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
	phone: string | null;
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

export type EnrollmentModalityOption = {
	key: string;
	purchaseType: PurchaseType;
	monthlyPlanId: string;
	fullPassPlanId: string;
	dropInPlanId: string;
	title: string;
	description: string;
	price: number;
};

export function buildEnrollmentModalityOptions(
	monthlyPlans: WizardPaymentPlan[],
	fullPassPlans: WizardPaymentPlan[],
	dropInPlans: WizardPaymentPlan[]
): EnrollmentModalityOption[] {
	const options: EnrollmentModalityOption[] = [];

	for (const plan of monthlyPlans) {
		options.push({
			key: `monthly:${plan.id}`,
			purchaseType: 'monthly_only',
			monthlyPlanId: String(plan.id),
			fullPassPlanId: '',
			dropInPlanId: '',
			title: plan.name,
			description: plan.description || 'Acceso mensual a esta clase.',
			price: plan.price
		});
	}

	for (const plan of fullPassPlans) {
		const hours = plan.hoursIncluded ?? FULL_PASS_DEFAULT_HOURS;
		options.push({
			key: `full_pass:${plan.id}`,
			purchaseType: 'full_pass_only',
			monthlyPlanId: '',
			fullPassPlanId: String(plan.id),
			dropInPlanId: '',
			title: plan.name,
			description: plan.description || `${hours} horas para usar en cualquier clase.`,
			price: plan.price
		});
	}

	for (const plan of dropInPlans) {
		const classes = plan.classesIncluded ?? DROP_IN_DEFAULT_CLASSES;
		options.push({
			key: `drop_in:${plan.id}`,
			purchaseType: 'drop_in_only',
			monthlyPlanId: '',
			fullPassPlanId: '',
			dropInPlanId: String(plan.id),
			title: plan.name,
			description:
				plan.description ||
				`Pago por clase (${classes} clase${classes === 1 ? '' : 's'} incluida${classes === 1 ? '' : 's'}).`,
			price: plan.price
		});
	}

	for (const monthly of monthlyPlans) {
		for (const fullPass of fullPassPlans) {
			options.push({
				key: `combined:${monthly.id}:${fullPass.id}`,
				purchaseType: 'combined',
				monthlyPlanId: String(monthly.id),
				fullPassPlanId: String(fullPass.id),
				dropInPlanId: '',
				title: `${monthly.name} + ${fullPass.name}`,
				description: 'Plan mensual para esta clase y horas de full pass.',
				price: monthly.price + fullPass.price
			});
		}
	}

	return options;
}

export function getEnrollmentModalityKey(data: {
	purchaseType: PurchaseType;
	monthlyPlanId: string;
	fullPassPlanId: string;
	dropInPlanId: string;
}): string {
	if (data.purchaseType === 'monthly_only' && data.monthlyPlanId) {
		return `monthly:${data.monthlyPlanId}`;
	}

	if (data.purchaseType === 'full_pass_only' && data.fullPassPlanId) {
		return `full_pass:${data.fullPassPlanId}`;
	}

	if (data.purchaseType === 'drop_in_only' && data.dropInPlanId) {
		return `drop_in:${data.dropInPlanId}`;
	}

	if (data.purchaseType === 'combined' && data.monthlyPlanId && data.fullPassPlanId) {
		return `combined:${data.monthlyPlanId}:${data.fullPassPlanId}`;
	}

	return '';
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

export function parseDiscountPercent(value: string | number | null | undefined): number {
	const trimmed = String(value ?? '').trim();
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
		minute: '2-digit',
		timeZone: APP_TIMEZONE
	}).format(new Date(isoDate));
}

export const PAYMENT_LIST_PAGE_SIZE = 20;

export type PaymentListFilters = {
	q: string;
	type: PurchaseType | '';
	method: PaymentMethod | '';
	from: string;
	to: string;
};

export type PaymentListPagination = {
	page: number;
	pageSize: number;
	total: number;
	totalPages: number;
};

function isValidFilterDate(value: string) {
	return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function parsePaymentListFilters(searchParams: URLSearchParams): PaymentListFilters {
	const q = (searchParams.get('q') ?? '').trim();
	const typeParam = searchParams.get('type') ?? '';
	const methodParam = searchParams.get('method') ?? '';
	const fromParam = searchParams.get('from') ?? '';
	const toParam = searchParams.get('to') ?? '';

	const type = PURCHASE_TYPES.includes(typeParam as PurchaseType)
		? (typeParam as PurchaseType)
		: '';
	const method = PAYMENT_METHODS.includes(methodParam as PaymentMethod)
		? (methodParam as PaymentMethod)
		: '';

	let from = isValidFilterDate(fromParam) ? fromParam : '';
	let to = isValidFilterDate(toParam) ? toParam : '';

	if (from && to && from > to) {
		[from, to] = [to, from];
	}

	return { q, type, method, from, to };
}

/** Una sola fecha (Desde o Hasta) filtra ese día; ambas forman un rango inclusivo. */
export function resolvePaymentListDateRange(filters: PaymentListFilters) {
	if (filters.from && filters.to) {
		return { from: filters.from, to: filters.to };
	}

	if (filters.from) {
		return { from: filters.from, to: filters.from };
	}

	if (filters.to) {
		return { from: filters.to, to: filters.to };
	}

	return { from: '', to: '' };
}

export function parsePaymentListPage(searchParams: URLSearchParams) {
	const page = Number(searchParams.get('page'));

	if (!Number.isInteger(page) || page < 1) {
		return 1;
	}

	return page;
}

export function paymentListHasActiveFilters(filters: PaymentListFilters) {
	return Boolean(filters.q || filters.type || filters.method || filters.from || filters.to);
}

export function buildPaymentListSearchParams(filters: PaymentListFilters, page: number) {
	const params = new URLSearchParams();

	if (filters.q) {
		params.set('q', filters.q);
	}

	if (filters.type) {
		params.set('type', filters.type);
	}

	if (filters.method) {
		params.set('method', filters.method);
	}

	if (filters.from) {
		params.set('from', filters.from);
	}

	if (filters.to) {
		params.set('to', filters.to);
	}

	if (page > 1) {
		params.set('page', String(page));
	}

	return params;
}
