"use client"

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react"
import {
  MONAD_CHAIN_ID,
  MONAD_CHAIN_ID_DECIMAL,
  MONAD_CHAIN_CONFIG,
  type TokenInfo,
  KNOWN_TOKENS,
  ERC20_ABI,
} from "./types"
import { toast } from "sonner"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  on: (event: string, handler: (...args: unknown[]) => void) => void
  removeListener: (
    event: string,
    handler: (...args: unknown[]) => void
  ) => void
}

interface WalletContextType {
  address: string | null
  chainId: string | null
  isConnected: boolean
  isConnecting: boolean
  tokens: TokenInfo[]
  nativeBalance: string
  ethProvider: EthereumProvider | null
  connect: () => Promise<void>
  disconnect: () => void
  switchToMonad: () => Promise<void>
  refreshTokens: () => Promise<void>
}

const WalletContext = createContext<WalletContextType>({
  address: null,
  chainId: null,
  isConnected: false,
  isConnecting: false,
  tokens: [],
  nativeBalance: "0",
  ethProvider: null,
  connect: async () => {},
  disconnect: () => {},
  switchToMonad: async () => {},
  refreshTokens: async () => {},
})

export function useWallet() {
  return useContext(WalletContext)
}

/* ------------------------------------------------------------------ */
/*  Safe provider discovery                                            */
/* ------------------------------------------------------------------ */

function discoverProviderViaEIP6963(): Promise<EthereumProvider | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(null)
      return
    }

    const timeout = setTimeout(() => resolve(null), 800)

    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail
      if (detail?.provider && typeof detail.provider.request === "function") {
        clearTimeout(timeout)
        window.removeEventListener("eip6963:announceProvider", handler as EventListener)
        resolve(detail.provider as EthereumProvider)
      }
    }

    window.addEventListener("eip6963:announceProvider", handler as EventListener)
    window.dispatchEvent(new Event("eip6963:requestProvider"))
  })
}

function discoverProviderDirect(): Promise<EthereumProvider | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(null)
      return
    }

    const timeout = setTimeout(() => resolve(null), 1000)

    setTimeout(() => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const eth = (window as any).ethereum
        if (eth && typeof eth.request === "function") {
          clearTimeout(timeout)
          resolve(eth as EthereumProvider)
        } else {
          clearTimeout(timeout)
          resolve(null)
        }
      } catch {
        clearTimeout(timeout)
        resolve(null)
      }
    }, 0)
  })
}

async function safeGetProvider(): Promise<EthereumProvider | null> {
  const eip6963 = await discoverProviderViaEIP6963()
  if (eip6963) return eip6963
  return discoverProviderDirect()
}

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null)
  const [chainId, setChainId] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [tokens, setTokens] = useState<TokenInfo[]>([])
  const [nativeBalance, setNativeBalance] = useState("0")
  const [provider, setProvider] = useState<EthereumProvider | null>(null)

  const isConnected = !!address

  const switchToMonad = useCallback(
    async (prov?: EthereumProvider | null) => {
      const p = prov ?? provider
      if (!p) return

      try {
        const currentChain = (await p.request({ method: "eth_chainId" })) as string
        if (Number.parseInt(currentChain, 16) === MONAD_CHAIN_ID_DECIMAL) {
          setChainId(MONAD_CHAIN_ID)
          return
        }
      } catch {
        // continue
      }

      try {
        await p.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: MONAD_CHAIN_ID }],
        })
        setChainId(MONAD_CHAIN_ID)
      } catch (switchError: unknown) {
        const err = switchError as { code?: number }
        if (err.code === 4902 || err.code === -32603) {
          try {
            await p.request({
              method: "wallet_addEthereumChain",
              params: [MONAD_CHAIN_CONFIG],
            })
            setChainId(MONAD_CHAIN_ID)
          } catch {
            toast.error("Please add and switch to Monad Testnet manually.")
          }
        } else {
          toast.error("Please switch to Monad Testnet in your wallet.")
        }
      }
    },
    [provider],
  )

  const refreshTokens = useCallback(async () => {
    if (!address || !provider) return
    try {
      const { ethers } = await import("ethers")
      const bp = new ethers.BrowserProvider(provider)
      const balance = await bp.getBalance(address)
      setNativeBalance(ethers.formatEther(balance))

      const list: TokenInfo[] = []
      for (const tok of KNOWN_TOKENS) {
        try {
          const c = new ethers.Contract(tok.address, ERC20_ABI, bp)
          const bal = await c.balanceOf(address)
          if (bal > 0n) {
            list.push({
              address: tok.address,
              symbol: tok.symbol,
              name: tok.name,
              decimals: tok.decimals,
              balance: bal.toString(),
              balanceFormatted: ethers.formatUnits(bal, tok.decimals),
            })
          }
        } catch {
          /* token may not exist on chain */
        }
      }
      setTokens(list)
    } catch {
      /* provider error */
    }
  }, [address, provider])

  const connect = useCallback(async () => {
    setIsConnecting(true)
    try {
      const prov = await safeGetProvider()

      if (!prov) {
        toast.error("No wallet detected. Please install MetaMask.")
        window.open("https://metamask.io/download/", "_blank")
        setIsConnecting(false)
        return
      }

      setProvider(prov)

      const accounts = (await prov.request({
        method: "eth_requestAccounts",
      })) as string[]

      if (accounts && accounts.length > 0) {
        setAddress(accounts[0])
        const chain = (await prov.request({
          method: "eth_chainId",
        })) as string
        setChainId(chain)

        if (Number.parseInt(chain, 16) !== MONAD_CHAIN_ID_DECIMAL) {
          await switchToMonad(prov)
        }

        toast.success("Wallet connected!")
      }
    } catch (err) {
      console.error("[v0] Wallet connection error:", err)
      toast.error("Failed to connect wallet. Please try again.")
    } finally {
      setIsConnecting(false)
    }
  }, [switchToMonad])

  const disconnect = useCallback(() => {
    setAddress(null)
    setChainId(null)
    setTokens([])
    setNativeBalance("0")
    setProvider(null)
    toast.info("Wallet disconnected.")
  }, [])

  useEffect(() => {
    if (!provider) return

    const onAccounts = (...args: unknown[]) => {
      const accs = args[0] as string[]
      if (!accs || accs.length === 0) disconnect()
      else setAddress(accs[0])
    }
    const onChain = (...args: unknown[]) => {
      setChainId(args[0] as string)
    }

    try {
      provider.on("accountsChanged", onAccounts)
      provider.on("chainChanged", onChain)
    } catch {
      /* extension may not support events */
    }

    return () => {
      try {
        provider.removeListener("accountsChanged", onAccounts)
        provider.removeListener("chainChanged", onChain)
      } catch {
        /* cleanup */
      }
    }
  }, [provider, disconnect])

  useEffect(() => {
    if (isConnected) refreshTokens()
  }, [isConnected, refreshTokens])

  return (
    <WalletContext.Provider
      value={{
        address,
        chainId,
        isConnected,
        isConnecting,
        tokens,
        nativeBalance,
        ethProvider: provider,
        connect,
        disconnect,
        switchToMonad,
        refreshTokens,
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}
