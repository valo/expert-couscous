# Repository Guidelines

## Project Structure & Module Organization
The Next.js 15 app lives in `src/app` with the App Router. Route entries such as `page.tsx` and `layout.tsx` define public views, while `components/` holds shared UI. Global providers for RainbowKit, Wagmi, and React Query sit in `src/app/providers.tsx`. Utilities and chain config live under `src/lib` (`config.ts`, `utils.tsx`), available through the `@/*` path alias in `tsconfig.json`. Static assets belong in `public/`, and Tailwind styling originates in `src/app/globals.css`. The ABIs of the contracts used by the app are in src/lib/abi.

## Build, Test, and Development Commands
Use pnpm for all package management and running scripts:
- `pnpm install` — install dependencies.
- `pnpm run dev` — launch the Turbopack dev server at `http://localhost:3000`.
- `pnpm run build` — produce a production bundle for CI or previews.
- `pnpm run start` — serve the bundled app locally.
- `pnpm run lint` — execute ESLint with the `next/core-web-vitals` preset; resolve findings before merging.

## Coding Style & Naming Conventions
Prefer TypeScript React components and add "use client" only when required. Use 2-space indentation, keep JSX lean, and favor hooks over classes. Components and hooks follow `PascalCase`, helpers use `camelCase`, constants use `SCREAMING_SNAKE_CASE`. Run `npm run lint -- --fix` for safe formatting and rely on the `@/*` alias instead of long relative paths. Co-locate feature-specific helpers or styles with their component folder.

## Testing Guidelines
Automated tests are not yet established; new work should include coverage alongside features. Place component tests in `src/app/<feature>/__tests__` with names like `WalletConnectButton.test.tsx`, using React Testing Library or Playwright as appropriate. Mock wallet providers for determinism, and add smoke checks that assert query states before approving a PR.

## Commit & Pull Request Guidelines
Write imperative, concise commit subjects (`Add wallet avatar variants`), mirroring the existing history (`Initial version`). Keep each commit focused and add body details when touching protocol configuration. Pull requests must explain the change, list executed commands, and attach screenshots or GIFs for UI updates. Link Jira or GitHub issues and flag follow-up actions for reviewers.

## Environment & Wallet Configuration
`src/lib/config.ts` targets the Sepolia testnet. Update the `projectId` and chain array when adding networks, and document any `.env.local` keys in the PR description. Local testing may require clearing wallet cookies because Wagmi stores session state via cookies.
