import { TOKEN_METADATA } from "@/lib/contracts";

export const SECONDS_PER_YEAR = BigInt(31536000);
export const APY_SCALE = BigInt(1000000);

export const DBUSD_DECIMALS = TOKEN_METADATA.DBUSD.decimals;
export const DBUSD_SYMBOL = TOKEN_METADATA.DBUSD.symbol;

export type Mode = "deposit" | "withdraw";
