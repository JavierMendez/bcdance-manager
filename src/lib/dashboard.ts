import { formatPrice } from '$lib/payment-plans.js';
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
	paymentStatusChart: PaymentStatusPoint[];
	studentsNeedingAttention: StudentAttentionItem[];
	recentPayments: RecentPaymentItem[];
};

const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
	vigente: 'var(--chart-1)',
	por_vencer: 'var(--chart-4)',
	vencido: 'var(--chart-2)'
};

export function buildMonthlyRevenueChart(
	payments: { paidAt: Date; totalAmount: number }[],
	months = 6,
	now = new Date()
): MonthlyRevenuePoint[] {
	const points: MonthlyRevenuePoint[] = [];

	for (let offset = months - 1; offset >= 0; offset -= 1) {
		const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
		const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
		const monthLabel = new Intl.DateTimeFormat('es-CL', { month: 'short' }).format(date);
		const monthPayments = payments.filter((payment) => {
			const paidAt = payment.paidAt;
			return (
				paidAt.getFullYear() === date.getFullYear() && paidAt.getMonth() === date.getMonth()
			);
		});

		points.push({
			monthKey,
			monthLabel: monthLabel.replace('.', ''),
			monthFullLabel: formatDashboardMonthLabel(monthKey),
			revenue: monthPayments.reduce((sum, payment) => sum + payment.totalAmount, 0),
			payments: monthPayments.length
		});
	}

	return points;
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
	const [year, month] = monthKey.split('-').map(Number);
	return new Intl.DateTimeFormat('es-CL', {
		month: 'long',
		year: 'numeric'
	}).format(new Date(year, month - 1, 1));
}

export function formatDashboardCurrency(amount: number) {
	return formatPrice(amount);
}

export function formatRecentPaymentDate(isoDate: string) {
	return new Intl.DateTimeFormat('es-CL', {
		day: '2-digit',
		month: 'short',
		year: 'numeric'
	}).format(new Date(isoDate));
}

export function getPurchaseTypeLabel(type: PurchaseType) {
	return PURCHASE_TYPE_LABELS[type];
}
