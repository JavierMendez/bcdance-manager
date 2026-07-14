export const APP_LOCALE = 'es-MX';
export const PAYMENT_CURRENCY = 'MXN';
export const APP_TIMEZONE = 'America/Mexico_City';

/** Fecha calendario YYYY-MM-DD en la zona horaria de la app (México). */
export function getCalendarDateInAppTimezone(now = new Date()) {
	return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE }).format(now);
}

/** Índice del día de la semana en la zona horaria de la app: 0=Lunes … 6=Domingo. */
export function getWeekdayIndexInAppTimezone(now = new Date()) {
	const date = getCalendarDateInAppTimezone(now);
	const dayIndex = new Date(`${date}T12:00:00.000Z`).getUTCDay();
	return (dayIndex + 6) % 7;
}
