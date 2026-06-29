import type { SubmitFunction } from '@sveltejs/kit';

type DialogSubmitOptions = {
	setSubmitting: (value: boolean) => void;
	setOpen: (value: boolean) => void;
	onSuccess?: (data: Record<string, unknown>) => void;
	onClosed?: () => void;
};

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

				await update({ reset: false, invalidateAll: false });
			} finally {
				setSubmitting(false);
			}
		};
	};
}
