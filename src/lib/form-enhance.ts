import { getActionErrorMessage, showError } from '$lib/alerts.svelte.js';
import type { SubmitFunction } from '@sveltejs/kit';

type ActionSubmitOptions = {
	setSubmitting?: (value: boolean) => void;
	onSuccess?: (data: Record<string, unknown>) => void | Promise<void>;
	invalidateAll?: boolean;
};

type DialogSubmitOptions = {
	setSubmitting: (value: boolean) => void;
	setOpen: (value: boolean) => void;
	onSuccess?: (data: Record<string, unknown>) => void;
	onClosed?: () => void;
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
	invalidateAll = false
}: ActionSubmitOptions = {}): SubmitFunction {
	return () => {
		setSubmitting?.(true);

		return async ({ result, update }) => {
			try {
				if (result.type === 'success') {
					await onSuccess?.(result.data ?? {});
				} else if (result.type === 'failure') {
					const message = getGlobalErrorMessage(result.data, true);
					if (message) {
						showError(message);
					}
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
	onClosed
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

				if (result.type === 'failure') {
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
