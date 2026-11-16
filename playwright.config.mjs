import { defineConfig, devices } from '@playwright/test';

const PORT = 3210;

// Browser tests run against the production build with /api/trips mocked at the network
// layer, so they are deterministic and never spend AI quota.
export default defineConfig({
    testDir: 'test/e2e',
    testMatch: '**/*.spec.js',
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
    use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
    projects: [
        { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
        { name: 'phone', use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 740 } } },
    ],
    webServer: {
        command: `npx next start -p ${PORT}`,
        url: `http://localhost:${PORT}/api/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
    },
});
