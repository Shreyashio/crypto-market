export interface TokenInfo {
  address: string
  symbol: string
  name: string
  decimals: number
  balance: string
  balanceFormatted: string
  logoUrl?: string
}

export type ListingStatus = "OPEN" | "SOLD" | "CANCELLED"

export interface Listing {
  id: string
  tokenAddress: string
  tokenSymbol: string
  tokenName: string
  tokenDecimals: number
  tokenAmount: string
  sellerAddress: string
  askingPriceINR: number
  marketPriceINR: number
  discountPercent: number
  status: ListingStatus
  createdAt: string
  updatedAt: string
  txHash?: string
  buyerAddress?: string
}

export interface Transaction {
  id: string
  listingId: string
  buyerAddress: string
  sellerAddress: string
  tokenSymbol: string
  tokenAmount: string
  amountINR: number
  razorpayOrderId: string
  razorpayPaymentId?: string
  escrowTxHash?: string
  status: "PENDING" | "PAID" | "RELEASING" | "RELEASED" | "FAILED"
  createdAt: string
}

export interface Payout {
  id: string
  sellerAddress: string
  amountINR: number
  status: "PENDING" | "PROCESSING" | "COMPLETED"
  transactionId: string
  createdAt: string
}

export const MONAD_CHAIN_ID_DECIMAL = 10143
export const MONAD_CHAIN_ID = "0x279f" // Monad Testnet chain ID (10143 decimal)
export const MONAD_RPC_URL = "https://testnet-rpc.monad.xyz"
export const MONAD_CHAIN_CONFIG = {
  chainId: MONAD_CHAIN_ID,
  chainName: "Monad Testnet",
  nativeCurrency: {
    name: "MON",
    symbol: "MON",
    decimals: 18,
  },
  rpcUrls: [MONAD_RPC_URL],
  blockExplorerUrls: ["https://testnet.monadexplorer.com"],
}

// Common ERC-20 tokens on Monad (example addresses)
export const KNOWN_TOKENS: { address: string; symbol: string; name: string; decimals: number }[] = [
  {
    address: "0x0000000000000000000000000000000000000001",
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
  },
  {
    address: "0x0000000000000000000000000000000000000002",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
  },
  {
    address: "0x0000000000000000000000000000000000000003",
    symbol: "WETH",
    name: "Wrapped ETH",
    decimals: 18,
  },
]

export const ESCROW_CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000" // Deploy and update

export const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
]

export const ESCROW_ABI = [
  "function createListing(address token, uint256 amount) returns (uint256)",
  "function releaseToBuyer(uint256 listingId, address buyer)",
  "function cancelListing(uint256 listingId)",
  "event ListingCreated(uint256 indexed listingId, address indexed seller, address token, uint256 amount)",
  "event TokensReleased(uint256 indexed listingId, address indexed buyer)",
  "event ListingCancelled(uint256 indexed listingId)",
]
