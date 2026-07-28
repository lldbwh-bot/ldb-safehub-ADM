import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: {
        configPath: './wrangler.jsonc',
      },
      miniflare: {
        bindings: {
          APP_ENV: 'test',
          APP_VERSION: 'test-version',
        },
        d1Databases: {
          DB: '00000000-0000-4000-8000-000000000001',
        },
        r2Buckets: ['FILES'],
      },
    }),
  ],
});
