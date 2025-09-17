"use client";

import { useMemo, useState } from "react";
import {
  erc20Abi,
  formatUnits,
  isAddress,
  parseUnits,
} from "viem";
import {
  useAccount,
  useBalance,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { config as wagmiConfig } from "@/lib/config";
import {
  CONTRACT_ADDRESSES,
  TOKEN_METADATA,
  PSM_ABI,
} from "@/lib/contracts";

const REQUIRED_ENV = [
  { key: "NEXT_PUBLIC_PSM_ADDRESS", value: CONTRACT_ADDRESSES.psm },
  { key: "NEXT_PUBLIC_USDC_ADDRESS", value: CONTRACT_ADDRESSES.usdc },
  { key: "NEXT_PUBLIC_DBUSD_ADDRESS", value: CONTRACT_ADDRESSES.dbusd },
] as const;

const DIRECTIONS = {
  USDC_TO_DBUSD: {
    label: "USDC → dbUSD",
    from: TOKEN_METADATA.USDC,
    to: TOKEN_METADATA.DBUSD,
    swapFn: "swapToSynthGivenIn" as const,
    quoteFn: "quoteToSynthGivenIn" as const,
  },
  DBUSD_TO_USDC: {
    label: "dbUSD → USDC",
    from: TOKEN_METADATA.DBUSD,
    to: TOKEN_METADATA.USDC,
    swapFn: "swapToUnderlyingGivenIn" as const,
    quoteFn: "quoteToUnderlyingGivenIn" as const,
  },
} as const;

type DirectionKey = keyof typeof DIRECTIONS;

export default function SwapPage() {
  const [direction, setDirection] = useState<DirectionKey>("USDC_TO_DBUSD");
  const [amount, setAmount] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { address, isConnected } = useAccount();

  const validation = useMemo(() => {
    const missing = REQUIRED_ENV.filter(({ value }) => !value);
    const invalid = REQUIRED_ENV.filter(
      ({ value }) => value && !isAddress(value)
    );
    return {
      missing: missing.map(({ key }) => key),
      invalid: invalid.map(({ key }) => key),
    };
  }, []);

  const hasConfigError = validation.missing.length > 0 || validation.invalid.length > 0;

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

  const { data: allowance, isFetching: isCheckingAllowance, refetch: refetchAllowance } = useReadContract({
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

  const quoteOut =
    typeof quoteOutRaw === "bigint" ? quoteOutRaw : undefined;

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

  const handleMax = () => {
    if (!fromBalance) {
      return;
    }

    const formatted = formatUnits(fromBalance.value, fromBalance.decimals);
    setAmount(formatted);
  };

  const handleSwap = async () => {
    resetStatus();

    if (hasConfigError) {
      setStatusMessage(
        "Contract addresses are missing or invalid. Update your environment before swapping."
      );
      return;
    }

    if (!isConnected || !address) {
      setStatusMessage("Connect your wallet first.");
      return;
    }

    if (!psmAddress || !fromTokenAddress) {
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

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 py-12 sm:px-6">
      <section className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-black">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Swap</h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Trade between USDC and dbUSD using the Peg Stability Module.
            </p>
          </div>
          <button
            className="text-sm font-medium text-blue-600 hover:underline"
            onClick={handleDirectionToggle}
            type="button"
          >
            {directionConfig.label}
          </button>
        </header>

        {hasConfigError && (
          <div className="mb-4 rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-600/70 dark:bg-amber-500/10 dark:text-amber-200">
            <p className="font-medium">Missing contract configuration.</p>
            {validation.missing.length > 0 && (
              <p>
                Set environment variables {validation.missing.join(", ")} and
                restart the dev server.
              </p>
            )}
            {validation.invalid.length > 0 && (
              <p>
                Check that {validation.invalid.join(", ")} contain valid 0x
                addresses.
              </p>
            )}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              <span>From</span>
              <button
                type="button"
                onClick={handleMax}
                className="text-blue-600 hover:underline"
              >
                Max
              </button>
            </div>
            <div className="flex items-center rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus-within:border-blue-500 dark:border-neutral-700 dark:bg-neutral-900">
              <input
                className="flex-1 bg-transparent text-lg outline-none"
                placeholder="0.0"
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                  resetStatus();
                }}
                inputMode="decimal"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
              <span className="ml-3 text-sm font-semibold">
                {fromToken.symbol}
              </span>
            </div>
            {fromBalance && (
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Balance: {formatUnits(fromBalance.value, fromBalance.decimals)} {" "}
                {fromBalance.symbol}
              </p>
            )}
          </div>

          <div className="rounded-full bg-neutral-100 py-1 text-center text-xs font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
            {directionConfig.label}
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              <span>To</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900">
              <span className="text-lg font-semibold">
                {quoteOut && !isQuoting
                  ? formatUnits(quoteOut, toToken.decimals)
                  : "0.0"}
              </span>
              <span className="text-sm font-semibold">{toToken.symbol}</span>
            </div>
            {toBalance && (
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Balance: {formatUnits(toBalance.value, toBalance.decimals)} {" "}
                {toBalance.symbol}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleSwap}
          disabled={
            hasConfigError ||
            !isConnected ||
            !parsedAmount ||
            isProcessing ||
            isCheckingAllowance
          }
          className="mt-6 w-full rounded-xl bg-blue-600 py-3 text-center text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500"
        >
          {buttonLabel}
        </button>

        {statusMessage && (
          <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">
            {statusMessage}
          </p>
        )}

        <div className="mt-6 space-y-2 text-xs text-neutral-500 dark:text-neutral-400">
          <p>
            To get some Sepolia USDC, use this faucet:{" "}
            <a
              href="https://faucet.circle.com/"
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 hover:underline"
            >
              https://faucet.circle.com/
            </a>
          </p>
          <p>
            For some Sepolia ETH for gas, use this faucet:{" "}
            <a
              href="https://cloud.google.com/application/web3/faucet/ethereum/sepolia"
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 hover:underline"
            >
              https://cloud.google.com/application/web3/faucet/ethereum/sepolia
            </a>
          </p>
        </div>

      </section>
    </main>
  );
}
