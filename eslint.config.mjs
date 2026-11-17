import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

// Import directions between layers (docs/architecture/LLD.md section 1). A violation is a lint
// error, so the boundaries are checked rather than relied on.
const SDKS = ['groq-sdk', 'groq-sdk/*', '@upstash/*', '@google/*', 'openai', 'openai/*'];
const restrict = (groups) => ({
    'no-restricted-imports': ['error', { patterns: groups.map(([group, message]) => ({ group, message })) }],
});
const noEnv = {
    'no-restricted-properties': ['error', { object: 'process', property: 'env', message: 'Read configuration through lib/infrastructure/config.js.' }],
};

const config = [
    { ignores: ['.next/**', 'node_modules/**', 'test-results/**', 'playwright-report/**', 'next-env.d.ts'] },
    ...compat.extends('next/core-web-vitals'),
    {
        // Domain is pure: same-directory imports only.
        files: ['lib/domain/**'],
        rules: {
            ...noEnv,
            'no-restricted-imports': ['error', { patterns: [{ regex: '^(?!\\./[^/]+\\.js$)', message: 'lib/domain may import only other lib/domain modules.' }] }],
        },
    },
    {
        files: ['lib/application/**'],
        rules: {
            ...noEnv,
            ...restrict([
                [['**/infrastructure/**', '**/http/**', '**/client/**', '**/app/**', 'next', 'next/*', 'react', 'react-dom', 'server-only', ...SDKS],
                    'lib/application depends on lib/domain and on ports only; adapters are passed in.'],
            ]),
        },
    },
    {
        files: ['lib/http/**', 'lib/infrastructure/**', 'app/api/**'],
        ignores: ['lib/infrastructure/config.js'],
        rules: noEnv,
    },
    {
        files: ['lib/http/**', 'app/api/**'],
        rules: restrict([[SDKS, 'Provider and store SDKs are used only by their adapter in lib/infrastructure.']]),
    },
    {
        files: ['lib/infrastructure/**'],
        ignores: ['lib/infrastructure/ai/**', 'lib/infrastructure/store/redis-store.js'],
        rules: restrict([
            [['**/http/**', '**/app/**', ...SDKS], 'Only the AI adapter and the Redis store import SDKs; infrastructure does not depend on lib/http or app/.'],
        ]),
    },
    {
        files: ['lib/client/**', 'app/components/**', 'app/hooks/**', 'app/page.jsx', 'app/layout.js', 'app/not-found.jsx'],
        rules: {
            ...noEnv,
            ...restrict([
                [['**/application/**', '**/infrastructure/**', '**/http/**', 'server-only', ...SDKS],
                    'Browser code may import only lib/domain and lib/client.'],
            ]),
        },
    },
];

export default config;
