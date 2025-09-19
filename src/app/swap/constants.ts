import { TOKEN_METADATA } from "@/lib/contracts";

export const DIRECTIONS = {
  USDC_TO_DBUSD: {
    label: "USDC → dbUSD",
    from: TOKEN_METADATA.USDC,
    to: TOKEN_METADATA.DBUSD,
    swapFn: "swapToSynthGivenIn" as const,
    quoteFn: "quoteToSynthGivenIn" as const,
  },
  DBUSD_TO_USDC: {
    label: "dbUSD → USDC",
    from: TOKEN_METADATA.DBUSD,
    to: TOKEN_METADATA.USDC,
    swapFn: "swapToUnderlyingGivenIn" as const,
    quoteFn: "quoteToUnderlyingGivenIn" as const,
  },
} as const;

export type DirectionKey = keyof typeof DIRECTIONS;
