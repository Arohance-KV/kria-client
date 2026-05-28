// Minimal ESLint configuration — exists ONLY to machine-enforce the sport-plugin
// architectural boundary (see SPORT_MODULARIZATION_FRONTEND.md / spec §1).
//
// Deliberately NO broader lint rules — adding @typescript-eslint, react, or
// stylistic rules is out of scope for this configuration.

import importPlugin from 'eslint-plugin-import';
import tsParser from '@typescript-eslint/parser';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default [
    {
        files: ['src/**/*.{ts,tsx}'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                ecmaFeatures: { jsx: true },
            },
        },
        plugins: {
            import: importPlugin,
            // Loaded ONLY so legacy `eslint-disable-next-line react-hooks/exhaustive-deps`
            // comments in three existing files (AuctionDisplay, AuctionSection, TeamsTab)
            // resolve to a known rule. The rule itself stays OFF — Phase 2 deliberately
            // adds no new lint pressure beyond the boundary rule.
            'react-hooks': reactHooksPlugin,
        },
        settings: {
            'import/resolver': {
                typescript: {
                    project: './tsconfig.json',
                },
                node: true,
            },
        },
        rules: {
            // Boundary rule — the only purpose of this config.
            // Zone 1: code outside sports/ may import from the public contract
            // and the registry only, never from a specific sport's internals.
            //
            // Zone 2 (cross-sport: badminton cannot import cricket and vice versa)
            // is added in Stream 2 when cricket joins.
            'import/no-restricted-paths': ['error', {
                zones: [
                    {
                        target: [
                            './src/App.tsx',
                            './src/main.tsx',
                            './src/types.ts',
                            './src/api/**',
                            './src/components/**',
                            './src/data/**',
                            './src/lib/**',
                            './src/pages/**',
                            './src/store/**',
                        ],
                        from: './src/sports/**',
                        except: [
                            // Glob shapes — eslint-plugin-import's no-restricted-paths
                            // requires each `except` entry to be glob-shaped (contain
                            // wildcards or brace expansions), not a literal path.
                            '**/sports/_contracts/**',
                            '**/sports/registry.{ts,tsx,js}',
                            '**/sports/*/index.{ts,tsx,js}',
                        ],
                        message: 'Only @/sports/_contracts/* and @/sports/registry are reachable from outside sports/. Plugin internals are private — go through the registry.',
                    },
                    // Zone 2: a sport may not import another sport's internals.
                    // Pair-wise — add a new pair when a third sport is added.
                    {
                        target: './src/sports/badminton/**',
                        from: './src/sports/cricket/**',
                        message: 'badminton must not import cricket internals. Sports are isolated; share only through @/sports/_contracts and @/sports/registry.',
                    },
                    {
                        target: './src/sports/cricket/**',
                        from: './src/sports/badminton/**',
                        message: 'cricket must not import badminton internals. Sports are isolated; share only through @/sports/_contracts and @/sports/registry.',
                    },
                ],
            }],

            // Legacy disable directives in three files reference this rule.
            // Loaded so the directives are valid; kept off to add no lint pressure.
            'react-hooks/exhaustive-deps': 'off',
        },
    },
    {
        ignores: ['dist/**', 'node_modules/**', 'build/**'],
    },
];
