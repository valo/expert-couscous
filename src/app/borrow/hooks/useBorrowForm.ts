"use client";

import { useMemo, useState } from "react";
import { erc20Abi, parseUnits } from "viem";
import {
  useAccount,
  useBalance,
  useReadContract,
  useWriteContract,
} from "wagmi";
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
import { CONTRACT_ADDRESSES, TOKEN_METADATA, VAULT_ABI } from "@/lib/contracts";

type AmountFieldState = {
  label: string;
  amount: string;
  tokenSymbol: string;
  isMaxDisabled: boolean;
  infoLines: string[];
  errorMessage: string | null;
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

  const {
    data: wethAllowance,
    isFetching: isCheckingWethAllowance,
    refetch: refetchWethAllowance,
  } = useReadContract({
    abi: erc20Abi,
    address: wethAddress,
    functionName: "allowance",
    args: address && wethVaultAddress ? [address, wethVaultAddress] : undefined,
    query: {
      enabled: Boolean(address && wethAddress && wethVaultAddress),
    },
  });

  const {
    data: dbusdAllowance,
    isFetching: isCheckingDbusdAllowance,
    refetch: refetchDbusdAllowance,
  } = useReadContract({
    abi: erc20Abi,
    address: dbusdAddress,
    functionName: "allowance",
    args:
      address && dbusdVaultAddress ? [address, dbusdVaultAddress] : undefined,
    query: {
      enabled: Boolean(address && dbusdAddress && dbusdVaultAddress),
    },
  });

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
    data: dbusdDebtRaw,
    refetch: refetchDbusdDebt,
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
    typeof dbusdDebtRaw === "bigint" ? dbusdDebtRaw : null;

  const { writeContractAsync } = useWriteContract();

  const exceedsDepositBalance =
    mode === "depositCollateral" &&
    Boolean(
      depositParsedAmount &&
        wethWalletBalance &&
        depositParsedAmount > wethWalletBalance.value,
    );

  const exceedsWithdrawLimit =
    mode === "withdrawCollateral" &&
    Boolean(
      withdrawParsedAmount !== undefined &&
        maxWithdrawValue !== null &&
        withdrawParsedAmount > maxWithdrawValue,
    );

  const exceedsRepayBorrowed =
    mode === "repayDbusd" &&
    Boolean(
      repayParsedAmount !== undefined &&
        borrowedAmount !== null &&
        repayParsedAmount > borrowedAmount,
    );

  const insufficientRepayBalance =
    mode === "repayDbusd" &&
    Boolean(
      repayParsedAmount &&
        dbusdWalletBalance &&
        repayParsedAmount > dbusdWalletBalance.value,
    );

  const resetStatus = () => {
    setStatusMessage(null);
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

  const handleMax = () => {
    if (mode === "depositCollateral") {
      if (!wethWalletBalance) {
        return;
      }

      setDepositAmount(
        formatTokenAmount(wethWalletBalance.value, wethWalletBalance.decimals),
      );
      resetStatus();
      return;
    }

    if (mode === "withdrawCollateral") {
      if (maxWithdrawValue === null) {
        return;
      }

      setWithdrawAmount(formatTokenAmount(maxWithdrawValue, WETH_DECIMALS));
      resetStatus();
      return;
    }

    if (mode === "repayDbusd") {
      if (borrowedAmount === null) {
        return;
      }

      setRepayAmount(formatDbusdAmount(borrowedAmount));
      resetStatus();
    }
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
        if (needsDepositApproval) {
          setStatusMessage("Submitting approval…");
          const approvalHash = await writeContractAsync({
            abi: erc20Abi,
            address: wethAddress,
            functionName: "approve",
            args: [wethVaultAddress, activeParsedAmount],
          });

          await waitForTransactionReceipt(wagmiConfig, { hash: approvalHash });
          await refetchWethAllowance();
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
          await refetchDbusdAllowance();
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

      await Promise.allSettled([
        refetchWethAllowance?.(),
        refetchDbusdAllowance?.(),
        refetchWethWalletBalance?.(),
        refetchDbusdWalletBalance?.(),
        refetchShareBalance?.(),
        refetchMaxWithdrawAssets?.(),
        refetchDbusdDebt?.(),
      ]);
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
        isCheckingWethAllowance ||
        exceedsDepositBalance)) ||
    (mode === "withdrawCollateral" &&
      (!wethVaultAddress || exceedsWithdrawLimit)) ||
    (mode === "borrowDbusd" && !dbusdVaultAddress) ||
    (mode === "repayDbusd" &&
      (!dbusdAddress ||
        !dbusdVaultAddress ||
        isCheckingDbusdAllowance ||
        insufficientRepayBalance ||
        exceedsRepayBorrowed));

  const depositedWethDisplay =
    maxWithdrawValue !== null
      ? `${formatTokenAmount(maxWithdrawValue, WETH_DECIMALS)} ${WETH_SYMBOL}`
      : "—";

  const wethWalletDisplay = wethWalletBalance
    ? `${formatTokenAmount(
        wethWalletBalance.value,
        wethWalletBalance.decimals,
      )} ${WETH_SYMBOL}`
    : "—";

  const borrowedDisplay =
    borrowedAmount !== null
      ? `${formatDbusdAmount(borrowedAmount)} ${DBUSD_SYMBOL}`
      : "—";

  const dbusdWalletDisplay = dbusdWalletBalance
    ? `${formatTokenAmount(
        dbusdWalletBalance.value,
        dbusdWalletBalance.decimals,
      )} ${DBUSD_SYMBOL}`
    : "—";

  const amountInfoLines: string[] = [];

  if (mode === "depositCollateral" || mode === "withdrawCollateral") {
    amountInfoLines.push(`Wallet balance: ${wethWalletDisplay}`);
    amountInfoLines.push(`Deposited in vault: ${depositedWethDisplay}`);
  } else {
    amountInfoLines.push(`Borrowed from vault: ${borrowedDisplay}`);
    amountInfoLines.push(`Wallet balance: ${dbusdWalletDisplay}`);
  }

  let errorMessage: string | null = null;

  if (mode === "depositCollateral" && exceedsDepositBalance) {
    errorMessage = "Amount exceeds wallet balance.";
  } else if (mode === "withdrawCollateral" && exceedsWithdrawLimit) {
    errorMessage = "Amount exceeds your deposited balance.";
  } else if (mode === "repayDbusd" && insufficientRepayBalance) {
    errorMessage = "Amount exceeds wallet balance.";
  } else if (mode === "repayDbusd" && exceedsRepayBorrowed) {
    errorMessage = "Amount exceeds borrowed balance.";
  }

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
      mode === "depositCollateral" || mode === "withdrawCollateral"
        ? WETH_SYMBOL
        : DBUSD_SYMBOL,
    isMaxDisabled:
      (mode === "depositCollateral" && !wethWalletBalance) ||
      (mode === "withdrawCollateral" && maxWithdrawValue === null) ||
      mode === "borrowDbusd" ||
      (mode === "repayDbusd" && borrowedAmount === null),
    infoLines: amountInfoLines,
    errorMessage,
  };

  const summaryItems: SummaryItem[] = [
    {
      label: "Deposited WETH",
      value: depositedWethDisplay,
    },
    {
      label: "Borrowed dbUSD",
      value: borrowedDisplay,
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
    },
  };
}
