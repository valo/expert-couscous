import { formatUnits } from "viem";

import { APY_SCALE, DBUSD_DECIMALS, SECONDS_PER_YEAR } from "./constants";

export function formatTokenAmount(
  value: bigint,
  decimals: number,
  precision = 6,
): string {
  const formatted = formatUnits(value, decimals);

  if (!formatted.includes(".")) {
    return formatted;
  }

  const [integer, fraction] = formatted.split(".");
  const trimmedFraction = fraction.slice(0, precision).replace(/0+$/, "");

  return trimmedFraction ? `${integer}.${trimmedFraction}` : integer;
}

export function calculateApyPercent(
  dripRate: bigint | null,
  totalAssets: bigint | null,
): number | null {
  if (!dripRate || !totalAssets || totalAssets === BigInt(0)) {
    return null;
  }

  const annualInterest = dripRate * SECONDS_PER_YEAR;
  const scaledPercent =
    (annualInterest * BigInt(100) * APY_SCALE) / totalAssets;
  const numeric = Number(scaledPercent) / Number(APY_SCALE);

  if (!Number.isFinite(numeric)) {
    return null;
  }

  return numeric;
}

export function formatApyDisplay(apyPercent: number | null): string {
  if (apyPercent === null) {
    return "—";
  }

  return `${apyPercent.toFixed(2)}%`;
}

export function formatDbusdAmount(value: bigint): string {
  return formatTokenAmount(value, DBUSD_DECIMALS);
}
