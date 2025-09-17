import { isAddress } from "viem";

import { CONTRACT_ADDRESSES } from "./contracts";

type ValidationEntry = {
  key: string;
  value: string | undefined;
};

const REQUIRED_CONTRACT_ENV: readonly ValidationEntry[] = [
  { key: "NEXT_PUBLIC_PSM_ADDRESS", value: CONTRACT_ADDRESSES.psm },
  { key: "NEXT_PUBLIC_USDC_ADDRESS", value: CONTRACT_ADDRESSES.usdc },
  { key: "NEXT_PUBLIC_DBUSD_ADDRESS", value: CONTRACT_ADDRESSES.dbusd },
];

export type ContractConfigValidation = {
  missing: readonly string[];
  invalid: readonly string[];
  hasError: boolean;
};

function validate(entries: readonly ValidationEntry[]): ContractConfigValidation {
  const missing = entries
    .filter(({ value }) => !value)
    .map(({ key }) => key);

  const invalid = entries
    .filter(({ value }) => value !== undefined && !isAddress(value))
    .map(({ key }) => key);

  return {
    missing,
    invalid,
    hasError: missing.length > 0 || invalid.length > 0,
  };
}

export const CONTRACT_CONFIG_VALIDATION = validate(REQUIRED_CONTRACT_ENV);
