import { formatPrice } from '$lib/payment-plans.js';
import { APP_LOCALE, APP_TIMEZONE, getCalendarDateInAppTimezone } from '$lib/locale.js';
import {
	formatStudentName,
	PAYMENT_METHODS,
	PURCHASE_TYPE_LABELS,
	type PaymentMethod,
	type PurchaseType
} from '$lib/payments.js';

export const EXPENSE_CATEGORIES = [
	'renta',
	'insumos',
	'personal',
	'servicios',
	'marketing',
	'otro'
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export type CashFlowPeriodPreset =
	| 'this_month'
	| 'last_month'
	| 'last_3_months'
	| 'last_6_months'
	| 'custom';

export const CASH_FLOW_PERIOD_PRESETS: {
	value: CashFlowPeriodPreset;
	label: string;
}[] = [
	{ value: 'this_month', label: 'Este mes' },
	{ value: 'last_month', label: 'Mes anterior' },
	{ value: 'last_3_months', label: 'Últimos 3 meses' },
	{ value: 'last_6_months', label: 'Últimos 6 meses' },
	{ value: 'custom', label: 'Rango personalizado' }
];

export type CashFlowPeriod = {
	preset: CashFlowPeriodPreset;
	from: string;
	to: string;
	label: string;
};

export type CashFlowIncomeRow = {
	id: number;
	studentName: string;
	purchaseType: PurchaseType;
	totalAmount: number;
	paymentMethod: PaymentMethod;
	paidAt: Date;
};

export type CashFlowExpenseRow = {
	id: number;
	amount: number;
	category: ExpenseCategory;
	description: string;
	paymentMethod: PaymentMethod;
	paidAt: Date;
};

export type CashFlowAdditionalIncomeRow = {
	id: number;
	amount: number;
	description: string;
	paymentMethod: PaymentMethod;
	paidAt: Date;
};

export type CashFlowMovementSourceKind = 'payment' | 'additional_income' | 'expense';

export type CashFlowMovement = {
	id: string;
	sourceId: number;
	sourceKind: CashFlowMovementSourceKind;
	type: 'income' | 'expense';
	amount: number;
	label: string;
	detail: string;
	paymentMethod: string;
	paidAt: string;
	paidAtLabel: string;
};

export type CashFlowCategoryBreakdown = {
	category: ExpenseCategory;
	label: string;
	amount: number;
	percentage: number;
};

export type CashFlowChartPoint = {
	key: string;
	label: string;
	fullLabel: string;
	income: number;
	expenses: number;
	net: number;
};

export type CashFlowSummary = {
	totalIncome: number;
	totalExpenses: number;
	netCashFlow: number;
	incomeCount: number;
	expenseCount: number;
	categoryBreakdown: CashFlowCategoryBreakdown[];
	chartPoints: CashFlowChartPoint[];
	chartDisplayPoints: CashFlowChartPoint[];
	movements: CashFlowMovement[];
};

export type ExpenseFormValues = {
	amount: string;
	category: ExpenseCategory | '';
	description: string;
	paymentMethod: PaymentMethod;
	paidAt: string;
};

export type AdditionalIncomeFormValues = {
	amount: string;
	description: string;
	paymentMethod: PaymentMethod;
	paidAt: string;
};

export const ADDITIONAL_INCOME_DETAIL_LABEL = 'Ingreso adicional';

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
	renta: 'Renta',
	insumos: 'Insumos',
	personal: 'Pagos a personal',
	servicios: 'Servicios',
	marketing: 'Marketing',
	otro: 'Otro'
};

function isValidDateString(value: string) {
	return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseCalendarDate(dateValue: string) {
	const [year, month, day] = dateValue.split('-').map(Number);
	return { year, month, day };
}

function formatCalendarDate(year: number, month: number, day: number) {
	return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function addMonths(year: number, month: number, offset: number) {
	const date = new Date(year, month - 1 + offset, 1);
	return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

function getMonthEnd(year: number, month: number) {
	return new Date(year, month, 0).getDate();
}

function formatPeriodLabel(from: string, to: string) {
	if (from === to) {
		return formatCashFlowDate(from);
	}

	const fromParts = parseCalendarDate(from);
	const toParts = parseCalendarDate(to);

	if (fromParts.year === toParts.year && fromParts.month === toParts.month) {
		const monthLabel = new Intl.DateTimeFormat(APP_LOCALE, {
			month: 'long',
			year: 'numeric',
			timeZone: 'UTC'
		}).format(new Date(`${from}T12:00:00.000Z`));

		return `${fromParts.day}–${toParts.day} de ${monthLabel}`;
	}

	return `${formatCashFlowDate(from)} – ${formatCashFlowDate(to)}`;
}

export function resolveCashFlowPeriod(
	searchParams: URLSearchParams,
	now = new Date()
): CashFlowPeriod {
	const today = getCalendarDateInAppTimezone(now);
	const presetParam = searchParams.get('preset');
	const fromParam = searchParams.get('from');
	const toParam = searchParams.get('to');

	let preset: CashFlowPeriodPreset =
		presetParam === 'last_month' ||
		presetParam === 'last_3_months' ||
		presetParam === 'last_6_months' ||
		presetParam === 'custom'
			? presetParam
			: 'this_month';

	if (fromParam && toParam && isValidDateString(fromParam) && isValidDateString(toParam)) {
		const from = fromParam <= toParam ? fromParam : toParam;
		const to = fromParam <= toParam ? toParam : fromParam;
		return {
			preset: preset === 'custom' ? 'custom' : preset,
			from,
			to,
			label: formatPeriodLabel(from, to)
		};
	}

	const todayParts = parseCalendarDate(today);

	if (preset === 'last_month') {
		const previous = addMonths(todayParts.year, todayParts.month, -1);
		const from = formatCalendarDate(previous.year, previous.month, 1);
		const to = formatCalendarDate(
			previous.year,
			previous.month,
			getMonthEnd(previous.year, previous.month)
		);

		return { preset, from, to, label: formatPeriodLabel(from, to) };
	}

	if (preset === 'last_3_months' || preset === 'last_6_months') {
		const monthsBack = preset === 'last_3_months' ? 2 : 5;
		const start = addMonths(todayParts.year, todayParts.month, -monthsBack);
		const from = formatCalendarDate(start.year, start.month, 1);
		return {
			preset,
			from,
			to: today,
			label: formatPeriodLabel(from, today)
		};
	}

	const from = formatCalendarDate(todayParts.year, todayParts.month, 1);
	return {
		preset: 'this_month',
		from,
		to: today,
		label: formatPeriodLabel(from, today)
	};
}

export function formatCashFlowDate(dateValue: string) {
	return new Intl.DateTimeFormat(APP_LOCALE, {
		day: '2-digit',
		month: 'short',
		year: 'numeric',
		timeZone: 'UTC'
	}).format(new Date(`${dateValue}T12:00:00.000Z`));
}

export function formatCashFlowDateTime(isoDate: string) {
	return new Intl.DateTimeFormat(APP_LOCALE, {
		day: '2-digit',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		timeZone: APP_TIMEZONE
	}).format(new Date(isoDate));
}

export function formatCashFlowChartAxisLabel(key: string) {
	if (/^\d{4}-\d{2}$/.test(key)) {
		return new Intl.DateTimeFormat(APP_LOCALE, {
			month: 'short',
			timeZone: 'UTC'
		})
			.format(new Date(`${key}-01T12:00:00.000Z`))
			.replace('.', '');
	}

	return new Intl.DateTimeFormat(APP_LOCALE, {
		day: '2-digit',
		month: 'short',
		timeZone: 'UTC'
	}).format(new Date(`${key}T12:00:00.000Z`));
}

export function formatCashFlowCurrency(amount: number) {
	return formatPrice(amount);
}

export function getExpenseCategoryLabel(category: ExpenseCategory) {
	return EXPENSE_CATEGORY_LABELS[category];
}

function getCalendarDateInTimezone(date: Date) {
	return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE }).format(date);
}

function enumerateDates(from: string, to: string) {
	const dates: string[] = [];
	const { year: startYear, month: startMonth, day: startDay } = parseCalendarDate(from);
	const { year: endYear, month: endMonth, day: endDay } = parseCalendarDate(to);
	const cursor = new Date(startYear, startMonth - 1, startDay);
	const end = new Date(endYear, endMonth - 1, endDay);

	while (cursor <= end) {
		dates.push(formatCalendarDate(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate()));
		cursor.setDate(cursor.getDate() + 1);
	}

	return dates;
}

function enumerateMonths(from: string, to: string) {
	const months: { key: string; label: string; fullLabel: string }[] = [];
	const start = parseCalendarDate(from);
	const end = parseCalendarDate(to);
	let { year, month } = start;

	while (year < end.year || (year === end.year && month <= end.month)) {
		const key = `${year}-${String(month).padStart(2, '0')}`;
		const fullLabel = new Intl.DateTimeFormat(APP_LOCALE, {
			month: 'long',
			year: 'numeric',
			timeZone: 'UTC'
		}).format(new Date(`${key}-01T12:00:00.000Z`));
		const label = new Intl.DateTimeFormat(APP_LOCALE, {
			month: 'short',
			timeZone: 'UTC'
		})
			.format(new Date(`${key}-01T12:00:00.000Z`))
			.replace('.', '');

		months.push({ key, label, fullLabel });

		const next = addMonths(year, month, 1);
		year = next.year;
		month = next.month;
	}

	return months;
}

export function buildCashFlowSummary(
	paymentIncomeRows: CashFlowIncomeRow[],
	additionalIncomeRows: CashFlowAdditionalIncomeRow[],
	expenseRows: CashFlowExpenseRow[],
	period: CashFlowPeriod
): CashFlowSummary {
	const totalPaymentIncome = paymentIncomeRows.reduce((sum, row) => sum + row.totalAmount, 0);
	const totalAdditionalIncome = additionalIncomeRows.reduce((sum, row) => sum + row.amount, 0);
	const totalIncome = totalPaymentIncome + totalAdditionalIncome;
	const totalExpenses = expenseRows.reduce((sum, row) => sum + row.amount, 0);

	const categoryTotals = new Map<ExpenseCategory, number>();
	for (const row of expenseRows) {
		categoryTotals.set(row.category, (categoryTotals.get(row.category) ?? 0) + row.amount);
	}

	const categoryBreakdown = [...categoryTotals.entries()]
		.map(([category, amount]) => ({
			category,
			label: getExpenseCategoryLabel(category),
			amount,
			percentage: totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0
		}))
		.sort((a, b) => b.amount - a.amount);

	const periodDays = enumerateDates(period.from, period.to).length;
	const useMonthlyBuckets = periodDays > 45;
	const chartPoints: CashFlowChartPoint[] = [];

	if (useMonthlyBuckets) {
		for (const bucket of enumerateMonths(period.from, period.to)) {
			const paymentIncome = paymentIncomeRows
				.filter((row) => getCalendarDateInTimezone(row.paidAt).startsWith(bucket.key))
				.reduce((sum, row) => sum + row.totalAmount, 0);
			const additionalIncome = additionalIncomeRows
				.filter((row) => getCalendarDateInTimezone(row.paidAt).startsWith(bucket.key))
				.reduce((sum, row) => sum + row.amount, 0);
			const expenses = expenseRows
				.filter((row) => getCalendarDateInTimezone(row.paidAt).startsWith(bucket.key))
				.reduce((sum, row) => sum + row.amount, 0);

			chartPoints.push({
				key: bucket.key,
				label: bucket.label,
				fullLabel: bucket.fullLabel,
				income: paymentIncome + additionalIncome,
				expenses,
				net: paymentIncome + additionalIncome - expenses
			});
		}
	} else {
		for (const day of enumerateDates(period.from, period.to)) {
			const paymentIncome = paymentIncomeRows
				.filter((row) => getCalendarDateInTimezone(row.paidAt) === day)
				.reduce((sum, row) => sum + row.totalAmount, 0);
			const additionalIncome = additionalIncomeRows
				.filter((row) => getCalendarDateInTimezone(row.paidAt) === day)
				.reduce((sum, row) => sum + row.amount, 0);
			const expenses = expenseRows
				.filter((row) => getCalendarDateInTimezone(row.paidAt) === day)
				.reduce((sum, row) => sum + row.amount, 0);

			chartPoints.push({
				key: day,
				label: new Intl.DateTimeFormat(APP_LOCALE, {
					day: '2-digit',
					month: 'short',
					timeZone: 'UTC'
				}).format(new Date(`${day}T12:00:00.000Z`)),
				fullLabel: formatCashFlowDate(day),
				income: paymentIncome + additionalIncome,
				expenses,
				net: paymentIncome + additionalIncome - expenses
			});
		}
	}

	const activeChartPoints = chartPoints.filter((point) => point.income > 0 || point.expenses > 0);
	const chartDisplayPoints =
		periodDays > 14 && activeChartPoints.length > 0 ? activeChartPoints : chartPoints;

	const movements: CashFlowMovement[] = [
		...paymentIncomeRows.map((row) => ({
			id: `payment-${row.id}`,
			sourceId: row.id,
			sourceKind: 'payment' as const,
			type: 'income' as const,
			amount: row.totalAmount,
			label: row.studentName,
			detail: PURCHASE_TYPE_LABELS[row.purchaseType],
			paymentMethod: row.paymentMethod,
			paidAt: row.paidAt.toISOString(),
			paidAtLabel: formatCashFlowDateTime(row.paidAt.toISOString())
		})),
		...additionalIncomeRows.map((row) => ({
			id: `additional-income-${row.id}`,
			sourceId: row.id,
			sourceKind: 'additional_income' as const,
			type: 'income' as const,
			amount: row.amount,
			label: row.description,
			detail: ADDITIONAL_INCOME_DETAIL_LABEL,
			paymentMethod: row.paymentMethod,
			paidAt: row.paidAt.toISOString(),
			paidAtLabel: formatCashFlowDateTime(row.paidAt.toISOString())
		})),
		...expenseRows.map((row) => ({
			id: `expense-${row.id}`,
			sourceId: row.id,
			sourceKind: 'expense' as const,
			type: 'expense' as const,
			amount: row.amount,
			label: row.description,
			detail: getExpenseCategoryLabel(row.category),
			paymentMethod: row.paymentMethod,
			paidAt: row.paidAt.toISOString(),
			paidAtLabel: formatCashFlowDateTime(row.paidAt.toISOString())
		}))
	].sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());

	return {
		totalIncome,
		totalExpenses,
		netCashFlow: totalIncome - totalExpenses,
		incomeCount: paymentIncomeRows.length + additionalIncomeRows.length,
		expenseCount: expenseRows.length,
		categoryBreakdown,
		chartPoints,
		chartDisplayPoints,
		movements
	};
}

export function validateExpenseInput(data: ExpenseFormValues) {
	const errors: Partial<Record<keyof ExpenseFormValues, string>> = {};
	const amountValue = data.amount.trim();
	const amount = Number(amountValue);

	if (!amountValue) {
		errors.amount = 'El monto es obligatorio.';
	} else if (!Number.isInteger(amount) || amount <= 0) {
		errors.amount = 'Ingresa un monto entero mayor a cero.';
	}

	if (!data.category || !EXPENSE_CATEGORIES.includes(data.category)) {
		errors.category = 'Selecciona una categoría válida.';
	}

	if (!data.description.trim()) {
		errors.description = 'La descripción es obligatoria.';
	}

	if (!PAYMENT_METHODS.includes(data.paymentMethod)) {
		errors.paymentMethod = 'Selecciona un método de pago válido.';
	}

	if (!data.paidAt) {
		errors.paidAt = 'La fecha del egreso es obligatoria.';
	}

	return {
		errors,
		values: data,
		parsed:
			Object.keys(errors).length === 0
				? {
						amount,
						category: data.category as ExpenseCategory,
						description: data.description.trim(),
						paymentMethod: data.paymentMethod,
						paidAt: new Date(`${data.paidAt}T12:00:00.000Z`)
					}
				: null
	};
}

export function validateAdditionalIncomeInput(data: AdditionalIncomeFormValues) {
	const errors: Partial<Record<keyof AdditionalIncomeFormValues, string>> = {};
	const amountValue = data.amount.trim();
	const amount = Number(amountValue);

	if (!amountValue) {
		errors.amount = 'El monto es obligatorio.';
	} else if (!Number.isInteger(amount) || amount <= 0) {
		errors.amount = 'Ingresa un monto entero mayor a cero.';
	}

	if (!data.description.trim()) {
		errors.description = 'La descripción es obligatoria.';
	}

	if (!PAYMENT_METHODS.includes(data.paymentMethod)) {
		errors.paymentMethod = 'Selecciona un método de pago válido.';
	}

	if (!data.paidAt) {
		errors.paidAt = 'La fecha del ingreso es obligatoria.';
	}

	return {
		errors,
		values: data,
		parsed:
			Object.keys(errors).length === 0
				? {
						amount,
						description: data.description.trim(),
						paymentMethod: data.paymentMethod,
						paidAt: new Date(`${data.paidAt}T12:00:00.000Z`)
					}
				: null
	};
}

export function toAdditionalIncomeFormValues(
	additionalIncome?: {
		amount: number;
		description: string;
		paymentMethod: PaymentMethod;
		paidAt: Date;
	} | null,
	defaultPaidAt = getCalendarDateInAppTimezone()
): AdditionalIncomeFormValues {
	if (!additionalIncome) {
		return {
			amount: '',
			description: '',
			paymentMethod: 'Efectivo',
			paidAt: defaultPaidAt
		};
	}

	return {
		amount: String(additionalIncome.amount),
		description: additionalIncome.description,
		paymentMethod: additionalIncome.paymentMethod,
		paidAt: getCalendarDateInTimezone(additionalIncome.paidAt)
	};
}

export function toExpenseFormValues(
	expense?: {
		amount: number;
		category: ExpenseCategory;
		description: string;
		paymentMethod: PaymentMethod;
		paidAt: Date;
	} | null,
	defaultPaidAt = getCalendarDateInAppTimezone()
): ExpenseFormValues {
	if (!expense) {
		return {
			amount: '',
			category: '',
			description: '',
			paymentMethod: 'Efectivo',
			paidAt: defaultPaidAt
		};
	}

	return {
		amount: String(expense.amount),
		category: expense.category,
		description: expense.description,
		paymentMethod: expense.paymentMethod,
		paidAt: getCalendarDateInTimezone(expense.paidAt)
	};
}

export function serializeCashFlowIncome(
	payment: {
		id: number;
		purchaseType: string;
		totalAmount: number;
		paymentMethod: string;
		paidAt: Date;
	},
	studentName: string | null
): CashFlowIncomeRow {
	return {
		id: payment.id,
		studentName: formatStudentName(studentName),
		purchaseType: payment.purchaseType as PurchaseType,
		totalAmount: payment.totalAmount,
		paymentMethod: payment.paymentMethod as PaymentMethod,
		paidAt: payment.paidAt
	};
}
