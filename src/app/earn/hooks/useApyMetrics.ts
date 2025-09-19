"use client";

import { useReadContract } from "wagmi";

import { CONTRACT_ADDRESSES, SRM_ABI } from "@/lib/contracts";

import { calculateApyPercent, formatApyDisplay } from "../utils";

export function useApyMetrics() {
  const srmAddress = CONTRACT_ADDRESSES.srm as `0x${string}` | undefined;

  const dripRateQuery = useReadContract({
    abi: SRM_ABI,
    address: srmAddress,
    functionName: "dripRate",
    query: {
      enabled: Boolean(srmAddress),
    },
  });

  const totalAssetsQuery = useReadContract({
    abi: SRM_ABI,
    address: srmAddress,
    functionName: "totalAssets",
    query: {
      enabled: Boolean(srmAddress),
    },
  });

  const dripRate =
    typeof dripRateQuery.data === "bigint" ? dripRateQuery.data : null;
  const totalAssets =
    typeof totalAssetsQuery.data === "bigint" ? totalAssetsQuery.data : null;

  const apyPercent = calculateApyPercent(dripRate, totalAssets);

  return {
    dripRate,
    totalAssets,
    apyDisplay: formatApyDisplay(apyPercent),
    refetchDripRate: dripRateQuery.refetch,
    refetchTotalAssets: totalAssetsQuery.refetch,
  };
}
