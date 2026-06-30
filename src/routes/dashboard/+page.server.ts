import { desc, eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db/index.js';
import {
	buildMonthlyRevenueChart,
	buildPaymentStatusChart,
	type DashboardData,
	type RecentPaymentItem,
	type StudentAttentionItem
} from '$lib/dashboard.js';
import { payments, studentEntitlements, students } from '$lib/server/db/schema/index.js';
import {
	formatStudentName,
	resolvePaymentStatus,
	type PurchaseType
} from '$lib/payments.js';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async () => {
	const db = getDb();
	const now = new Date();

	const [studentRows, entitlementRows, paymentRows] = await Promise.all([
		db.select().from(students).orderBy(desc(students.enrolledAt)),
		db.select().from(studentEntitlements).where(eq(studentEntitlements.active, true)),
		db
			.select({
				payment: payments,
				studentName: students.fullName
			})
			.from(payments)
			.leftJoin(students, eq(payments.studentId, students.id))
			.orderBy(desc(payments.paidAt))
	]);

	const entitlementsByStudent = new Map<number, typeof entitlementRows>();
	for (const entitlement of entitlementRows) {
		const current = entitlementsByStudent.get(entitlement.studentId) ?? [];
		current.push(entitlement);
		entitlementsByStudent.set(entitlement.studentId, current);
	}

	const paymentStatusCounts = {
		vigente: 0,
		por_vencer: 0,
		vencido: 0
	};

	const studentsNeedingAttention: StudentAttentionItem[] = [];

	for (const student of studentRows) {
		if (!student.active) {
			continue;
		}

		const paymentStatus = resolvePaymentStatus(entitlementsByStudent.get(student.id) ?? [], now);
		paymentStatusCounts[paymentStatus] += 1;

		if (paymentStatus === 'por_vencer' || paymentStatus === 'vencido') {
			studentsNeedingAttention.push({
				id: student.id,
				fullName: student.fullName,
				email: student.email,
				paymentStatus
			});
		}
	}

	studentsNeedingAttention.sort((a, b) => {
		if (a.paymentStatus === b.paymentStatus) {
			return a.fullName.localeCompare(b.fullName, 'es');
		}

		return a.paymentStatus === 'vencido' ? -1 : 1;
	});

	const activeStudents = studentRows.filter((student) => student.active).length;
	const currentMonthPayments = paymentRows.filter(({ payment }) => {
		const paidAt = payment.paidAt;
		return paidAt.getFullYear() === now.getFullYear() && paidAt.getMonth() === now.getMonth();
	});

	const recentPayments: RecentPaymentItem[] = paymentRows.slice(0, 5).map(({ payment, studentName }) => ({
		id: payment.id,
		studentName: formatStudentName(studentName),
		totalAmount: payment.totalAmount,
		paidAt: payment.paidAt.toISOString(),
		purchaseType: payment.purchaseType as PurchaseType
	}));

	const dashboard: DashboardData = {
		activeStudents,
		totalStudents: studentRows.length,
		monthlyRevenue: currentMonthPayments.reduce((sum, { payment }) => sum + payment.totalAmount, 0),
		monthlyPaymentsCount: currentMonthPayments.length,
		expiringSoonCount: paymentStatusCounts.por_vencer,
		expiredCount: paymentStatusCounts.vencido,
		vigenteCount: paymentStatusCounts.vigente,
		monthlyRevenueChart: buildMonthlyRevenueChart(
			paymentRows.map(({ payment }) => ({
				paidAt: payment.paidAt,
				totalAmount: payment.totalAmount
			}))
		),
		paymentStatusChart: buildPaymentStatusChart(paymentStatusCounts),
		studentsNeedingAttention: studentsNeedingAttention.slice(0, 6),
		recentPayments
	};

	return { dashboard };
};
