This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## WalletConnect / Reown

This app supports an optional WalletConnect connector (in addition to MetaMask/Coinbase/Injected).

- Set `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` (you can also use the legacy `NEXT_PUBLIC_PROJECT_ID`).
- Best practice: use separate Reown projects for dev vs prod:
	- Dev: put the dev project ID in `.env.local` (see `.env.local.example`).
	- Prod: set the prod project ID in your hosting provider env vars (or in `.env.production.local` for local prod-like builds; see `.env.production.local.example`).
- In the WalletConnect/Reown dashboard, add your domains to the allowlist (at minimum `http://localhost:3000` for dev, and `https://www.veggat.com` for production; optionally also `http://127.0.0.1:3000`).
- If you ship mobile apps later, you can also add App IDs (iOS bundle id / Android package name) in the dashboard.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
