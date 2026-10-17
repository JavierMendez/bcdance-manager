import type { SerializedPayment, PaymentListFilters, PaymentWizardData } from '$lib/payments';
import { PAYMENT_METHODS } from '$lib/payments';
import { student, monthlyPlan, fullPassPlan, dropInPlan, now } from './classes';

export const authData = {
	role: 'admin' as const,
	user: { id: 'admin-1', name: 'Admin', email: 'admin@example.com', emailVerified: true,
		createdAt: now, updatedAt: now, role: 'admin', banned: false, banReason: null, banExpires: null }
};
export const emptyFilters: PaymentListFilters = { q: '', type: '', method: '', from: '', to: '' };
export const payment: SerializedPayment = {
	id: 1, studentId: 1, studentName: 'Ana Pérez', purchaseType: 'monthly_only',
	subtotalAmount: 500, discountPercent: 0, totalAmount: 500, paymentMethod: 'Efectivo',
	notes: null, paidAt: '2026-10-17T01:00:00.000Z', summary: 'Plan mensual para una clase'
};
export const wizardProps = {
	students: [student], courses: [{ id: 10, name: 'Salsa' }],
	plans: [monthlyPlan, fullPassPlan, dropInPlan], paymentMethods: PAYMENT_METHODS
};
export const wizardValues: PaymentWizardData = {
	studentId: '1', purchaseType: 'monthly_only', courseId: '10', monthlyPlanId: '1',
	fullPassPlanId: '', dropInPlanId: '', paymentMethod: 'Efectivo',
	paidAt: '2026-10-16T18:00', discountPercent: '0', notes: ''
};
