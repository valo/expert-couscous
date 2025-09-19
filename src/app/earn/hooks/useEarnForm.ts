"use client";

import { useMemo, useState } from "react";
import { erc20Abi, parseUnits } from "viem";
import { useAccount, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { config as wagmiConfig } from "@/lib/config";
import { CONTRACT_ADDRESSES, SRM_ABI, TOKEN_METADATA } from "@/lib/contracts";

import { DBUSD_DECIMALS, DBUSD_SYMBOL, Mode } from "../constants";
import { useApyMetrics } from "./useApyMetrics";
import { useEarnBalances } from "./useEarnBalances";
import { useEarnPreviews } from "./useEarnPreviews";
import { useTokenApproval } from "./useTokenApproval";
import { formatDbusdAmount, formatTokenAmount } from "../utils";

type AmountFieldState = {
  label: string;
  amount: string;
  tokenSymbol: string;
  isMaxDisabled: boolean;
  infoLines: string[];
  errorMessage: string | null;
};

export type ShareCard = {
  label: string;
  value: string;
};

export type EarnFormHandlers = {
  onModeChange: (mode: Mode) => void;
  onAmountChange: (value: string) => void;
  onMax: () => void;
  onSubmit: () => Promise<void>;
};

export type EarnFormState = {
  modeOptions: Array<{
    value: Mode;
    label: string;
    isActive: boolean;
  }>;
  apyDisplay: string;
  buttonLabel: string;
  statusMessage: string | null;
  isActionDisabled: boolean;
  amountField: AmountFieldState;
  shareCards: ShareCard[];
  handlers: EarnFormHandlers;
};

export function useEarnForm(): EarnFormState {
  const [mode, setMode] = useState<Mode>("deposit");
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { address, isConnected } = useAccount();

  const srmAddress = CONTRACT_ADDRESSES.srm as `0x${string}` | undefined;
  const dbusdAddress = TOKEN_METADATA.DBUSD.address as `0x${string}` | undefined;

  const activeAmount = mode === "deposit" ? depositAmount : withdrawAmount;
  const setActiveAmount = mode === "deposit" ? setDepositAmount : setWithdrawAmount;

  const depositParsedAmount = useMemo(() => {
    if (!depositAmount || Number(depositAmount) <= 0) {
      return undefined;
    }

    try {
      return parseUnits(depositAmount, DBUSD_DECIMALS);
    } catch {
      return undefined;
    }
  }, [depositAmount]);

  const withdrawParsedAmount = useMemo(() => {
    if (!withdrawAmount || Number(withdrawAmount) <= 0) {
      return undefined;
    }

    try {
      return parseUnits(withdrawAmount, DBUSD_DECIMALS);
    } catch {
      return undefined;
    }
  }, [withdrawAmount]);

  const { allowanceQuery, needsApproval } = useTokenApproval(
    address,
    dbusdAddress,
    srmAddress,
    depositParsedAmount,
  );

  const { dbusdBalance, srmShareBalance, refetchDbusdBalance, refetchSrmShareBalance, refetchMaxWithdraw, maxWithdraw } =
    useEarnBalances(address);

  const { previewDepositShares, previewWithdrawShares } = useEarnPreviews(
    depositParsedAmount,
    withdrawParsedAmount,
  );

  const {
    apyDisplay,
    refetchDripRate,
    refetchTotalAssets,
  } = useApyMetrics();

  const isCheckingAllowance = allowanceQuery.isFetching;
  const refetchAllowance = allowanceQuery.refetch;

  const maxWithdrawValue = maxWithdraw;
  const maxWithdrawForComparison = maxWithdrawValue ?? BigInt(0);

  const { writeContractAsync } = useWriteContract();

  const exceedsDepositBalance =
    mode === "deposit" &&
    Boolean(
      depositParsedAmount &&
      dbusdBalance &&
      depositParsedAmount > dbusdBalance.value,
    );

  const exceedsWithdrawLimit =
    mode === "withdraw" &&
    Boolean(
      withdrawParsedAmount !== undefined &&
      withdrawParsedAmount > maxWithdrawForComparison,
    );

  const activeParsedAmount =
    mode === "deposit" ? depositParsedAmount : withdrawParsedAmount;

  const resetStatus = () => {
    setStatusMessage(null);
  };

  const handleModeChange = (nextMode: Mode) => {
    if (mode === nextMode) {
      return;
    }

    setMode(nextMode);
    resetStatus();
  };

  const handleAmountChange = (value: string) => {
    setActiveAmount(value);
    resetStatus();
  };

  const handleMax = () => {
    if (mode === "deposit") {
      if (!dbusdBalance) {
        return;
      }

      setDepositAmount(
        formatTokenAmount(dbusdBalance.value, dbusdBalance.decimals),
      );
      resetStatus();
      return;
    }

    if (maxWithdrawValue === null) {
      return;
    }

    setWithdrawAmount(formatDbusdAmount(maxWithdrawValue));
    resetStatus();
  };

  const handleSubmit = async () => {
    resetStatus();

    if (!isConnected || !address) {
      setStatusMessage("Connect your wallet first.");
      return;
    }

    if (!srmAddress) {
      setStatusMessage("Savings Rate Module address is not configured.");
      return;
    }

    if (!activeParsedAmount) {
      setStatusMessage("Enter an amount.");
      return;
    }

    if (mode === "deposit" && !dbusdAddress) {
      setStatusMessage("dbUSD token address is not configured.");
      return;
    }

    if (mode === "deposit" && exceedsDepositBalance) {
      setStatusMessage("Amount exceeds wallet balance.");
      return;
    }

    if (mode === "withdraw" && exceedsWithdrawLimit) {
      setStatusMessage("Amount exceeds available to withdraw.");
      return;
    }

    setIsProcessing(true);

    try {
      if (mode === "deposit" && dbusdAddress) {
        if (needsApproval) {
          setStatusMessage("Submitting approval…");
          const approvalHash = await writeContractAsync({
            abi: erc20Abi,
            address: dbusdAddress,
            functionName: "approve",
            args: [srmAddress, activeParsedAmount],
          });

          await waitForTransactionReceipt(wagmiConfig, { hash: approvalHash });
          await refetchAllowance();
        }

        setStatusMessage("Depositing…");
        const depositHash = await writeContractAsync({
          abi: SRM_ABI,
          address: srmAddress,
          functionName: "deposit",
          args: [activeParsedAmount, address],
        });

        await waitForTransactionReceipt(wagmiConfig, { hash: depositHash });

        setStatusMessage("Deposit completed successfully.");
        setDepositAmount("");
      } else if (mode === "withdraw") {
        setStatusMessage("Withdrawing…");
        const withdrawHash = await writeContractAsync({
          abi: SRM_ABI,
          address: srmAddress,
          functionName: "withdraw",
          args: [activeParsedAmount, address, address],
        });

        await waitForTransactionReceipt(wagmiConfig, { hash: withdrawHash });

        setStatusMessage("Withdrawal completed successfully.");
        setWithdrawAmount("");
      }

      await Promise.allSettled([
        refetchAllowance?.(),
        refetchDbusdBalance?.(),
        refetchSrmShareBalance?.(),
        refetchMaxWithdraw?.(),
        refetchDripRate?.(),
        refetchTotalAssets?.(),
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
      return mode === "deposit" ? "Enter deposit" : "Enter withdrawal";
    }

    if (isProcessing) {
      if (mode === "deposit") {
        return needsApproval ? "Approving…" : "Depositing…";
      }

      return "Withdrawing…";
    }

    if (mode === "deposit" && needsApproval) {
      return "Approve & deposit";
    }

    return mode === "deposit" ? "Deposit" : "Withdraw";
  }, [
    activeAmount,
    activeParsedAmount,
    isConnected,
    isProcessing,
    mode,
    needsApproval,
  ]);

  const isActionDisabled =
    !isConnected ||
    !srmAddress ||
    !activeParsedAmount ||
    isProcessing ||
    (mode === "deposit" && (!dbusdAddress || isCheckingAllowance)) ||
    (mode === "deposit" && exceedsDepositBalance) ||
    (mode === "withdraw" && exceedsWithdrawLimit);

  const modeOptions = (
    ["deposit", "withdraw"] as const
  ).map((value) => ({
    value,
    label: value === "deposit" ? "Deposit" : "Withdraw",
    isActive: mode === value,
  }));

  const amountInfoLines: string[] = [];

  if (mode === "deposit" && dbusdBalance) {
    amountInfoLines.push(
      `Wallet balance: ${formatTokenAmount(
        dbusdBalance.value,
        dbusdBalance.decimals,
      )} ${DBUSD_SYMBOL}`,
    );
  }

  if (mode === "withdraw" && maxWithdrawValue !== null) {
    amountInfoLines.push(
      `Available to withdraw: ${formatDbusdAmount(maxWithdrawValue)} ${DBUSD_SYMBOL}`,
    );
  }

  const amountField: AmountFieldState = {
    label: mode === "deposit" ? "Deposit amount" : "Withdraw amount",
    amount: activeAmount,
    tokenSymbol: DBUSD_SYMBOL,
    isMaxDisabled:
      (mode === "deposit" && !dbusdBalance) ||
      (mode === "withdraw" && maxWithdrawValue === null),
    infoLines: amountInfoLines,
    errorMessage: exceedsDepositBalance
      ? "Amount exceeds wallet balance."
      : exceedsWithdrawLimit
      ? "Amount exceeds your withdrawable balance."
      : null,
  };

  const shareCards: ShareCard[] = [];

  if (mode === "deposit" && previewDepositShares !== null) {
    shareCards.push({
      label: "Estimated SRM shares",
      value: formatTokenAmount(
        previewDepositShares,
        srmShareBalance?.decimals ?? DBUSD_DECIMALS,
      ),
    });
  }

  if (mode === "withdraw" && previewWithdrawShares !== null) {
    shareCards.push({
      label: "Estimated SRM shares burned",
      value: formatTokenAmount(
        previewWithdrawShares,
        srmShareBalance?.decimals ?? DBUSD_DECIMALS,
      ),
    });
  }

  if (srmShareBalance) {
    shareCards.push({
      label: "SRM share balance",
      value: formatTokenAmount(
        srmShareBalance.value,
        srmShareBalance.decimals,
      ),
    });
  }

  return {
    modeOptions,
    apyDisplay,
    buttonLabel,
    statusMessage,
    isActionDisabled,
    amountField,
    shareCards,
    handlers: {
      onModeChange: handleModeChange,
      onAmountChange: handleAmountChange,
      onMax: handleMax,
      onSubmit: handleSubmit,
    },
  };
}
