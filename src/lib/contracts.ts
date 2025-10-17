import type { Abi } from "viem";
import psmArtifact from "./abi/PSM.json";
import savingsRateModuleArtifact from "./abi/SavingsRateModule.json";
import vaultArtifact from "./abi/Vault.json";
import eulerRouterArtifact from "./abi/EulerRouter.json";

export const CONTRACT_ADDRESSES = {
  psm: process.env.NEXT_PUBLIC_PSM_ADDRESS as `0x${string}` | undefined,
  usdc: process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}` | undefined,
  dbusd: process.env.NEXT_PUBLIC_DBUSD_ADDRESS as `0x${string}` | undefined,
  srm: process.env.NEXT_PUBLIC_SRM_ADDRESS as `0x${string}` | undefined,
  weth: process.env.NEXT_PUBLIC_WETH_ADDRESS?.trim() as `0x${string}` | undefined,
  wethVault: process.env.NEXT_PUBLIC_WETH_VAULT_ADDRESS?.trim() as `0x${string}` | undefined,
  dbusdVault: process.env.NEXT_PUBLIC_DBUSD_VAULT_ADDRESS?.trim() as `0x${string}` | undefined,
} as const;

export const TOKEN_METADATA = {
  USDC: {
    symbol: "USDC",
    decimals: 6,
    address: CONTRACT_ADDRESSES.usdc,
  },
  DBUSD: {
    symbol: "dbUSD",
    decimals: 18,
    address: CONTRACT_ADDRESSES.dbusd,
  },
  WETH: {
    symbol: "WETH",
    decimals: 18,
    address: CONTRACT_ADDRESSES.weth,
  },
} as const;

export const PSM_ABI = psmArtifact as Abi;
export const SRM_ABI = savingsRateModuleArtifact as Abi;
export const VAULT_ABI = vaultArtifact as Abi;
export const EULER_ROUTER_ABI = eulerRouterArtifact as Abi;
