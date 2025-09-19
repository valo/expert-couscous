"use client";

import { useBalance, useReadContract } from "wagmi";

import { CONTRACT_ADDRESSES, SRM_ABI, TOKEN_METADATA } from "@/lib/contracts";

export function useEarnBalances(address?: `0x${string}`) {
  const srmAddress = CONTRACT_ADDRESSES.srm as `0x${string}` | undefined;
  const dbusdAddress = TOKEN_METADATA.DBUSD.address as `0x${string}` | undefined;

  const dbusdBalanceQuery = useBalance({
    address,
    token: dbusdAddress,
    query: {
      enabled: Boolean(address && dbusdAddress),
    },
  });

  const srmShareBalanceQuery = useBalance({
    address,
    token: srmAddress,
    query: {
      enabled: Boolean(address && srmAddress),
    },
  });

  const maxWithdrawQuery = useReadContract({
    abi: SRM_ABI,
    address: srmAddress,
    functionName: "maxWithdraw",
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(address && srmAddress),
    },
  });

  return {
    dbusdBalance: dbusdBalanceQuery.data,
    srmShareBalance: srmShareBalanceQuery.data,
    maxWithdraw:
      typeof maxWithdrawQuery.data === "bigint" ? maxWithdrawQuery.data : null,
    refetchDbusdBalance: dbusdBalanceQuery.refetch,
    refetchSrmShareBalance: srmShareBalanceQuery.refetch,
    refetchMaxWithdraw: maxWithdrawQuery.refetch,
  };
}
