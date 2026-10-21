import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(viteConfig, defineConfig({
	test: {
		environment: 'node',
		include: ['tests/integration/**/*.test.ts'],
		fileParallelism: false,
		testTimeout: 30000,
		hookTimeout: 30000
	}
}));
