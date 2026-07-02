import { getActionErrorMessage, showError } from '$lib/alerts.svelte.js';
import type { SubmitFunction } from '@sveltejs/kit';

type ActionSubmitOptions = {
	setSubmitting?: (value: boolean) => void;
	onSuccess?: (data: Record<string, unknown>) => void | Promise<void>;
	onFailure?: (data: Record<string, unknown>) => void | Promise<void>;
	showGlobalError?: boolean;
	invalidateAll?: boolean;
};

type DialogSubmitOptions = {
	setSubmitting: (value: boolean) => void;
	setOpen: (value: boolean) => void;
	onSuccess?: (data: Record<string, unknown>) => void;
	onClosed?: () => void;
	showGlobalError?: boolean;
};

function getGlobalErrorMessage(data: unknown, includeFieldErrors: boolean) {
	if (!includeFieldErrors && data && typeof data === 'object' && 'message' in data) {
		const message = data.message;
		return typeof message === 'string' && message.trim() ? message.trim() : null;
	}

	return getActionErrorMessage(data);
}

export function createActionSubmitHandler({
	setSubmitting,
	onSuccess,
	onFailure,
	showGlobalError = true,
	invalidateAll = false
}: ActionSubmitOptions = {}): SubmitFunction {
	return () => {
		setSubmitting?.(true);

		return async ({ result, update }) => {
			try {
				if (result.type === 'success') {
					await onSuccess?.(result.data ?? {});
				} else if (result.type === 'failure') {
					const data = (result.data ?? {}) as Record<string, unknown>;
					if (showGlobalError) {
						const message = getGlobalErrorMessage(data, true);
						if (message) {
							showError(message);
						}
					}
					await onFailure?.(data);
				}

				await update({ reset: false, invalidateAll });
			} finally {
				setSubmitting?.(false);
			}
		};
	};
}

export function createDialogSubmitHandler({
	setSubmitting,
	setOpen,
	onSuccess,
	onClosed,
	showGlobalError = true
}: DialogSubmitOptions): SubmitFunction {
	return () => {
		setSubmitting(true);

		return async ({ result, update }) => {
			try {
				if (result.type === 'success') {
					onSuccess?.(result.data ?? {});
					setOpen(false);
					onClosed?.();
					setSubmitting(false);
					void update({ reset: false, invalidateAll: false });
					return;
				}

				if (result.type === 'failure' && showGlobalError) {
					const message = getGlobalErrorMessage(result.data, false);
					if (message) {
						showError(message);
					}
				}

				await update({ reset: false, invalidateAll: false });
			} finally {
				setSubmitting(false);
			}
		};
	};
}
