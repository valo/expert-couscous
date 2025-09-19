"use client";

import { useReadContract } from "wagmi";

import { CONTRACT_ADDRESSES, SRM_ABI } from "@/lib/contracts";

export function useEarnPreviews(
  depositAmount?: bigint,
  withdrawAmount?: bigint,
) {
  const srmAddress = CONTRACT_ADDRESSES.srm as `0x${string}` | undefined;

  const previewDepositQuery = useReadContract({
    abi: SRM_ABI,
    address: srmAddress,
    functionName: "previewDeposit",
    args: depositAmount ? [depositAmount] : undefined,
    query: {
      enabled: Boolean(srmAddress && depositAmount),
    },
  });

  const previewWithdrawQuery = useReadContract({
    abi: SRM_ABI,
    address: srmAddress,
    functionName: "previewWithdraw",
    args: withdrawAmount ? [withdrawAmount] : undefined,
    query: {
      enabled: Boolean(srmAddress && withdrawAmount),
    },
  });

  return {
    previewDepositShares:
      typeof previewDepositQuery.data === "bigint"
        ? previewDepositQuery.data
        : null,
    previewWithdrawShares:
      typeof previewWithdrawQuery.data === "bigint"
        ? previewWithdrawQuery.data
        : null,
  };
}
