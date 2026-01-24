// /config/index.ts
import { cookieStorage, createStorage } from '@wagmi/core'
import { http } from 'wagmi'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { mainnet, base, arbitrum /* add more as needed */ } from '@reown/appkit/networks'

// required by AppKit
export const projectId = process.env.NEXT_PUBLIC_PROJECT_ID
if (!projectId) {
  throw new Error('Project ID is not defined')
}

export const networks = [mainnet, base, arbitrum]

// Create Wagmi Adapter (Config)
export const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks,
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
