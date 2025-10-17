"use client";

import { useMemo, useState } from "react";
import { erc20Abi, formatUnits, parseUnits } from "viem";
import { useAccount, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";

import {
  DBUSD_DECIMALS,
  DBUSD_SYMBOL,
  WETH_DECIMALS,
  WETH_SYMBOL,
  type BorrowMode,
} from "../constants";
import { formatDbusdAmount, formatTokenAmount } from "@/app/earn/utils";
import { config as wagmiConfig } from "@/lib/config";
import {
  CONTRACT_ADDRESSES,
  TOKEN_METADATA,
  VAULT_ABI,
  WETH_ABI,
} from "@/lib/contracts";

import { useBorrowContractData } from "./useBorrowContractData";

type DepositAsset = "WETH" | "ETH";

type AmountFieldState = {
  label: string;
  amount: string;
  tokenSymbol: string;
  isMaxDisabled: boolean;
  infoLines: string[];
  errorMessage: string | null;
  assetOptions?: Array<{ value: DepositAsset; label: string }>;
  selectedAsset?: DepositAsset;
};

export type SummaryItem = {
  label: string;
  value: string;
};

export type BorrowFormHandlers = {
  onModeChange: (mode: BorrowMode) => void;
  onAmountChange: (value: string) => void;
  onMax: () => void;
  onSubmit: () => Promise<void>;
  onDepositAssetChange?: (asset: DepositAsset) => void;
};

export type BorrowFormState = {
  modeOptions: Array<{
    value: BorrowMode;
    label: string;
    isActive: boolean;
  }>;
  buttonLabel: string;
  statusMessage: string | null;
  isActionDisabled: boolean;
  amountField: AmountFieldState;
  summaryItems: SummaryItem[];
  handlers: BorrowFormHandlers;
};

export function useBorrowForm(): BorrowFormState {
  const [mode, setMode] = useState<BorrowMode>("depositCollateral");
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [borrowAmount, setBorrowAmount] = useState("");
  const [repayAmount, setRepayAmount] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [depositAsset, setDepositAsset] = useState<DepositAsset>("WETH");

  const { address, isConnected } = useAccount();

  const wethAddress = TOKEN_METADATA.WETH.address as `0x${string}` | undefined;
  const dbusdAddress = TOKEN_METADATA.DBUSD.address as
    | `0x${string}`
    | undefined;
  const wethVaultAddress = CONTRACT_ADDRESSES.wethVault as
    | `0x${string}`
    | undefined;
  const dbusdVaultAddress = CONTRACT_ADDRESSES.dbusdVault as
    | `0x${string}`
    | undefined;

  const activeAmount = useMemo(() => {
    switch (mode) {
      case "depositCollateral":
        return depositAmount;
      case "withdrawCollateral":
        return withdrawAmount;
      case "borrowDbusd":
        return borrowAmount;
      case "repayDbusd":
        return repayAmount;
    }
  }, [borrowAmount, depositAmount, mode, repayAmount, withdrawAmount]);

  const depositParsedAmount = useMemo(() => {
    if (!depositAmount || Number(depositAmount) <= 0) {
      return undefined;
    }

    try {
      return parseUnits(depositAmount, WETH_DECIMALS);
    } catch {
      return undefined;
    }
  }, [depositAmount]);

  const withdrawParsedAmount = useMemo(() => {
    if (!withdrawAmount || Number(withdrawAmount) <= 0) {
      return undefined;
    }

    try {
      return parseUnits(withdrawAmount, WETH_DECIMALS);
    } catch {
      return undefined;
    }
  }, [withdrawAmount]);

  const borrowParsedAmount = useMemo(() => {
    if (!borrowAmount || Number(borrowAmount) <= 0) {
      return undefined;
    }

    try {
      return parseUnits(borrowAmount, DBUSD_DECIMALS);
    } catch {
      return undefined;
    }
  }, [borrowAmount]);

  const repayParsedAmount = useMemo(() => {
    if (!repayAmount || Number(repayAmount) <= 0) {
      return undefined;
    }

    try {
      return parseUnits(repayAmount, DBUSD_DECIMALS);
    } catch {
      return undefined;
    }
  }, [repayAmount]);

  const activeParsedAmount = useMemo(() => {
    switch (mode) {
      case "depositCollateral":
        return depositParsedAmount;
      case "withdrawCollateral":
        return withdrawParsedAmount;
      case "borrowDbusd":
        return borrowParsedAmount;
      case "repayDbusd":
        return repayParsedAmount;
    }
  }, [
    borrowParsedAmount,
    depositParsedAmount,
    mode,
    repayParsedAmount,
    withdrawParsedAmount,
  ]);

  const borrowData = useBorrowContractData({
    address,
    wethAddress,
    dbusdAddress,
    wethVaultAddress,
    dbusdVaultAddress,
  });

  const depositAssetOptions: Array<{ value: DepositAsset; label: string }> = [
    { value: "WETH", label: "WETH" },
    { value: "ETH", label: "ETH" },
  ];

  const {
    collateralValue,
    unitOfAccountDecimals,
    borrowedAmountInUnit,
    convertAssetsToUnit,
    convertDbusdToUnit,
    withdrawHeadroomAssets,
  } = borrowData;

  const { writeContractAsync } = useWriteContract();

  const wethAllowance = borrowData.wethAllowanceQuery.data;
  const dbusdAllowance = borrowData.dbusdAllowanceQuery.data;

  const needsDepositApproval = useMemo(() => {
    if (!depositParsedAmount) {
      return false;
    }

    if (!wethAllowance) {
      return true;
    }

    return wethAllowance < depositParsedAmount;
  }, [depositParsedAmount, wethAllowance]);

  const needsRepayApproval = useMemo(() => {
    if (!repayParsedAmount) {
      return false;
    }

    if (!dbusdAllowance) {
      return true;
    }

    return dbusdAllowance < repayParsedAmount;
  }, [dbusdAllowance, repayParsedAmount]);

  const depositBalance =
    depositAsset === "ETH"
      ? borrowData.ethWalletBalance
      : borrowData.wethWalletBalance;

  const exceedsDepositBalance =
    mode === "depositCollateral" &&
    Boolean(
      depositParsedAmount &&
        depositBalance &&
        depositParsedAmount > depositBalance.value,
    );

  const withdrawLimitAssets = useMemo(() => {
    const ltvLimit = withdrawHeadroomAssets;
    const vaultLimit = borrowData.maxWithdrawValue;

    if (ltvLimit === null && vaultLimit === null) {
      return null;
    }

    if (ltvLimit === null) {
      return vaultLimit;
    }

    if (vaultLimit === null) {
      return ltvLimit;
    }

    return ltvLimit < vaultLimit ? ltvLimit : vaultLimit;
  }, [borrowData.maxWithdrawValue, withdrawHeadroomAssets]);

  const exceedsWithdrawLimit =
    mode === "withdrawCollateral" &&
    Boolean(
      withdrawParsedAmount !== undefined &&
        withdrawLimitAssets !== null &&
        withdrawParsedAmount > withdrawLimitAssets,
    );

  const depositValueUnit = useMemo(() => {
    if (!depositParsedAmount) {
      return null;
    }

    return convertAssetsToUnit?.(depositParsedAmount) ?? null;
  }, [convertAssetsToUnit, depositParsedAmount]);

  const withdrawValueUnit = useMemo(() => {
    if (!withdrawParsedAmount) {
      return null;
    }

    return convertAssetsToUnit?.(withdrawParsedAmount) ?? null;
  }, [convertAssetsToUnit, withdrawParsedAmount]);

  const borrowValueUnit = useMemo(() => {
    if (!borrowParsedAmount) {
      return null;
    }

    return convertDbusdToUnit?.(borrowParsedAmount) ?? null;
  }, [borrowParsedAmount, convertDbusdToUnit]);

  const repayValueUnit = useMemo(() => {
    if (!repayParsedAmount) {
      return null;
    }

    return convertDbusdToUnit?.(repayParsedAmount) ?? null;
  }, [convertDbusdToUnit, repayParsedAmount]);

  const exceedsBorrowLimit =
    mode === "borrowDbusd" &&
    Boolean(
      borrowParsedAmount !== undefined &&
        borrowData.borrowHeadroom !== null &&
        borrowParsedAmount > borrowData.borrowHeadroom,
    );

  const exceedsRepayBorrowed =
    mode === "repayDbusd" &&
    Boolean(
      repayParsedAmount !== undefined &&
        borrowData.borrowedAmount !== null &&
        repayParsedAmount > borrowData.borrowedAmount,
    );

  const insufficientRepayBalance =
    mode === "repayDbusd" &&
    Boolean(
      repayParsedAmount &&
        borrowData.dbusdWalletBalance &&
        repayParsedAmount > borrowData.dbusdWalletBalance.value,
    );

  const resetStatus = () => {
    setStatusMessage(null);
  };

  const handleDepositAssetChange = (asset: DepositAsset) => {
    if (depositAsset === asset) {
      return;
    }

    setDepositAsset(asset);
    resetStatus();
  };

  const handleModeChange = (nextMode: BorrowMode) => {
    if (nextMode === mode) {
      return;
    }

    setMode(nextMode);
    resetStatus();
  };

  const handleAmountChange = (value: string) => {
    switch (mode) {
      case "depositCollateral":
        setDepositAmount(value);
        break;
      case "withdrawCollateral":
        setWithdrawAmount(value);
        break;
      case "borrowDbusd":
        setBorrowAmount(value);
        break;
      case "repayDbusd":
        setRepayAmount(value);
        break;
    }

    resetStatus();
  };

  const handleSubmit = async () => {
    resetStatus();

    if (!isConnected || !address) {
      setStatusMessage("Connect your wallet first.");
      return;
    }

    if (!activeParsedAmount) {
      setStatusMessage("Enter an amount.");
      return;
    }

    if (
      (mode === "depositCollateral" || mode === "withdrawCollateral") &&
      !wethVaultAddress
    ) {
      setStatusMessage("WETH vault address is not configured.");
      return;
    }

    if (mode === "depositCollateral" && !wethAddress) {
      setStatusMessage("WETH address is not configured.");
      return;
    }

    if (
      (mode === "borrowDbusd" || mode === "repayDbusd") &&
      !dbusdVaultAddress
    ) {
      setStatusMessage("dbUSD vault address is not configured.");
      return;
    }

    if (mode === "repayDbusd" && !dbusdAddress) {
      setStatusMessage("dbUSD token address is not configured.");
      return;
    }

    if (mode === "depositCollateral" && exceedsDepositBalance) {
      setStatusMessage("Amount exceeds wallet balance.");
      return;
    }

    if (mode === "withdrawCollateral" && exceedsWithdrawLimit) {
      setStatusMessage("Amount exceeds your deposited balance.");
      return;
    }

    if (mode === "borrowDbusd") {
      if (borrowData.borrowHeadroom === null) {
        setStatusMessage("Unable to determine borrow limit.");
        return;
      }

      if (borrowData.borrowHeadroom === BigInt(0)) {
        setStatusMessage("No borrowing capacity available.");
        return;
      }

      if (exceedsBorrowLimit) {
        setStatusMessage("Amount exceeds your borrow limit.");
        return;
      }
    }

    if (mode === "repayDbusd" && exceedsRepayBorrowed) {
      setStatusMessage("Amount exceeds borrowed balance.");
      return;
    }

    if (mode === "repayDbusd" && insufficientRepayBalance) {
      setStatusMessage("Amount exceeds wallet balance.");
      return;
    }

    setIsProcessing(true);

    try {
      if (mode === "depositCollateral" && wethAddress && wethVaultAddress) {
        if (depositAsset === "ETH") {
          setStatusMessage("Wrapping ETH…");
          const wrapHash = await writeContractAsync({
            abi: WETH_ABI,
            address: wethAddress,
            functionName: "deposit",
            args: [],
            value: activeParsedAmount,
          });

          await waitForTransactionReceipt(wagmiConfig, { hash: wrapHash });
        }

        if (needsDepositApproval) {
          setStatusMessage("Submitting approval…");
          const approvalHash = await writeContractAsync({
            abi: erc20Abi,
            address: wethAddress,
            functionName: "approve",
            args: [wethVaultAddress, activeParsedAmount],
          });

          await waitForTransactionReceipt(wagmiConfig, { hash: approvalHash });
        }

        setStatusMessage("Depositing…");
        const depositHash = await writeContractAsync({
          abi: VAULT_ABI,
          address: wethVaultAddress,
          functionName: "deposit",
          args: [activeParsedAmount, address],
        });

        await waitForTransactionReceipt(wagmiConfig, { hash: depositHash });
        setStatusMessage("Deposit completed successfully.");
        setDepositAmount("");
      } else if (mode === "withdrawCollateral" && wethVaultAddress) {
        setStatusMessage("Withdrawing…");
        const withdrawHash = await writeContractAsync({
          abi: VAULT_ABI,
          address: wethVaultAddress,
          functionName: "withdraw",
          args: [activeParsedAmount, address, address],
        });

        await waitForTransactionReceipt(wagmiConfig, { hash: withdrawHash });
        setStatusMessage("Withdrawal completed successfully.");
        setWithdrawAmount("");
      } else if (mode === "borrowDbusd" && dbusdVaultAddress) {
        setStatusMessage("Borrowing…");
        const borrowHash = await writeContractAsync({
          abi: VAULT_ABI,
          address: dbusdVaultAddress,
          functionName: "borrow",
          args: [activeParsedAmount, address],
        });

        await waitForTransactionReceipt(wagmiConfig, { hash: borrowHash });
        setStatusMessage("Borrow completed successfully.");
        setBorrowAmount("");
      } else if (mode === "repayDbusd" && dbusdVaultAddress && dbusdAddress) {
        if (needsRepayApproval) {
          setStatusMessage("Submitting approval…");
          const approvalHash = await writeContractAsync({
            abi: erc20Abi,
            address: dbusdAddress,
            functionName: "approve",
            args: [dbusdVaultAddress, activeParsedAmount],
          });

          await waitForTransactionReceipt(wagmiConfig, { hash: approvalHash });
        }

        setStatusMessage("Repaying…");
        const repayHash = await writeContractAsync({
          abi: VAULT_ABI,
          address: dbusdVaultAddress,
          functionName: "repay",
          args: [activeParsedAmount, address],
        });

        await waitForTransactionReceipt(wagmiConfig, { hash: repayHash });
        setStatusMessage("Repayment completed successfully.");
        setRepayAmount("");
      }

      await borrowData.refetchAll();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to complete the transaction.";
      setStatusMessage(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMax = () => {
    if (mode === "depositCollateral") {
      const balance =
        depositAsset === "ETH"
          ? borrowData.ethWalletBalance
          : borrowData.wethWalletBalance;

      if (!balance) {
        return;
      }

      setDepositAmount(
        formatTokenAmount(balance.value, balance.decimals),
      );
      resetStatus();
      return;
    }

    if (mode === "withdrawCollateral") {
      if (withdrawLimitAssets === null || withdrawLimitAssets === BigInt(0)) {
        return;
      }

      setWithdrawAmount(
        formatTokenAmount(withdrawLimitAssets, WETH_DECIMALS),
      );
      resetStatus();
      return;
    }

    if (mode === "borrowDbusd") {
      if (borrowData.borrowHeadroom === null || borrowData.borrowHeadroom === BigInt(0)) {
        return;
      }

      setBorrowAmount(formatDbusdAmount(borrowData.borrowHeadroom));
      resetStatus();
      return;
    }

    if (mode === "repayDbusd") {
      if (borrowData.borrowedAmount === null) {
        return;
      }

      setRepayAmount(formatDbusdAmount(borrowData.borrowedAmount));
      resetStatus();
    }
  };

  const buttonLabel = useMemo(() => {
    if (!isConnected) {
      return "Connect wallet";
    }

    if (!activeAmount || !activeParsedAmount) {
      switch (mode) {
        case "depositCollateral":
          return "Enter deposit";
        case "withdrawCollateral":
          return "Enter withdrawal";
        case "borrowDbusd":
          return "Enter borrow";
        case "repayDbusd":
          return "Enter repayment";
      }
    }

    if (isProcessing) {
      switch (mode) {
        case "depositCollateral":
          return needsDepositApproval ? "Approving…" : "Depositing…";
        case "withdrawCollateral":
          return "Withdrawing…";
        case "borrowDbusd":
          return "Borrowing…";
        case "repayDbusd":
          return needsRepayApproval ? "Approving…" : "Repaying…";
      }
    }

    if (mode === "depositCollateral" && needsDepositApproval) {
      return "Approve & deposit";
    }

    if (mode === "repayDbusd" && needsRepayApproval) {
      return "Approve & repay";
    }

    switch (mode) {
      case "depositCollateral":
        return "Deposit";
      case "withdrawCollateral":
        return "Withdraw";
      case "borrowDbusd":
        return "Borrow";
      case "repayDbusd":
        return "Repay";
    }
  }, [
    activeAmount,
    activeParsedAmount,
    isConnected,
    isProcessing,
    mode,
    needsDepositApproval,
    needsRepayApproval,
  ]);

  const isActionDisabled =
    !isConnected ||
    !activeParsedAmount ||
    isProcessing ||
    (mode === "depositCollateral" &&
      (!wethAddress ||
        !wethVaultAddress ||
        borrowData.wethAllowanceQuery.isFetching ||
        (depositAsset === "ETH"
          ? !borrowData.ethWalletBalance
          : !borrowData.wethWalletBalance) ||
        exceedsDepositBalance)) ||
    (mode === "withdrawCollateral" &&
      (!wethVaultAddress ||
        withdrawLimitAssets === null ||
        withdrawLimitAssets === BigInt(0) ||
        exceedsWithdrawLimit)) ||
    (mode === "borrowDbusd" &&
      (!dbusdVaultAddress ||
        borrowData.borrowHeadroom === null ||
        borrowData.borrowHeadroom === BigInt(0) ||
        exceedsBorrowLimit)) ||
    (mode === "repayDbusd" &&
      (!dbusdAddress ||
        !dbusdVaultAddress ||
        borrowData.dbusdAllowanceQuery.isFetching ||
        insufficientRepayBalance ||
        exceedsRepayBorrowed));

  const collateralValueDisplay =
    collateralValue !== null
      ? `${formatTokenAmount(
          collateralValue,
          unitOfAccountDecimals,
          2,
        )} ${borrowData.unitOfAccountSymbol}`
      : "—";

  const maxBorrowDisplay =
    borrowData.maxBorrowValue !== null
      ? `${formatTokenAmount(
          borrowData.maxBorrowValue,
          borrowData.unitOfAccountDecimals,
          2,
        )} ${borrowData.unitOfAccountSymbol}`
      : "—";

  const currentLtvPercent = useMemo(() => {
    if (
      collateralValue === null ||
      collateralValue === BigInt(0) ||
      borrowedAmountInUnit === null
    ) {
      return null;
    }

    const debt = Number(formatUnits(borrowedAmountInUnit, unitOfAccountDecimals));
    const collateral = Number(formatUnits(collateralValue, unitOfAccountDecimals));

    if (!Number.isFinite(debt) || !Number.isFinite(collateral) || collateral === 0) {
      return null;
    }

    return (debt / collateral) * 100;
  }, [borrowedAmountInUnit, collateralValue, unitOfAccountDecimals]);

  const projectedLtvPercent = useMemo(() => {
    if (
      collateralValue === null ||
      collateralValue === BigInt(0) ||
      borrowedAmountInUnit === null
    ) {
      return null;
    }

    let projectedCollateral = collateralValue;
    let projectedDebt = borrowedAmountInUnit;

    switch (mode) {
      case "depositCollateral": {
        if (depositValueUnit === null) {
          return null;
        }

        projectedCollateral += depositValueUnit;
        break;
      }
      case "withdrawCollateral": {
        if (withdrawValueUnit === null || withdrawValueUnit > projectedCollateral) {
          return null;
        }

        projectedCollateral -= withdrawValueUnit;
        break;
      }
      case "borrowDbusd": {
        if (borrowValueUnit === null) {
          return null;
        }

        projectedDebt += borrowValueUnit;
        break;
      }
      case "repayDbusd": {
        if (repayValueUnit === null) {
          return null;
        }

        projectedDebt = projectedDebt > repayValueUnit ? projectedDebt - repayValueUnit : BigInt(0);
        break;
      }
      default:
        break;
    }

    if (projectedCollateral === BigInt(0)) {
      return null;
    }

    const debt = Number(formatUnits(projectedDebt, unitOfAccountDecimals));
    const collateral = Number(formatUnits(projectedCollateral, unitOfAccountDecimals));

    if (!Number.isFinite(debt) || !Number.isFinite(collateral) || collateral === 0) {
      return null;
    }

    return (debt / collateral) * 100;
  }, [
    borrowValueUnit,
    borrowedAmountInUnit,
    collateralValue,
    depositValueUnit,
    mode,
    repayValueUnit,
    unitOfAccountDecimals,
    withdrawValueUnit,
  ]);

  const formatPercent = (value: number | null) =>
    value === null ? "—" : `${value.toFixed(2)}%`;

  const borrowedDisplay =
    borrowData.borrowedAmount !== null
      ? `${formatDbusdAmount(borrowData.borrowedAmount)} ${DBUSD_SYMBOL}`
      : "—";

  const withdrawableWethDisplay =
    withdrawLimitAssets !== null
      ? `${formatTokenAmount(withdrawLimitAssets, WETH_DECIMALS)} ${WETH_SYMBOL}`
      : "—";

  const wethWalletDisplay = borrowData.wethWalletBalance
    ? `${formatTokenAmount(
        borrowData.wethWalletBalance.value,
        borrowData.wethWalletBalance.decimals,
      )} ${WETH_SYMBOL}`
    : "—";

  const ethWalletDisplay = borrowData.ethWalletBalance
    ? `${formatTokenAmount(
        borrowData.ethWalletBalance.value,
        borrowData.ethWalletBalance.decimals ?? 18,
      )} ETH`
    : "—";

  const dbusdWalletDisplay = borrowData.dbusdWalletBalance
    ? `${formatTokenAmount(
        borrowData.dbusdWalletBalance.value,
        borrowData.dbusdWalletBalance.decimals,
      )} ${DBUSD_SYMBOL}`
    : "—";

  const maxBorrowPercentage =
    borrowData.maxLtvBasisPoints !== null
      ? (borrowData.maxLtvBasisPoints / 100).toFixed(2)
      : "—";

  const borrowInterestDisplay =
    borrowData.borrowAprPercent !== null
      ? `${borrowData.borrowAprPercent.toFixed(2)}% APR`
      : "—";

  const amountField: AmountFieldState = {
    label:
      mode === "depositCollateral"
        ? "Deposit amount"
        : mode === "withdrawCollateral"
        ? "Withdraw amount"
        : mode === "borrowDbusd"
        ? "Borrow amount"
        : "Repay amount",
    amount: activeAmount ?? "",
    tokenSymbol:
      mode === "depositCollateral"
        ? depositAsset
        : mode === "withdrawCollateral"
        ? WETH_SYMBOL
        : DBUSD_SYMBOL,
    isMaxDisabled:
      (mode === "depositCollateral" &&
        (depositAsset === "ETH"
          ? !borrowData.ethWalletBalance
          : !borrowData.wethWalletBalance)) ||
      (mode === "withdrawCollateral" && borrowData.maxWithdrawValue === null) ||
      (mode === "withdrawCollateral" &&
        (withdrawLimitAssets === null || withdrawLimitAssets === BigInt(0))) ||
      (mode === "borrowDbusd" &&
        (borrowData.borrowHeadroom === null ||
          borrowData.borrowHeadroom === BigInt(0))) ||
      (mode === "repayDbusd" && borrowData.borrowedAmount === null),
    infoLines: [],
    errorMessage:
      mode === "depositCollateral" && exceedsDepositBalance
        ? "Amount exceeds wallet balance."
        : mode === "withdrawCollateral" && exceedsWithdrawLimit
        ? "Amount exceeds your deposited balance."
        : mode === "borrowDbusd" && exceedsBorrowLimit
        ? "Amount exceeds your borrow limit."
        : mode === "repayDbusd" && insufficientRepayBalance
        ? "Amount exceeds wallet balance."
        : mode === "repayDbusd" && exceedsRepayBorrowed
        ? "Amount exceeds borrowed balance."
        : null,
    assetOptions:
      mode === "depositCollateral" ? depositAssetOptions : undefined,
    selectedAsset:
      mode === "depositCollateral" ? depositAsset : undefined,
  };

  const summaryItems: SummaryItem[] = [
    {
      label: "Deposited WETH",
      value:
        borrowData.maxWithdrawValue !== null
          ? `${formatTokenAmount(
              borrowData.maxWithdrawValue,
              WETH_DECIMALS,
            )} ${WETH_SYMBOL}`
          : "—",
    },
    {
      label: `Collateral value (${borrowData.unitOfAccountSymbol})`,
      value: collateralValueDisplay,
    },
    {
      label: "Borrow interest rate",
      value: borrowInterestDisplay,
    },
    {
      label: "Current LTV",
      value: formatPercent(currentLtvPercent),
    },
    {
      label: "Projected LTV",
      value: formatPercent(projectedLtvPercent),
    },
    {
      label: "Withdrawable WETH",
      value: withdrawableWethDisplay,
    },
    {
      label: `Max borrow @ ${maxBorrowPercentage}%`,
      value: maxBorrowDisplay,
    },
    {
      label: "Borrowed dbUSD",
      value: borrowedDisplay,
    },
    {
      label: "Vault liquidity",
      value:
        borrowData.availableLiquidity !== null
          ? `${formatDbusdAmount(borrowData.availableLiquidity)} ${DBUSD_SYMBOL}`
          : "—",
    },
    {
      label: "ETH wallet",
      value: ethWalletDisplay,
    },
    {
      label: "WETH wallet",
      value: wethWalletDisplay,
    },
    {
      label: "dbUSD wallet",
      value: dbusdWalletDisplay,
    },
  ];

  const modeOptions = [
    {
      value: "depositCollateral" as const,
      label: "Deposit collateral",
      isActive: mode === "depositCollateral",
    },
    {
      value: "withdrawCollateral" as const,
      label: "Withdraw collateral",
      isActive: mode === "withdrawCollateral",
    },
    {
      value: "borrowDbusd" as const,
      label: "Borrow dbUSD",
      isActive: mode === "borrowDbusd",
    },
    {
      value: "repayDbusd" as const,
      label: "Repay dbUSD",
      isActive: mode === "repayDbusd",
    },
  ];

  return {
    modeOptions,
    buttonLabel,
    statusMessage,
    isActionDisabled,
    amountField,
    summaryItems,
    handlers: {
      onModeChange: handleModeChange,
      onAmountChange: handleAmountChange,
      onMax: handleMax,
      onSubmit: handleSubmit,
      onDepositAssetChange: handleDepositAssetChange,
    },
  };
}
