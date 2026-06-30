import { APP_LOCALE } from '$lib/locale.js';
import { extractPhoneDigits, formatPhone, normalizePhone } from '$lib/phone.js';

export type SerializedStudent = {
	id: number;
	fullName: string;
	phone: string;
	enrolledAt: string;
	active: boolean;
	paymentStatus: import('$lib/payments.js').PaymentStatus;
};

export function validateStudentInput(data: { fullName: string; phone: string }) {
	const errors: Record<string, string> = {};
	const fullName = data.fullName.trim();
	const phone = normalizePhone(data.phone);

	if (!fullName) {
		errors.fullName = 'El nombre completo es obligatorio.';
	}

	if (!phone) {
		errors.phone = data.phone.trim()
			? 'El teléfono debe tener 10 dígitos.'
			: 'El teléfono es obligatorio.';
	}

	return {
		errors,
		values: { fullName, phone: phone ?? extractPhoneDigits(data.phone) }
	};
}

export { formatPhone };

export function formatEnrollmentDate(isoDate: string) {
	return new Intl.DateTimeFormat(APP_LOCALE, {
		day: '2-digit',
		month: 'long',
		year: 'numeric'
	}).format(new Date(isoDate));
}
