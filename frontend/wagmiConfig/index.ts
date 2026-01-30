// /config/index.ts
import { cookieStorage, createStorage } from '@wagmi/core'
import { http } from 'wagmi'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { mainnet, base, arbitrum } from 'wagmi/chains'

// required by AppKit
export const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? process.env.NEXT_PUBLIC_PROJECT_ID
if (!projectId) {
  throw new Error('WalletConnect/Reown Project ID is not defined')
}

export const networks = [mainnet, base, arbitrum] as const;

// Create Wagmi Adapter (Config)
export const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks: networks as any, // Type assertion for appkit compatibility
  ssr: true, // delays store hydration to avoid mismatch
  storage: createStorage({ storage: cookieStorage }),
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
    [arbitrum.id]: http(),
  },
})

// export wagmi config for Provider
export const config = wagmiAdapter.wagmiConfig
