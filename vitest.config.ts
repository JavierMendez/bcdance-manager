import { playwright } from '@vitest/browser-playwright';
import { configDefaults, defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
	viteConfig,
	defineConfig({
		test: {
			projects: [
				{
					extends: true,
					test: {
						name: 'unit',
						environment: 'node',
						include: ['tests/**/*.{test,spec}.ts'],
						exclude: [...configDefaults.exclude, 'tests/**/*.svelte.{test,spec}.ts', 'tests/integration/**']
					}
				},
				{
					extends: true,
					test: {
						name: 'ui',
						include: ['tests/**/*.svelte.{test,spec}.ts'],
						browser: {
							enabled: true,
							provider: playwright(),
							headless: true,
							instances: [{ browser: 'chromium' }]
						}
					}
				}
			]
		}
	})
);
