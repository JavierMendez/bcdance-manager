import type { AlertVariant } from '$lib/components/ui/alert/index.js';

export type GlobalAlert = {
	id: string;
	variant: AlertVariant;
	title?: string;
	description: string;
};

export type ShowAlertOptions = {
	title?: string;
	description: string;
	variant?: AlertVariant;
	duration?: number;
};

const DEFAULT_ERROR_TITLE = 'Error';
const DEFAULT_DURATION_MS = 6000;

class AlertsState {
	items = $state<GlobalAlert[]>([]);
	#timeouts = new Map<string, ReturnType<typeof setTimeout>>();

	show(options: ShowAlertOptions) {
		const id = crypto.randomUUID();
		const alert: GlobalAlert = {
			id,
			variant: options.variant ?? 'default',
			title: options.title,
			description: options.description
		};

		this.items = [...this.items, alert];

		const duration = options.duration ?? DEFAULT_DURATION_MS;
		if (duration > 0) {
			const timeout = setTimeout(() => {
				this.dismiss(id);
			}, duration);
			this.#timeouts.set(id, timeout);
		}

		return id;
	}

	showError(description: string, title = DEFAULT_ERROR_TITLE) {
		return this.show({
			title,
			description,
			variant: 'destructive'
		});
	}

	dismiss(id: string) {
		const timeout = this.#timeouts.get(id);
		if (timeout) {
			clearTimeout(timeout);
			this.#timeouts.delete(id);
		}

		this.items = this.items.filter((alert) => alert.id !== id);
	}

	clear() {
		for (const timeout of this.#timeouts.values()) {
			clearTimeout(timeout);
		}
		this.#timeouts.clear();
		this.items = [];
	}
}

export const alerts = new AlertsState();

export function showAlert(options: ShowAlertOptions) {
	return alerts.show(options);
}

export function showError(description: string, title?: string) {
	return alerts.showError(description, title);
}

export function dismissAlert(id: string) {
	alerts.dismiss(id);
}

export function clearAlerts() {
	alerts.clear();
}

export function getActionErrorMessage(data: unknown): string | null {
	if (!data || typeof data !== 'object') {
		return null;
	}

	if ('message' in data && typeof data.message === 'string' && data.message.trim()) {
		return data.message.trim();
	}

	if ('errors' in data && data.errors && typeof data.errors === 'object') {
		const firstError = Object.values(data.errors as Record<string, string>).find(Boolean);
		if (firstError) {
			return firstError;
		}
	}

	return null;
}
