import { formatPrice } from '$lib/payment-plans.js';
import { APP_LOCALE, getCalendarDateInAppTimezone } from '$lib/locale.js';
import {
	PAYMENT_STATUS_LABELS,
	type PaymentStatus,
	type PurchaseType,
	PURCHASE_TYPE_LABELS
} from '$lib/payments.js';

export type MonthlyRevenuePoint = {
	monthKey: string;
	monthLabel: string;
	monthFullLabel: string;
	revenue: number;
	payments: number;
};

export type PaymentStatusPoint = {
	status: PaymentStatus;
	label: string;
	count: number;
	fill: string;
};

export type StudentAttentionItem = {
	id: number;
	fullName: string;
	email: string;
	paymentStatus: PaymentStatus;
};

export type RecentPaymentItem = {
	id: number;
	studentName: string;
	totalAmount: number;
	paidAt: string;
	purchaseType: PurchaseType;
};

export type DashboardData = {
	activeStudents: number;
	totalStudents: number;
	monthlyRevenue: number;
	monthlyPaymentsCount: number;
	expiringSoonCount: number;
	expiredCount: number;
	vigenteCount: number;
	monthlyRevenueChart: MonthlyRevenuePoint[];
	monthlyRevenueChartDisplay: MonthlyRevenuePoint[];
	paymentStatusChart: PaymentStatusPoint[];
	studentsNeedingAttention: StudentAttentionItem[];
	recentPayments: RecentPaymentItem[];
};

const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
	vigente: 'var(--chart-1)',
	por_vencer: 'var(--chart-4)',
	vencido: 'var(--chart-2)'
};

export function getPaymentMonthKey(paidAt: Date) {
	return getCalendarDateInAppTimezone(paidAt).slice(0, 7);
}

function addMonthsLocal(year: number, month: number, offset: number) {
	const date = new Date(year, month - 1 + offset, 1);
	return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export function buildMonthlyRevenueChart(
	payments: { paidAt: Date; totalAmount: number }[],
	months = 6,
	now = new Date()
): MonthlyRevenuePoint[] {
	const points: MonthlyRevenuePoint[] = [];
	const [todayYear, todayMonth] = getCalendarDateInAppTimezone(now).split('-').map(Number);

	for (let offset = months - 1; offset >= 0; offset -= 1) {
		const { year, month } = addMonthsLocal(todayYear, todayMonth, -offset);
		const monthKey = `${year}-${String(month).padStart(2, '0')}`;
		const monthLabel = new Intl.DateTimeFormat(APP_LOCALE, {
			month: 'short',
			timeZone: 'UTC'
		})
			.format(new Date(`${monthKey}-01T12:00:00.000Z`))
			.replace('.', '');
		const monthPayments = payments.filter(
			(payment) => getPaymentMonthKey(payment.paidAt) === monthKey
		);

		points.push({
			monthKey,
			monthLabel,
			monthFullLabel: formatDashboardMonthLabel(monthKey),
			revenue: monthPayments.reduce((sum, payment) => sum + payment.totalAmount, 0),
			payments: monthPayments.length
		});
	}

	return points;
}

export function buildMonthlyRevenueChartDisplay(points: MonthlyRevenuePoint[]) {
	const activePoints = points.filter((point) => point.revenue > 0);
	return activePoints.length > 0 ? activePoints : points;
}

export function formatDashboardChartAxisLabel(monthKey: string) {
	return new Intl.DateTimeFormat(APP_LOCALE, {
		month: 'short',
		timeZone: 'UTC'
	})
		.format(new Date(`${monthKey}-01T12:00:00.000Z`))
		.replace('.', '');
}

export function buildPaymentStatusChart(counts: Record<PaymentStatus, number>): PaymentStatusPoint[] {
	return (['vigente', 'por_vencer', 'vencido'] as const).map((status) => ({
		status,
		label: PAYMENT_STATUS_LABELS[status],
		count: counts[status],
		fill: PAYMENT_STATUS_COLORS[status]
	}));
}

export function formatDashboardMonthLabel(monthKey: string) {
	return new Intl.DateTimeFormat(APP_LOCALE, {
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC'
	}).format(new Date(`${monthKey}-01T12:00:00.000Z`));
}

export function formatDashboardCurrency(amount: number) {
	return formatPrice(amount);
}

export function formatRecentPaymentDate(isoDate: string) {
	return new Intl.DateTimeFormat(APP_LOCALE, {
		day: '2-digit',
		month: 'short',
		year: 'numeric'
	}).format(new Date(isoDate));
}

export function getPurchaseTypeLabel(type: PurchaseType) {
	return PURCHASE_TYPE_LABELS[type];
}
