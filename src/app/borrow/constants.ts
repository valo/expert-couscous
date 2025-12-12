import { TOKEN_METADATA } from "@/lib/contracts";

export const WETH_DECIMALS = TOKEN_METADATA.WETH.decimals;
export const WETH_SYMBOL = TOKEN_METADATA.WETH.symbol;

export const WBTC_DECIMALS = TOKEN_METADATA.WBTC.decimals;
export const WBTC_SYMBOL = TOKEN_METADATA.WBTC.symbol;

export const DBUSD_DECIMALS = TOKEN_METADATA.DBUSD.decimals;
export const DBUSD_SYMBOL = TOKEN_METADATA.DBUSD.symbol;

export type BorrowMode =
  | "depositCollateral"
  | "withdrawCollateral"
  | "borrowDbusd"
  | "repayDbusd";
