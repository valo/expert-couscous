import type { Abi } from "viem";
import psmArtifact from "./abi/PSM.json";

export const CONTRACT_ADDRESSES = {
  psm: process.env.NEXT_PUBLIC_PSM_ADDRESS as `0x${string}` | undefined,
  usdc: process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}` | undefined,
  dbusd: process.env.NEXT_PUBLIC_DBUSD_ADDRESS as `0x${string}` | undefined,
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
} as const;

export const PSM_ABI = psmArtifact as Abi;
