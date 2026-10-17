import { beforeEach, vi } from 'vitest';
import type { ActionResult, SubmitFunction } from '@sveltejs/kit';

export const transport = {
	post: vi.fn<(data: FormData, action: string) => Promise<ActionResult>>(),
	update: vi.fn(), goto: vi.fn(), showError: vi.fn()
};
beforeEach(() => {
	transport.post.mockReset().mockResolvedValue({ type: 'failure', status: 400, data: {} });
	transport.update.mockReset().mockResolvedValue(undefined);
	transport.goto.mockReset().mockResolvedValue(undefined);
	transport.showError.mockReset();
});

// Sustituye únicamente el transporte; ejecuta la validación HTML y los handlers reales.
export function enhance(form: HTMLFormElement, submit: SubmitFunction) {
	const handleSubmit = async (event: SubmitEvent) => {
		event.preventDefault();
		const formData = new FormData(form);
		const action = new URL(form.action);
		let cancelled = false;
		const callback = await submit({ formData, action, formElement: form,
			controller: new AbortController(), cancel: () => { cancelled = true; }, submitter: event.submitter });
		if (cancelled) return;
		const result = await transport.post(formData, action.search);
		await callback?.({ result, update: transport.update, formData, action, formElement: form });
	};
	form.addEventListener('submit', handleSubmit);
	return { destroy: () => form.removeEventListener('submit', handleSubmit) };
}
