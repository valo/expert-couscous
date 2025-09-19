"use client";

import { useMemo, useState } from "react";
import { erc20Abi, formatUnits, parseUnits } from "viem";
import {
  useAccount,
  useBalance,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { config as wagmiConfig } from "@/lib/config";
import { CONTRACT_ADDRESSES, PSM_ABI } from "@/lib/contracts";

import { DIRECTIONS, DirectionKey } from "../constants";

type TokenDisplay = {
  symbol: string;
  balanceFormatted?: string;
};

export type SwapFormHandlers = {
  onAmountChange: (value: string) => void;
  onMax: () => void;
  onSwap: () => Promise<void>;
  onToggleDirection: () => void;
};

export type SwapFormState = {
  amount: string;
  buttonLabel: string;
  directionLabel: string;
  from: TokenDisplay;
  to: TokenDisplay & { amountDisplay: string };
  isSwapDisabled: boolean;
  statusMessage: string | null;
  handlers: SwapFormHandlers;
};

export function useSwapForm(): SwapFormState {
  const [direction, setDirection] = useState<DirectionKey>("USDC_TO_DBUSD");
  const [amount, setAmount] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { address, isConnected } = useAccount();

  const psmAddress = CONTRACT_ADDRESSES.psm as `0x${string}` | undefined;

  const directionConfig = DIRECTIONS[direction];
  const fromToken = directionConfig.from;
  const toToken = directionConfig.to;

  const fromTokenAddress = fromToken.address as `0x${string}` | undefined;
  const toTokenAddress = toToken.address as `0x${string}` | undefined;

  const parsedAmount = useMemo(() => {
    if (!amount || Number(amount) <= 0) {
      return undefined;
    }

    try {
      return parseUnits(amount, fromToken.decimals);
    } catch {
      return undefined;
    }
  }, [amount, fromToken.decimals]);

  const {
    data: allowance,
    isFetching: isCheckingAllowance,
    refetch: refetchAllowance,
  } = useReadContract({
    abi: erc20Abi,
    address: fromTokenAddress,
    functionName: "allowance",
    args: address && psmAddress ? [address, psmAddress] : undefined,
    query: {
      enabled: Boolean(address && fromTokenAddress && psmAddress),
    },
  });

  const needsApproval = useMemo(() => {
    if (!parsedAmount) {
      return false;
    }

    if (!allowance) {
      return true;
    }

    return allowance < parsedAmount;
  }, [allowance, parsedAmount]);

  const quoteArgs = useMemo(() => {
    if (!parsedAmount) {
      return undefined;
    }

    return [parsedAmount] as const;
  }, [parsedAmount]);

  const { data: quoteOutRaw, isLoading: isQuoting } = useReadContract({
    abi: PSM_ABI,
    address: psmAddress,
    functionName: directionConfig.quoteFn,
    args: quoteArgs,
    query: {
      enabled: Boolean(psmAddress && quoteArgs),
    },
  });

  const quoteOut = typeof quoteOutRaw === "bigint" ? quoteOutRaw : undefined;

  const { data: fromBalance, refetch: refetchFromBalance } = useBalance({
    address,
    token: fromTokenAddress,
    query: {
      enabled: Boolean(address && fromTokenAddress),
    },
  });

  const { data: toBalance, refetch: refetchToBalance } = useBalance({
    address,
    token: toTokenAddress,
    query: {
      enabled: Boolean(address && toTokenAddress),
    },
  });

  const { writeContractAsync } = useWriteContract();

  const resetStatus = () => {
    setStatusMessage(null);
  };

  const handleDirectionToggle = () => {
    setDirection((prev) =>
      prev === "USDC_TO_DBUSD" ? "DBUSD_TO_USDC" : "USDC_TO_DBUSD"
    );
    setAmount("");
    resetStatus();
  };

  const handleAmountChange = (value: string) => {
    setAmount(value);
    resetStatus();
  };

  const handleMax = () => {
    if (!fromBalance) {
      return;
    }

    const formatted = formatUnits(fromBalance.value, fromBalance.decimals);
    setAmount(formatted);
    resetStatus();
  };

  const handleSwap = async () => {
    resetStatus();

    if (!isConnected || !address) {
      setStatusMessage("Connect your wallet first.");
      return;
    }

    if (!psmAddress || !fromTokenAddress || !toTokenAddress) {
      setStatusMessage("Swap configuration is incomplete.");
      return;
    }

    if (!parsedAmount) {
      setStatusMessage("Enter an amount to swap.");
      return;
    }

    setIsProcessing(true);

    try {
      if (needsApproval) {
        setStatusMessage("Submitting approval…");
        const approvalHash = await writeContractAsync({
          abi: erc20Abi,
          address: fromTokenAddress,
          functionName: "approve",
          args: [psmAddress, parsedAmount],
        });

        await waitForTransactionReceipt(wagmiConfig, { hash: approvalHash });
        await refetchAllowance();
      }

      setStatusMessage("Executing swap…");

      const swapHash = await writeContractAsync({
        abi: PSM_ABI,
        address: psmAddress,
        functionName: directionConfig.swapFn,
        args: [parsedAmount, address],
      });

      await waitForTransactionReceipt(wagmiConfig, { hash: swapHash });

      setStatusMessage("Swap completed successfully.");
      setAmount("");
      await Promise.allSettled([
        refetchAllowance(),
        refetchFromBalance(),
        refetchToBalance(),
      ]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to complete swap.";
      setStatusMessage(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const buttonLabel = useMemo(() => {
    if (!isConnected) {
      return "Connect wallet";
    }

    if (!amount || !parsedAmount) {
      return "Enter amount";
    }

    if (isProcessing) {
      return needsApproval ? "Approving…" : "Swapping…";
    }

    if (needsApproval) {
      return "Approve & swap";
    }

    return "Swap";
  }, [amount, isConnected, isProcessing, needsApproval, parsedAmount]);

  const isSwapDisabled =
    !isConnected ||
    !psmAddress ||
    !fromTokenAddress ||
    !toTokenAddress ||
    !parsedAmount ||
    isProcessing ||
    isCheckingAllowance;

  const fromBalanceFormatted = fromBalance
    ? formatUnits(fromBalance.value, fromBalance.decimals)
    : undefined;

  const toBalanceFormatted = toBalance
    ? formatUnits(toBalance.value, toBalance.decimals)
    : undefined;

  const toAmountDisplay =
    quoteOut && !isQuoting ? formatUnits(quoteOut, toToken.decimals) : "0.0";

  return {
    amount,
    buttonLabel,
    directionLabel: directionConfig.label,
    from: {
      symbol: fromToken.symbol,
      balanceFormatted: fromBalanceFormatted,
    },
    to: {
      symbol: toToken.symbol,
      balanceFormatted: toBalanceFormatted,
      amountDisplay: toAmountDisplay,
    },
    isSwapDisabled,
    statusMessage,
    handlers: {
      onAmountChange: handleAmountChange,
      onMax: handleMax,
      onSwap: handleSwap,
      onToggleDirection: handleDirectionToggle,
    },
  };
}
