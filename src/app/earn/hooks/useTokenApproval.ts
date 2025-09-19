"use client";

import { useMemo } from "react";
import { erc20Abi } from "viem";
import { useReadContract } from "wagmi";

export function useTokenApproval(
  owner?: `0x${string}`,
  tokenAddress?: `0x${string}`,
  spenderAddress?: `0x${string}`,
  amount?: bigint,
) {
  const allowanceQuery = useReadContract({
    abi: erc20Abi,
    address: tokenAddress,
    functionName: "allowance",
    args: owner && spenderAddress ? [owner, spenderAddress] : undefined,
    query: {
      enabled: Boolean(owner && tokenAddress && spenderAddress),
    },
  });

  const needsApproval = useMemo(() => {
    if (!amount) {
      return false;
    }

    const allowance = allowanceQuery.data;

    if (!allowance) {
      return true;
    }

    return allowance < amount;
  }, [allowanceQuery.data, amount]);

  return {
    allowanceQuery,
    needsApproval,
  };
}
