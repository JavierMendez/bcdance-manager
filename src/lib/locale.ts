export const APP_LOCALE = 'es-MX';
export const PAYMENT_CURRENCY = 'MXN';
export const APP_TIMEZONE = 'America/Mexico_City';

/** Fecha calendario YYYY-MM-DD en la zona horaria de la app (México). */
export function getCalendarDateInAppTimezone(now = new Date()) {
	return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE }).format(now);
}
