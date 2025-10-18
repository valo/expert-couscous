"use client";

import { useCallback, useMemo } from "react";
import { erc20Abi, formatUnits } from "viem";
import { useBalance, useReadContract } from "wagmi";

import { SECONDS_PER_YEAR } from "@/app/earn/constants";
import {
  EULER_ROUTER_ABI,
  TOKEN_METADATA,
  VAULT_ABI,
} from "@/lib/contracts";

import { DBUSD_DECIMALS } from "../constants";

const RAY_DECIMALS = 27;

function pow10(exp: number): bigint {
  return BigInt(10) ** BigInt(exp);
}

function convertDecimals(
  amount: bigint,
  fromDecimals: number,
  toDecimals: number,
): bigint {
  if (fromDecimals === toDecimals) {
    return amount;
  }

  if (fromDecimals > toDecimals) {
    return amount / pow10(fromDecimals - toDecimals);
  }

  return amount * pow10(toDecimals - fromDecimals);
}

type BorrowContractDataArgs = {
  address?: `0x${string}`;
  wethAddress?: `0x${string}`;
  dbusdAddress?: `0x${string}`;
  wethVaultAddress?: `0x${string}`;
  dbusdVaultAddress?: `0x${string}`;
};

export function useBorrowContractData({
  address,
  wethAddress,
  dbusdAddress,
  wethVaultAddress,
  dbusdVaultAddress,
}: BorrowContractDataArgs) {
  const wethAllowanceQuery = useReadContract({
    abi: erc20Abi,
    address: wethAddress,
    functionName: "allowance",
    args: address && wethVaultAddress ? [address, wethVaultAddress] : undefined,
    query: {
      enabled: Boolean(address && wethAddress && wethVaultAddress),
    },
  });

  const dbusdAllowanceQuery = useReadContract({
    abi: erc20Abi,
    address: dbusdAddress,
    functionName: "allowance",
    args:
      address && dbusdVaultAddress ? [address, dbusdVaultAddress] : undefined,
    query: {
      enabled: Boolean(address && dbusdAddress && dbusdVaultAddress),
    },
  });

  const {
    data: wethWalletBalance,
    refetch: refetchWethWalletBalance,
  } = useBalance({
    address,
    token: wethAddress,
    query: {
      enabled: Boolean(address && wethAddress),
    },
  });

  const {
    data: ethWalletBalance,
    refetch: refetchEthWalletBalance,
  } = useBalance({
    address,
    query: {
      enabled: Boolean(address),
    },
  });

  const {
    data: dbusdWalletBalance,
    refetch: refetchDbusdWalletBalance,
  } = useBalance({
    address,
    token: dbusdAddress,
    query: {
      enabled: Boolean(address && dbusdAddress),
    },
  });

  const {
    data: shareBalanceRaw,
    refetch: refetchShareBalance,
  } = useReadContract({
    abi: VAULT_ABI,
    address: wethVaultAddress,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(address && wethVaultAddress),
    },
  });

  const shareBalance =
    typeof shareBalanceRaw === "bigint" ? shareBalanceRaw : null;

  const {
    data: maxWithdrawAssetsRaw,
    refetch: refetchMaxWithdrawAssets,
  } = useReadContract({
    abi: VAULT_ABI,
    address: wethVaultAddress,
    functionName: "convertToAssets",
    args: shareBalance !== null ? [shareBalance] : undefined,
    query: {
      enabled: Boolean(wethVaultAddress && shareBalance !== null),
    },
  });

  const maxWithdrawValue =
    typeof maxWithdrawAssetsRaw === "bigint" ? maxWithdrawAssetsRaw : null;

  const {
    data: borrowedAmountRaw,
    refetch: refetchBorrowedAmount,
  } = useReadContract({
    abi: VAULT_ABI,
    address: dbusdVaultAddress,
    functionName: "debtOf",
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(address && dbusdVaultAddress),
    },
  });

  const borrowedAmount =
    typeof borrowedAmountRaw === "bigint" ? borrowedAmountRaw : null;

  const {
    data: availableLiquidityRaw,
    refetch: refetchAvailableLiquidity,
  } = useReadContract({
    abi: VAULT_ABI,
    address: dbusdVaultAddress,
    functionName: "cash",
    query: {
      enabled: Boolean(dbusdVaultAddress),
    },
  });

  const availableLiquidity =
    typeof availableLiquidityRaw === "bigint" ? availableLiquidityRaw : null;

  const { data: oracleRaw } = useReadContract({
    abi: VAULT_ABI,
    address: dbusdVaultAddress,
    functionName: "oracle",
    query: {
      enabled: Boolean(dbusdVaultAddress),
    },
  });

  const oracleAddress =
    typeof oracleRaw === "string" ? (oracleRaw as `0x${string}`) : undefined;

  const { data: unitOfAccountRaw } = useReadContract({
    abi: VAULT_ABI,
    address: dbusdVaultAddress,
    functionName: "unitOfAccount",
    query: {
      enabled: Boolean(dbusdVaultAddress),
    },
  });

  const unitOfAccountAddress =
    typeof unitOfAccountRaw === "string"
      ? (unitOfAccountRaw as `0x${string}`)
      : undefined;

  const {
    data: collateralValueRaw,
    refetch: refetchCollateralValue,
  } = useReadContract({
    abi: EULER_ROUTER_ABI,
    address: oracleAddress,
    functionName: "getQuote",
    args:
      oracleAddress &&
      unitOfAccountAddress &&
      wethVaultAddress &&
      shareBalance !== null
        ? [shareBalance, wethVaultAddress, unitOfAccountAddress]
        : undefined,
    query: {
      enabled: Boolean(
        oracleAddress &&
          unitOfAccountAddress &&
          wethVaultAddress &&
          shareBalance !== null,
      ),
    },
  });

  const collateralValue =
    typeof collateralValueRaw === "bigint" ? collateralValueRaw : null;

  const { data: ltvBorrowRaw, refetch: refetchLtvBorrow } = useReadContract({
    abi: VAULT_ABI,
    address: dbusdVaultAddress,
    functionName: "LTVBorrow",
    args: wethVaultAddress ? [wethVaultAddress] : undefined,
    query: {
      enabled: Boolean(dbusdVaultAddress && wethVaultAddress),
    },
  });

  const maxLtvBasisPoints = useMemo(() => {
    if (typeof ltvBorrowRaw === "number") {
      return ltvBorrowRaw;
    }

    if (typeof ltvBorrowRaw === "bigint") {
      return Number(ltvBorrowRaw);
    }

    return null;
  }, [ltvBorrowRaw]);

  const { data: liquidationLtvRaw, refetch: refetchLtvLiquidation } = useReadContract({
    abi: VAULT_ABI,
    address: dbusdVaultAddress,
    functionName: "LTVLiquidation",
    args: wethVaultAddress ? [wethVaultAddress] : undefined,
    query: {
      enabled: Boolean(dbusdVaultAddress && wethVaultAddress),
    },
  });

  const liquidationLtvBasisPoints = useMemo(() => {
    if (typeof liquidationLtvRaw === "number") {
      return liquidationLtvRaw;
    }

    if (typeof liquidationLtvRaw === "bigint") {
      return Number(liquidationLtvRaw);
    }

    return null;
  }, [liquidationLtvRaw]);

  const {
    data: interestRateRaw,
    refetch: refetchInterestRate,
  } = useReadContract({
    abi: VAULT_ABI,
    address: dbusdVaultAddress,
    functionName: "interestRate",
    query: {
      enabled: Boolean(dbusdVaultAddress),
    },
  });

  const interestRatePerSecond =
    typeof interestRateRaw === "bigint" ? interestRateRaw : null;

  const unitOfAccountMetadata = useMemo(() => {
    if (!unitOfAccountAddress) {
      return null;
    }

    return (
      Object.values(TOKEN_METADATA).find(
        (token) =>
          token.address?.toLowerCase() === unitOfAccountAddress.toLowerCase(),
      ) ?? null
    );
  }, [unitOfAccountAddress]);

  const unitOfAccountDecimals = unitOfAccountMetadata?.decimals ?? 6;
  const unitOfAccountSymbol = unitOfAccountMetadata?.symbol ?? "USDC";

  const maxBorrowValue = useMemo(() => {
    if (collateralValue === null || maxLtvBasisPoints === null) {
      return null;
    }

    return (collateralValue * BigInt(maxLtvBasisPoints)) / BigInt(10000);
  }, [collateralValue, maxLtvBasisPoints]);

  const maxBorrowValueInDbusd = useMemo(() => {
    if (maxBorrowValue === null) {
      return null;
    }

    const decimalsDelta = DBUSD_DECIMALS - unitOfAccountDecimals;

    if (decimalsDelta === 0) {
      return maxBorrowValue;
    }

    if (decimalsDelta > 0) {
      return maxBorrowValue * pow10(decimalsDelta);
    }

    const divisor = pow10(Math.abs(decimalsDelta));

    if (divisor === BigInt(0)) {
      return null;
    }

    return maxBorrowValue / divisor;
  }, [maxBorrowValue, unitOfAccountDecimals]);

  const borrowHeadroom = useMemo(() => {
    if (
      maxBorrowValueInDbusd === null ||
      borrowedAmount === null ||
      availableLiquidity === null
    ) {
      return null;
    }

    if (maxBorrowValueInDbusd <= borrowedAmount) {
      return BigInt(0);
    }

    const headroomByLtv = maxBorrowValueInDbusd - borrowedAmount;

    return headroomByLtv < availableLiquidity
      ? headroomByLtv
      : availableLiquidity;
  }, [availableLiquidity, borrowedAmount, maxBorrowValueInDbusd]);

  const borrowedAmountInUnit = useMemo(() => {
    if (borrowedAmount === null) {
      return null;
    }

    return convertDecimals(
      borrowedAmount,
      DBUSD_DECIMALS,
      unitOfAccountDecimals,
    );
  }, [borrowedAmount, unitOfAccountDecimals]);

  const minCollateralValueRequired = useMemo(() => {
    if (
      borrowedAmountInUnit === null ||
      maxLtvBasisPoints === null ||
      maxLtvBasisPoints === 0
    ) {
      return null;
    }

    const numerator = borrowedAmountInUnit * BigInt(10000);
    const denominator = BigInt(maxLtvBasisPoints);
    return (numerator + denominator - BigInt(1)) / denominator;
  }, [borrowedAmountInUnit, maxLtvBasisPoints]);

  const availableCollateralValue = useMemo(() => {
    if (collateralValue === null || minCollateralValueRequired === null) {
      return null;
    }

    if (collateralValue <= minCollateralValueRequired) {
      return BigInt(0);
    }

    return collateralValue - minCollateralValueRequired;
  }, [collateralValue, minCollateralValueRequired]);

  const withdrawHeadroomAssets = useMemo(() => {
    if (
      availableCollateralValue === null ||
      collateralValue === null ||
      collateralValue === BigInt(0) ||
      maxWithdrawValue === null
    ) {
      return null;
    }

    return (availableCollateralValue * maxWithdrawValue) / collateralValue;
  }, [availableCollateralValue, collateralValue, maxWithdrawValue]);

  const convertAssetsToUnit = useCallback(
    (assets: bigint | null | undefined) => {
      if (
        assets === null ||
        assets === undefined ||
        collateralValue === null ||
        maxWithdrawValue === null ||
        maxWithdrawValue === BigInt(0)
      ) {
        return null;
      }

      return (assets * collateralValue) / maxWithdrawValue;
    },
    [collateralValue, maxWithdrawValue],
  );

  const convertDbusdToUnit = useCallback(
    (amount: bigint | null | undefined) => {
      if (amount === null || amount === undefined) {
        return null;
      }

      return convertDecimals(amount, DBUSD_DECIMALS, unitOfAccountDecimals);
    },
    [unitOfAccountDecimals],
  );

  const borrowAprPercent = useMemo(() => {
    if (interestRatePerSecond === null) {
      return null;
    }

    const ratePerSecond = Number(formatUnits(interestRatePerSecond, RAY_DECIMALS));

    if (!Number.isFinite(ratePerSecond)) {
      return null;
    }

    const apr = ratePerSecond * Number(SECONDS_PER_YEAR) * 100;

    if (!Number.isFinite(apr)) {
      return null;
    }

    return apr;
  }, [interestRatePerSecond]);

  const refetchAll = useCallback(async () => {
    await Promise.allSettled([
      wethAllowanceQuery.refetch?.(),
      dbusdAllowanceQuery.refetch?.(),
      refetchWethWalletBalance?.(),
      refetchEthWalletBalance?.(),
      refetchDbusdWalletBalance?.(),
      refetchShareBalance?.(),
      refetchMaxWithdrawAssets?.(),
      refetchBorrowedAmount?.(),
      refetchAvailableLiquidity?.(),
      refetchCollateralValue?.(),
      refetchLtvBorrow?.(),
      refetchLtvLiquidation?.(),
      refetchInterestRate?.(),
    ]);
  }, [
    refetchAvailableLiquidity,
    dbusdAllowanceQuery,
    refetchBorrowedAmount,
    refetchCollateralValue,
    refetchDbusdWalletBalance,
    refetchInterestRate,
    refetchLtvBorrow,
    refetchLtvLiquidation,
    refetchMaxWithdrawAssets,
    refetchShareBalance,
    refetchWethWalletBalance,
    refetchEthWalletBalance,
    wethAllowanceQuery,
  ]);

  return {
    wethAllowanceQuery,
    dbusdAllowanceQuery,
    wethWalletBalance,
    ethWalletBalance,
    dbusdWalletBalance,
    shareBalance,
    maxWithdrawValue,
    borrowedAmount,
    collateralValue,
    unitOfAccountDecimals,
    unitOfAccountSymbol,
    maxBorrowValue,
    maxBorrowValueInDbusd,
    borrowHeadroom,
    withdrawHeadroomAssets,
    borrowAprPercent,
    interestRatePerSecond,
    maxLtvBasisPoints,
    liquidationLtvBasisPoints,
    availableLiquidity,
    borrowedAmountInUnit,
    convertAssetsToUnit,
    convertDbusdToUnit,
    refetchAll,
  };
}
