/**
 * @fileOverview  Guide: run a private Ethereum (Ganache or Anvil) on your own
 *                computer and connect it to Veggat's trading hub for risk-free
 *                P2P trades, transfers and crypto checkout with test ETH.
 *                Public route (listed in routes.ts) so it can be linked from
 *                the wallet panel before anyone signs in.
 * @stability     stable
 */

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PageHeader, PageShell } from "@/components/uicustom/chrome/page-header";

export const metadata: Metadata = {
  title: "Trade on a local test chain",
  description:
    "Set up Ganache or Anvil, connect the workspace to Veggat and trade with free test ETH. Nothing touches a real network.",
  alternates: { canonical: "/help/local-chains" },
};

const GANACHE_URL = "https://archive.trufflesuite.com/ganache/";
const FOUNDRY_URL = "https://getfoundry.sh/";

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="relative rounded-2xl border border-border/60 bg-card/70 p-5 shadow-e1 backdrop-blur-xl sm:p-6">
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-accent/12 text-sm font-semibold text-brand-accent-hover ring-1 ring-inset ring-brand-accent/25 dark:text-brand-accent-light"
        >
          {n}
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
        </div>
      </div>
    </li>
  );
}

function Kv({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-xl border border-border/60 bg-foreground/[0.03] p-3 text-[13px]">
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="font-mono text-foreground">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Shot({ src, alt, caption }: { src: string; alt: string; caption: string }) {
  return (
    <figure className="overflow-hidden rounded-xl border border-border/60 bg-foreground/[0.03]">
      <Image src={src} alt={alt} width={1200} height={800} className="h-auto w-full" sizes="(min-width: 768px) 640px, 100vw" />
      <figcaption className="px-3 py-2 text-xs text-muted-foreground">{caption}</figcaption>
    </figure>
  );
}

export default function LocalChainsGuidePage() {
  return (
    <PageShell width="prose" as="article" className="py-10 sm:py-14">
      <PageHeader
        eyebrow="Guide"
        title="Trade on a local test chain"
        description="Ganache or Anvil runs a private Ethereum on your own computer with free test ETH. Connect it to Veggat and practise P2P trades, wallet transfers and crypto checkout without touching a real network."
        size="lg"
        actions={
          <div className="flex flex-wrap gap-2">
            <a
              href={GANACHE_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-accent px-5 text-sm font-semibold text-brand-accent-foreground shadow-e2 transition-[background-color,transform,box-shadow] duration-200 hover:bg-brand-accent-hover motion-safe:hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Download Ganache
            </a>
            <Link
              href="/dashboard/trading"
              className="inline-flex min-h-11 items-center rounded-full border border-border/60 bg-surface-1/75 px-5 text-sm font-medium text-foreground backdrop-blur-xl transition-[border-color,background-color,transform] duration-200 hover:border-border hover:bg-foreground/[0.06] motion-safe:hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Open the trading hub
            </Link>
          </div>
        }
      />

      <p className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
        Everything below is local only. Test ETH has no value, and you should never paste a real seed phrase or private key into a
        test chain.
      </p>

      <ol className="mt-8 space-y-4">
        <Step n={1} title="Install a local chain">
          <p>
            <strong className="font-medium text-foreground">Ganache</strong> is a desktop app for Windows, macOS and Linux with a
            visual account list, which makes it the easiest choice. Get it from{" "}
            <a href={GANACHE_URL} target="_blank" rel="noreferrer noopener" className="underline underline-offset-4 hover:text-foreground">
              trufflesuite.com
            </a>
            .
          </p>
          <p>
            Prefer a terminal? <strong className="font-medium text-foreground">Anvil</strong> ships with Foundry (
            <a href={FOUNDRY_URL} target="_blank" rel="noreferrer noopener" className="underline underline-offset-4 hover:text-foreground">
              getfoundry.sh
            </a>
            ). Run <code className="rounded bg-foreground/[0.06] px-1.5 py-0.5 font-mono text-[12px] text-foreground">anvil</code> and skip
            to step 3; it listens on port 8545 with chain id 31337 and ten funded accounts.
          </p>
        </Step>

        <Step n={2} title="Create a Ganache workspace">
          <p>
            Open Ganache and choose <strong className="font-medium text-foreground">New Workspace (Ethereum)</strong>. Quickstart also
            works, but a named workspace keeps the same test accounts every time you start it.
          </p>
          <Shot src="/help/ganache-workspace.png" alt="Ganache new workspace screen with the workspace name field" caption="Workspace tab: give it a name, for example “Veggat Local”." />
          <p>On the Server tab keep the defaults. These are exactly what Veggat expects:</p>
          <Kv
            items={[
              ["Hostname", "127.0.0.1"],
              ["Port", "7545"],
              ["Network id", "5777"],
              ["Chain id", "1337"],
              ["Automine", "on"],
            ]}
          />
          <Shot src="/help/ganache-server.png" alt="Ganache server tab showing hostname 127.0.0.1, port 7545 and network id 5777" caption="Server tab: hostname, port and network id as Veggat expects them." />
          <p>
            On Accounts &amp; Keys leave ten accounts with 100 ETH each and keep{" "}
            <strong className="font-medium text-foreground">Autogenerate HD mnemonic off</strong>, so the addresses survive a restart.
            Press <strong className="font-medium text-foreground">Start</strong>. The Accounts screen now lists ten addresses with 100 ETH
            and the status bar shows <span className="font-mono text-foreground">RPC SERVER http://127.0.0.1:7545</span>.
          </p>
        </Step>

        <Step n={3} title="Connect it to Veggat">
          <p>
            Sign in, open the account menu (your avatar, top right) and expand{" "}
            <strong className="font-medium text-foreground">Wallets → Connect a wallet</strong>. The Dev Chains card shows Ganache as{" "}
            <span className="font-medium text-brand-accent">Online</span> as soon as the workspace is running.
          </p>
          <p>
            Open <strong className="font-medium text-foreground">Local Dev Chains</strong>. Veggat selects the chain that is online and lists
            its funded accounts. Choose <strong className="font-medium text-foreground">Add all</strong> (or Add on a single account), then{" "}
            <strong className="font-medium text-foreground">Activate</strong> the one you want to trade from. It becomes your active wallet:
            the inventory shows its balance and the trading hub treats it as connected.
          </p>
          <p>
            Web3 tools off? Turn them on first under{" "}
            <Link href="/settings?section=wallet" className="underline underline-offset-4 hover:text-foreground">
              Settings → Wallet
            </Link>
            .
          </p>
        </Step>

        <Step n={4} title="Trade">
          <p>
            Go to the{" "}
            <Link href="/dashboard/trading" className="underline underline-offset-4 hover:text-foreground">
              trading hub
            </Link>
            . <strong className="font-medium text-foreground">P2P Trade</strong> lets you search another user and exchange tokens through the
            offer window; <strong className="font-medium text-foreground">Internal Transfer</strong> moves tokens between two of your own test
            accounts; <strong className="font-medium text-foreground">Local Chain</strong> does the same against Ganache or Anvil directly.
            Drag items from your inventory into the offer grid, or shift-click them.
          </p>
          <p>
            <strong className="font-medium text-foreground">Paper Trade</strong> needs no chain at all: it uses a virtual USD balance at live
            market prices and is saved to your account.
          </p>
        </Step>

        <Step n={5} title="Optional: use MetaMask with the same chain">
          <p>
            If you would rather sign with a browser wallet, add a network in MetaMask with RPC URL{" "}
            <span className="font-mono text-foreground">http://127.0.0.1:7545</span>, chain id{" "}
            <span className="font-mono text-foreground">1337</span> and currency symbol ETH. Then import one of the Ganache accounts with the
            key icon next to it in the Ganache Accounts screen (private key import). Connect that wallet through{" "}
            <strong className="font-medium text-foreground">Wallets → Connect a wallet</strong> like any other extension.
          </p>
        </Step>

        <Step n={6} title="If something looks wrong">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="font-medium text-foreground">Ganache shows Offline.</strong> The app is open but the workspace is not started.
              Press Start on the workspace, then hit the refresh icon on the Dev Chains card.
            </li>
            <li>
              <strong className="font-medium text-foreground">Port 7545 is taken.</strong> Change the port on the Server tab. Self-hosters can
              point Veggat at it with <span className="font-mono text-foreground">NEXT_PUBLIC_GANACHE_RPC_URL</span>.
            </li>
            <li>
              <strong className="font-medium text-foreground">The accounts changed after a restart.</strong> Autogenerate HD mnemonic was on.
              Turn it off in Accounts &amp; Keys and add the new accounts again.
            </li>
            <li>
              <strong className="font-medium text-foreground">Balances look stale.</strong> Use “Mine 1 block” in Local Dev Chains or refresh
              the inventory; Ganache automines, Anvil mines on each transaction.
            </li>
          </ul>
        </Step>
      </ol>

      <p className="mt-8 text-sm text-muted-foreground">
        Questions or a step that did not match your screen?{" "}
        <Link href="/contact" className="underline underline-offset-4 hover:text-foreground">
          Tell us
        </Link>{" "}
        and we will update this guide.
      </p>
    </PageShell>
  );
}
