import { APP_LOCALE } from '$lib/locale.js';
import { extractPhoneDigits, formatPhone, normalizePhone } from '$lib/phone.js';

export type SerializedStudent = {
	id: number;
	guid: string;
	fullName: string;
	phone: string | null;
	enrolledAt: string;
	active: boolean;
	paymentStatus: import('$lib/payments.js').PaymentStatus;
};

export function validateStudentInput(data: { fullName: string; phone: string }) {
	const errors: Record<string, string> = {};
	const fullName = data.fullName.trim();
	const phoneDigits = extractPhoneDigits(data.phone);
	const phone = phoneDigits ? normalizePhone(data.phone) : null;

	if (!fullName) {
		errors.fullName = 'El nombre completo es obligatorio.';
	}

	if (phoneDigits && !phone) {
		errors.phone = 'El teléfono debe tener 10 dígitos.';
	}

	return {
		errors,
		values: { fullName, phone }
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
