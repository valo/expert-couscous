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
import {
  CONTRACT_ADDRESSES,
  SRM_ABI,
  TOKEN_METADATA,
} from "@/lib/contracts";

const SECONDS_PER_YEAR = 31_536_000n;
const APY_SCALE = 1_000_000n;

type Mode = "deposit" | "withdraw";

function formatTokenAmount(value: bigint, decimals: number, precision = 6) {
  const formatted = formatUnits(value, decimals);

  if (!formatted.includes(".")) {
    return formatted;
  }

  const [integer, fraction] = formatted.split(".");
  const trimmedFraction = fraction.slice(0, precision).replace(/0+$/, "");

  return trimmedFraction ? `${integer}.${trimmedFraction}` : integer;
}

export default function EarnPage() {
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
      return parseUnits(depositAmount, TOKEN_METADATA.DBUSD.decimals);
    } catch {
      return undefined;
    }
  }, [depositAmount]);

  const withdrawParsedAmount = useMemo(() => {
    if (!withdrawAmount || Number(withdrawAmount) <= 0) {
      return undefined;
    }

    try {
      return parseUnits(withdrawAmount, TOKEN_METADATA.DBUSD.decimals);
    } catch {
      return undefined;
    }
  }, [withdrawAmount]);

  const {
    data: allowance,
    isFetching: isCheckingAllowance,
    refetch: refetchAllowance,
  } = useReadContract({
    abi: erc20Abi,
    address: dbusdAddress,
    functionName: "allowance",
    args: address && srmAddress ? [address, srmAddress] : undefined,
    query: {
      enabled: Boolean(address && dbusdAddress && srmAddress),
    },
  });

  const needsApproval = useMemo(() => {
    if (!depositParsedAmount) {
      return false;
    }

    if (!allowance) {
      return true;
    }

    return allowance < depositParsedAmount;
  }, [allowance, depositParsedAmount]);

  const {
    data: dbusdBalance,
    refetch: refetchDbusdBalance,
  } = useBalance({
    address,
    token: dbusdAddress,
    query: {
      enabled: Boolean(address && dbusdAddress),
    },
  });

  const {
    data: srmShareBalance,
    refetch: refetchSrmShareBalance,
  } = useBalance({
    address,
    token: srmAddress,
    query: {
      enabled: Boolean(address && srmAddress),
    },
  });

  const {
    data: maxWithdraw,
    refetch: refetchMaxWithdraw,
  } = useReadContract({
    abi: SRM_ABI,
    address: srmAddress,
    functionName: "maxWithdraw",
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(address && srmAddress),
    },
  });

  const { data: previewDepositShares } = useReadContract({
    abi: SRM_ABI,
    address: srmAddress,
    functionName: "previewDeposit",
    args: depositParsedAmount ? [depositParsedAmount] : undefined,
    query: {
      enabled: Boolean(srmAddress && depositParsedAmount),
    },
  });

  const { data: previewWithdrawShares } = useReadContract({
    abi: SRM_ABI,
    address: srmAddress,
    functionName: "previewWithdraw",
    args: withdrawParsedAmount ? [withdrawParsedAmount] : undefined,
    query: {
      enabled: Boolean(srmAddress && withdrawParsedAmount),
    },
  });

  const { data: dripRate } = useReadContract({
    abi: SRM_ABI,
    address: srmAddress,
    functionName: "dripRate",
    query: {
      enabled: Boolean(srmAddress),
    },
  });

  const { data: totalAssets } = useReadContract({
    abi: SRM_ABI,
    address: srmAddress,
    functionName: "totalAssets",
    query: {
      enabled: Boolean(srmAddress),
    },
  });

  const apyPercent = useMemo(() => {
    if (!dripRate || !totalAssets || totalAssets === 0n) {
      return null;
    }

    const annualInterest = dripRate * SECONDS_PER_YEAR;
    const scaledPercent = (annualInterest * 100n * APY_SCALE) / totalAssets;
    const numeric = Number(scaledPercent) / Number(APY_SCALE);

    if (!Number.isFinite(numeric)) {
      return null;
    }

    return numeric;
  }, [dripRate, totalAssets]);

  const apyDisplay = useMemo(() => {
    if (apyPercent === null) {
      return "—";
    }

    return `${apyPercent.toFixed(2)}%`;
  }, [apyPercent]);

  const { writeContractAsync } = useWriteContract();

  const availableToWithdraw = maxWithdraw ?? 0n;
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
      withdrawParsedAmount && withdrawParsedAmount > availableToWithdraw,
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

  const handleMax = () => {
    if (mode === "deposit") {
      if (!dbusdBalance) {
        return;
      }

      setDepositAmount(
        formatUnits(dbusdBalance.value, dbusdBalance.decimals),
      );
      return;
    }

    if (!maxWithdraw) {
      return;
    }

    setWithdrawAmount(
      formatUnits(maxWithdraw, TOKEN_METADATA.DBUSD.decimals),
    );
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

      const refetchPromises: Array<Promise<unknown>> = [];

      if (refetchAllowance) {
        refetchPromises.push(refetchAllowance());
      }

      if (refetchDbusdBalance) {
        refetchPromises.push(refetchDbusdBalance());
      }

      if (refetchSrmShareBalance) {
        refetchPromises.push(refetchSrmShareBalance());
      }

      if (refetchMaxWithdraw) {
        refetchPromises.push(refetchMaxWithdraw());
      }

      await Promise.allSettled(refetchPromises);
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

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 py-12 sm:px-6">
      <section className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-black">
        <header className="mb-6 space-y-2">
          <h1 className="text-3xl font-bold">Earn</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Deposit dbUSD into the Savings Rate Module to accrue yield or
            withdraw your savings at any time.
          </p>
        </header>

        <div className="mb-6 rounded-2xl border border-neutral-200 bg-neutral-50 px-6 py-4 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Current APY
              </p>
              <p className="text-3xl font-semibold text-neutral-900 dark:text-white">
                {apyDisplay}
              </p>
            </div>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              Based on drip rate and SRM balance
            </span>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-2 text-sm font-semibold">
          {(["deposit", "withdraw"] as const).map((value) => {
            const isActive = mode === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => handleModeChange(value)}
                className={`rounded-xl border px-4 py-2 transition ${
                  isActive
                    ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-100"
                    : "border-neutral-200 text-neutral-600 hover:border-neutral-300 hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-neutral-600 dark:hover:text-white"
                }`}
              >
                {value === "deposit" ? "Deposit" : "Withdraw"}
              </button>
            );
          })}
        </div>

        <div className="space-y-4">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              <span>{mode === "deposit" ? "Deposit" : "Withdraw"} amount</span>
              <button
                type="button"
                onClick={handleMax}
                className="text-blue-600 hover:underline disabled:pointer-events-none disabled:text-neutral-400"
                disabled={
                  (mode === "deposit" && !dbusdBalance) ||
                  (mode === "withdraw" && !maxWithdraw)
                }
              >
                Max
              </button>
            </div>
            <div className="flex items-center rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus-within:border-blue-500 dark:border-neutral-700 dark:bg-neutral-900">
              <input
                className="flex-1 bg-transparent text-lg outline-none"
                placeholder="0.0"
                value={activeAmount}
                onChange={(event) => {
                  setActiveAmount(event.target.value);
                  resetStatus();
                }}
                inputMode="decimal"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
              <span className="ml-3 text-sm font-semibold">
                {TOKEN_METADATA.DBUSD.symbol}
              </span>
            </div>
            {mode === "deposit" && dbusdBalance && (
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Wallet balance: {" "}
                {formatTokenAmount(
                  dbusdBalance.value,
                  dbusdBalance.decimals,
                )} {TOKEN_METADATA.DBUSD.symbol}
              </p>
            )}
            {mode === "withdraw" && maxWithdraw !== undefined && (
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Available to withdraw: {" "}
                {formatTokenAmount(
                  availableToWithdraw,
                  TOKEN_METADATA.DBUSD.decimals,
                )} {TOKEN_METADATA.DBUSD.symbol}
              </p>
            )}
            {exceedsDepositBalance && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                Amount exceeds wallet balance.
              </p>
            )}
            {exceedsWithdrawLimit && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                Amount exceeds your withdrawable balance.
              </p>
            )}
          </div>

          {mode === "deposit" && previewDepositShares && (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm dark:border-neutral-700 dark:bg-neutral-900">
              <p className="text-neutral-600 dark:text-neutral-300">
                Estimated SRM shares:{" "}
                <span className="font-semibold">
                  {formatTokenAmount(
                    previewDepositShares,
                    srmShareBalance?.decimals ?? TOKEN_METADATA.DBUSD.decimals,
                  )}
                </span>
              </p>
            </div>
          )}

          {mode === "withdraw" && previewWithdrawShares && (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm dark:border-neutral-700 dark:bg-neutral-900">
              <p className="text-neutral-600 dark:text-neutral-300">
                Estimated SRM shares burned:{" "}
                <span className="font-semibold">
                  {formatTokenAmount(
                    previewWithdrawShares,
                    srmShareBalance?.decimals ?? TOKEN_METADATA.DBUSD.decimals,
                  )}
                </span>
              </p>
            </div>
          )}

          {srmShareBalance && (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm dark:border-neutral-700 dark:bg-neutral-900">
              <p className="text-neutral-600 dark:text-neutral-300">
                SRM share balance:{" "}
                <span className="font-semibold">
                  {formatTokenAmount(
                    srmShareBalance.value,
                    srmShareBalance.decimals,
                  )}
                </span>
              </p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isActionDisabled}
          className="mt-6 w-full rounded-xl bg-blue-600 py-3 text-center text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500"
        >
          {buttonLabel}
        </button>

        {statusMessage && (
          <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">
            {statusMessage}
          </p>
        )}
      </section>
    </main>
  );
}
