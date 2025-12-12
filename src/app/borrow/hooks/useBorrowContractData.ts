"use client";

import { useCallback, useMemo } from "react";
import { erc20Abi, formatUnits } from "viem";
import { useBalance, useReadContract } from "wagmi";

import { SECONDS_PER_YEAR } from "@/app/earn/constants";
import {
  EULER_ROUTER_ABI,
  EVC_ABI,
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
  wbtcAddress?: `0x${string}`;
  dbusdAddress?: `0x${string}`;
  wethVaultAddress?: `0x${string}`;
  wbtcVaultAddress?: `0x${string}`;
  dbusdVaultAddress?: `0x${string}`;
  evcAddress?: `0x${string}`;
};

type CollateralContractData = {
  key: "weth" | "wbtc";
  symbol: string;
  decimals: number;
  tokenAddress?: `0x${string}`;
  vaultAddress?: `0x${string}`;
  allowanceQuery: ReturnType<typeof useReadContract>;
  walletBalance: ReturnType<typeof useBalance>["data"];
  shareBalance: bigint | null;
  maxWithdrawAssets: bigint | null;
  collateralValue: bigint | null;
  maxLtvBasisPoints: number | null;
  liquidationLtvBasisPoints: number | null;
  withdrawHeadroomAssets: bigint | null;
  convertAssetsToUnit: (assets: bigint | null | undefined) => bigint | null;
  isCollateralEnabled: boolean | null;
};

export function useBorrowContractData({
  address,
  wethAddress,
  wbtcAddress,
  dbusdAddress,
  wethVaultAddress,
  wbtcVaultAddress,
  dbusdVaultAddress,
  evcAddress,
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

  const wbtcAllowanceQuery = useReadContract({
    abi: erc20Abi,
    address: wbtcAddress,
    functionName: "allowance",
    args: address && wbtcVaultAddress ? [address, wbtcVaultAddress] : undefined,
    query: {
      enabled: Boolean(address && wbtcAddress && wbtcVaultAddress),
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

  const wethCollateralEnabledQuery = useReadContract({
    abi: EVC_ABI,
    address: evcAddress,
    functionName: "isCollateralEnabled",
    args: address && wethVaultAddress ? [address, wethVaultAddress] : undefined,
    query: {
      enabled: Boolean(address && evcAddress && wethVaultAddress),
    },
  });

  const wbtcCollateralEnabledQuery = useReadContract({
    abi: EVC_ABI,
    address: evcAddress,
    functionName: "isCollateralEnabled",
    args: address && wbtcVaultAddress ? [address, wbtcVaultAddress] : undefined,
    query: {
      enabled: Boolean(address && evcAddress && wbtcVaultAddress),
    },
  });

  const wethCollateralEnabled =
    typeof wethCollateralEnabledQuery.data === "boolean"
      ? wethCollateralEnabledQuery.data
      : null;

  const wbtcCollateralEnabled =
    typeof wbtcCollateralEnabledQuery.data === "boolean"
      ? wbtcCollateralEnabledQuery.data
      : null;

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
    data: wbtcWalletBalance,
    refetch: refetchWbtcWalletBalance,
  } = useBalance({
    address,
    token: wbtcAddress,
    query: {
      enabled: Boolean(address && wbtcAddress),
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
    data: wbtcShareBalanceRaw,
    refetch: refetchWbtcShareBalance,
  } = useReadContract({
    abi: VAULT_ABI,
    address: wbtcVaultAddress,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(address && wbtcVaultAddress),
    },
  });

  const wbtcShareBalance =
    typeof wbtcShareBalanceRaw === "bigint" ? wbtcShareBalanceRaw : null;

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
    data: wbtcMaxWithdrawAssetsRaw,
    refetch: refetchWbtcMaxWithdrawAssets,
  } = useReadContract({
    abi: VAULT_ABI,
    address: wbtcVaultAddress,
    functionName: "convertToAssets",
    args: wbtcShareBalance !== null ? [wbtcShareBalance] : undefined,
    query: {
      enabled: Boolean(wbtcVaultAddress && wbtcShareBalance !== null),
    },
  });

  const wbtcMaxWithdrawValue =
    typeof wbtcMaxWithdrawAssetsRaw === "bigint"
      ? wbtcMaxWithdrawAssetsRaw
      : null;

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

  const {
    data: wbtcCollateralValueRaw,
    refetch: refetchWbtcCollateralValue,
  } = useReadContract({
    abi: EULER_ROUTER_ABI,
    address: oracleAddress,
    functionName: "getQuote",
    args:
      oracleAddress &&
        unitOfAccountAddress &&
        wbtcVaultAddress &&
        wbtcShareBalance !== null
        ? [wbtcShareBalance, wbtcVaultAddress, unitOfAccountAddress]
        : undefined,
    query: {
      enabled: Boolean(
        oracleAddress &&
        unitOfAccountAddress &&
        wbtcVaultAddress &&
        wbtcShareBalance !== null,
      ),
    },
  });

  const wbtcCollateralValue =
    typeof wbtcCollateralValueRaw === "bigint" ? wbtcCollateralValueRaw : null;

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

  const { data: liquidationLtvRaw, refetch: refetchLtvLiquidation } =
    useReadContract({
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
    data: wbtcLtvBorrowRaw,
    refetch: refetchWbtcLtvBorrow,
  } = useReadContract({
    abi: VAULT_ABI,
    address: dbusdVaultAddress,
    functionName: "LTVBorrow",
    args: wbtcVaultAddress ? [wbtcVaultAddress] : undefined,
    query: {
      enabled: Boolean(dbusdVaultAddress && wbtcVaultAddress),
    },
  });

  const wbtcMaxLtvBasisPoints = useMemo(() => {
    if (typeof wbtcLtvBorrowRaw === "number") {
      return wbtcLtvBorrowRaw;
    }

    if (typeof wbtcLtvBorrowRaw === "bigint") {
      return Number(wbtcLtvBorrowRaw);
    }

    return null;
  }, [wbtcLtvBorrowRaw]);

  const {
    data: wbtcLiquidationLtvRaw,
    refetch: refetchWbtcLtvLiquidation,
  } = useReadContract({
    abi: VAULT_ABI,
    address: dbusdVaultAddress,
    functionName: "LTVLiquidation",
    args: wbtcVaultAddress ? [wbtcVaultAddress] : undefined,
    query: {
      enabled: Boolean(dbusdVaultAddress && wbtcVaultAddress),
    },
  });

  const wbtcLiquidationLtvBasisPoints = useMemo(() => {
    if (typeof wbtcLiquidationLtvRaw === "number") {
      return wbtcLiquidationLtvRaw;
    }

    if (typeof wbtcLiquidationLtvRaw === "bigint") {
      return Number(wbtcLiquidationLtvRaw);
    }

    return null;
  }, [wbtcLiquidationLtvRaw]);

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
    const components = [
      collateralValue !== null && maxLtvBasisPoints !== null
        ? (collateralValue * BigInt(maxLtvBasisPoints)) / BigInt(10000)
        : null,
      wbtcCollateralValue !== null && wbtcMaxLtvBasisPoints !== null
        ? (wbtcCollateralValue * BigInt(wbtcMaxLtvBasisPoints)) /
        BigInt(10000)
        : null,
    ].filter((value): value is bigint => value !== null);

    if (components.length === 0) {
      return null;
    }

    return components.reduce((sum, value) => sum + value, BigInt(0));
  }, [
    collateralValue,
    maxLtvBasisPoints,
    wbtcCollateralValue,
    wbtcMaxLtvBasisPoints,
  ]);

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

  const availableBorrowCapacityUnit = useMemo(() => {
    if (maxBorrowValue === null || borrowedAmountInUnit === null) {
      return null;
    }

    if (maxBorrowValue <= borrowedAmountInUnit) {
      return BigInt(0);
    }

    return maxBorrowValue - borrowedAmountInUnit;
  }, [borrowedAmountInUnit, maxBorrowValue]);

  const convertAssetsToUnit = useCallback(
    (collateralValueInUnit: bigint | null, maxWithdrawAssets: bigint | null) =>
      (assets: bigint | null | undefined) => {
        if (
          assets === null ||
          assets === undefined ||
          collateralValueInUnit === null ||
          maxWithdrawAssets === null ||
          maxWithdrawAssets === BigInt(0)
        ) {
          return null;
        }

        return (assets * collateralValueInUnit) / maxWithdrawAssets;
      },
    [],
  );

  const calculateWithdrawHeadroom = useCallback(
    (
      collateralValueInUnit: bigint | null,
      maxWithdrawAssets: bigint | null,
      ltvBasisPoints: number | null,
    ) => {
      if (
        availableBorrowCapacityUnit === null ||
        collateralValueInUnit === null ||
        maxWithdrawAssets === null ||
        maxWithdrawAssets === BigInt(0) ||
        ltvBasisPoints === null ||
        ltvBasisPoints === 0
      ) {
        return null;
      }

      if (availableBorrowCapacityUnit === BigInt(0)) {
        return BigInt(0);
      }

      const maxWithdrawValueByLtv =
        (availableBorrowCapacityUnit * BigInt(10000)) /
        BigInt(ltvBasisPoints);

      const withdrawableValue =
        maxWithdrawValueByLtv < collateralValueInUnit
          ? maxWithdrawValueByLtv
          : collateralValueInUnit;

      return (withdrawableValue * maxWithdrawAssets) / collateralValueInUnit;
    },
    [availableBorrowCapacityUnit],
  );

  const collaterals: CollateralContractData[] = useMemo(() => {
    const items: CollateralContractData[] = [
      {
        key: "weth",
        symbol: TOKEN_METADATA.WETH.symbol,
        decimals: TOKEN_METADATA.WETH.decimals,
        tokenAddress: wethAddress,
        vaultAddress: wethVaultAddress,
        allowanceQuery: wethAllowanceQuery,
        walletBalance: wethWalletBalance,
        shareBalance,
        maxWithdrawAssets: maxWithdrawValue,
        collateralValue,
        maxLtvBasisPoints,
        liquidationLtvBasisPoints,
        withdrawHeadroomAssets: calculateWithdrawHeadroom(
          collateralValue,
          maxWithdrawValue,
          maxLtvBasisPoints,
        ),
        isCollateralEnabled: wethCollateralEnabled,
        convertAssetsToUnit: convertAssetsToUnit(
          collateralValue,
          maxWithdrawValue,
        ),
      },
    ];

    if (wbtcAddress || wbtcVaultAddress) {
      items.push({
        key: "wbtc",
        symbol: TOKEN_METADATA.WBTC.symbol,
        decimals: TOKEN_METADATA.WBTC.decimals,
        tokenAddress: wbtcAddress,
        vaultAddress: wbtcVaultAddress,
        allowanceQuery: wbtcAllowanceQuery,
        walletBalance: wbtcWalletBalance,
        shareBalance: wbtcShareBalance,
        maxWithdrawAssets: wbtcMaxWithdrawValue,
        collateralValue: wbtcCollateralValue,
        maxLtvBasisPoints: wbtcMaxLtvBasisPoints,
        liquidationLtvBasisPoints: wbtcLiquidationLtvBasisPoints,
        withdrawHeadroomAssets: calculateWithdrawHeadroom(
          wbtcCollateralValue,
          wbtcMaxWithdrawValue,
          wbtcMaxLtvBasisPoints,
        ),
        isCollateralEnabled: wbtcCollateralEnabled,
        convertAssetsToUnit: convertAssetsToUnit(
          wbtcCollateralValue,
          wbtcMaxWithdrawValue,
        ),
      });
    }

    return items;
  }, [
    calculateWithdrawHeadroom,
    collateralValue,
    convertAssetsToUnit,
    maxLtvBasisPoints,
    maxWithdrawValue,
    shareBalance,
    wbtcAddress,
    wbtcCollateralValue,
    wbtcLiquidationLtvBasisPoints,
    wbtcMaxLtvBasisPoints,
    wbtcMaxWithdrawValue,
    wbtcShareBalance,
    wbtcVaultAddress,
    wethAddress,
    wethAllowanceQuery,
    wethVaultAddress,
    wbtcAllowanceQuery,
    wethWalletBalance,
    wbtcWalletBalance,
    liquidationLtvBasisPoints,
    wethCollateralEnabled,
    wbtcCollateralEnabled,
  ]);

  const totalCollateralValue = useMemo(() => {
    const values = collaterals
      .map((item) => item.collateralValue)
      .filter((value): value is bigint => value !== null);

    if (values.length === 0) {
      return null;
    }

    return values.reduce((sum, value) => sum + value, BigInt(0));
  }, [collaterals]);

  const borrowAprPercent = useMemo(() => {
    if (interestRatePerSecond === null) {
      return null;
    }

    const ratePerSecond = Number(
      formatUnits(interestRatePerSecond, RAY_DECIMALS),
    );

    if (!Number.isFinite(ratePerSecond)) {
      return null;
    }

    const apr = ratePerSecond * Number(SECONDS_PER_YEAR) * 100;

    if (!Number.isFinite(apr)) {
      return null;
    }

    return apr;
  }, [interestRatePerSecond]);

  const convertDbusdToUnit = useCallback(
    (amount: bigint | null | undefined) => {
      if (amount === null || amount === undefined) {
        return null;
      }

      return convertDecimals(amount, DBUSD_DECIMALS, unitOfAccountDecimals);
    },
    [unitOfAccountDecimals],
  );

  const refetchAll = useCallback(async () => {
    await Promise.allSettled([
      wethAllowanceQuery.refetch?.(),
      wbtcAllowanceQuery.refetch?.(),
      dbusdAllowanceQuery.refetch?.(),
      wethCollateralEnabledQuery.refetch?.(),
      wbtcCollateralEnabledQuery.refetch?.(),
      refetchWethWalletBalance?.(),
      refetchWbtcWalletBalance?.(),
      refetchEthWalletBalance?.(),
      refetchDbusdWalletBalance?.(),
      refetchShareBalance?.(),
      refetchWbtcShareBalance?.(),
      refetchMaxWithdrawAssets?.(),
      refetchWbtcMaxWithdrawAssets?.(),
      refetchBorrowedAmount?.(),
      refetchAvailableLiquidity?.(),
      refetchCollateralValue?.(),
      refetchWbtcCollateralValue?.(),
      refetchLtvBorrow?.(),
      refetchWbtcLtvBorrow?.(),
      refetchLtvLiquidation?.(),
      refetchWbtcLtvLiquidation?.(),
      refetchInterestRate?.(),
    ]);
  }, [
    dbusdAllowanceQuery,
    refetchAvailableLiquidity,
    refetchBorrowedAmount,
    refetchCollateralValue,
    refetchDbusdWalletBalance,
    refetchEthWalletBalance,
    refetchInterestRate,
    refetchLtvBorrow,
    refetchLtvLiquidation,
    refetchMaxWithdrawAssets,
    refetchShareBalance,
    refetchWbtcCollateralValue,
    refetchWbtcLtvBorrow,
    refetchWbtcLtvLiquidation,
    refetchWbtcMaxWithdrawAssets,
    refetchWbtcShareBalance,
    refetchWbtcWalletBalance,
    refetchWethWalletBalance,
    wbtcAllowanceQuery,
    wethAllowanceQuery,
    wethCollateralEnabledQuery,
    wbtcCollateralEnabledQuery,
  ]);

  return {
    collaterals,
    wethAllowanceQuery,
    wbtcAllowanceQuery,
    dbusdAllowanceQuery,
    wethWalletBalance,
    wbtcWalletBalance,
    ethWalletBalance,
    dbusdWalletBalance,
    borrowedAmount,
    borrowedAmountInUnit,
    borrowHeadroom,
    borrowAprPercent,
    unitOfAccountDecimals,
    unitOfAccountSymbol,
    availableLiquidity,
    totalCollateralValue,
    maxBorrowValue,
    convertDbusdToUnit,
    refetchAll,
  };
}
