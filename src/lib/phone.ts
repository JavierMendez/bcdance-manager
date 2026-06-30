export const PHONE_COUNTRY_CODE = '+52';
export const PHONE_DIGIT_COUNT = 10;
export const PHONE_PLACEHOLDER = '+52 55 78 12 93 79';

export function extractPhoneDigits(value: string): string {
	const digits = value.replace(/\D/g, '');

	if (digits.startsWith('52') && digits.length > PHONE_DIGIT_COUNT) {
		return digits.slice(2, 2 + PHONE_DIGIT_COUNT);
	}

	return digits.slice(0, PHONE_DIGIT_COUNT);
}

export function normalizePhone(value: string): string | null {
	const digits = extractPhoneDigits(value);
	return digits.length === PHONE_DIGIT_COUNT ? digits : null;
}

export function formatPhone(value: string): string {
	const digits = extractPhoneDigits(value);

	if (digits.length !== PHONE_DIGIT_COUNT) {
		return value;
	}

	let formatted = PHONE_COUNTRY_CODE;

	for (let index = 0; index < digits.length; index += 2) {
		formatted += ` ${digits.slice(index, index + 2)}`;
	}

	return formatted;
}

export function formatPhoneInput(digits: string): string {
	const normalizedDigits = extractPhoneDigits(digits);

	if (!normalizedDigits) {
		return '';
	}

	let formatted = PHONE_COUNTRY_CODE;

	for (let index = 0; index < normalizedDigits.length; index += 2) {
		formatted += ` ${normalizedDigits.slice(index, index + 2)}`;
	}

	return formatted;
}
