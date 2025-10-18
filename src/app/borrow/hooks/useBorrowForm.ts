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

export type DepositAsset = "WETH" | "ETH";

export type ActionFormControls = {
  amount: string;
  onChange: (value: string) => void;
  onMax: () => void;
  isMaxDisabled: boolean;
  buttonLabel: string;
  isDisabled: boolean;
  onSubmit: () => void;
  assetOptions?: Array<{ value: string; label: string }>;
  selectedAsset?: string;
  onAssetChange?: (value: string) => void;
  helperText?: string;
};

export type CollateralRow = {
  key: string;
  symbol: string;
  depositedAmount: string;
  depositedValue: string;
  price: string;
  maxLtv: string;
  liquidationLtv: string;
  liquidationPrice: string;
  primaryActionLabel: string;
  primaryAction: ActionFormControls;
  secondaryActionLabel: string;
  secondaryAction: ActionFormControls;
};

export type LoanSummary = {
  stats: Array<{ label: string; value: string }>;
  borrow: ActionFormControls;
  repay: ActionFormControls;
};

export type BorrowViewState = {
  collateralRows: CollateralRow[];
  loanSummary: LoanSummary;
  statusMessage: string | null;
};

export function useBorrowForm(): BorrowViewState {
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [borrowAmount, setBorrowAmount] = useState("");
  const [repayAmount, setRepayAmount] = useState("");
  const [depositAsset, setDepositAsset] = useState<DepositAsset>("WETH");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<BorrowMode | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { address, isConnected } = useAccount();

  const wethAddress = TOKEN_METADATA.WETH.address as `0x${string}` | undefined;
  const dbusdAddress = TOKEN_METADATA.DBUSD.address as `0x${string}` | undefined;
  const wethVaultAddress = CONTRACT_ADDRESSES.wethVault as
    | `0x${string}`
    | undefined;
  const dbusdVaultAddress = CONTRACT_ADDRESSES.dbusdVault as
    | `0x${string}`
    | undefined;

  const borrowData = useBorrowContractData({
    address,
    wethAddress,
    dbusdAddress,
    wethVaultAddress,
    dbusdVaultAddress,
  });

  const {
    collateralValue,
    unitOfAccountDecimals,
    unitOfAccountSymbol,
    maxWithdrawValue,
    borrowedAmount,
    borrowHeadroom,
    withdrawHeadroomAssets,
    borrowAprPercent,
    maxLtvBasisPoints,
    liquidationLtvBasisPoints,
    borrowedAmountInUnit,
    convertAssetsToUnit,
    convertDbusdToUnit,
  } = borrowData;

  const depositAssetOptions: Array<{ value: string; label: string }> = [
    { value: "WETH", label: "WETH" },
    { value: "ETH", label: "ETH" },
  ];

  const { writeContractAsync } = useWriteContract();

  const parseAmount = (value: string, decimals: number) => {
    if (!value || Number(value) <= 0) {
      return undefined;
    }

    try {
      return parseUnits(value, decimals);
    } catch {
      return undefined;
    }
  };

  const depositParsedAmount = useMemo(
    () => parseAmount(depositAmount, WETH_DECIMALS),
    [depositAmount],
  );

  const withdrawParsedAmount = useMemo(
    () => parseAmount(withdrawAmount, WETH_DECIMALS),
    [withdrawAmount],
  );

  const borrowParsedAmount = useMemo(
    () => parseAmount(borrowAmount, DBUSD_DECIMALS),
    [borrowAmount],
  );

  const repayParsedAmount = useMemo(
    () => parseAmount(repayAmount, DBUSD_DECIMALS),
    [repayAmount],
  );

  const depositBalance =
    depositAsset === "ETH"
      ? borrowData.ethWalletBalance
      : borrowData.wethWalletBalance;

  const exceedsDepositBalance =
    Boolean(
      depositParsedAmount &&
        depositBalance &&
        depositParsedAmount > depositBalance.value,
    );

  const withdrawLimitAssets = useMemo(() => {
    const ltvLimit = withdrawHeadroomAssets;
    const vaultLimit = maxWithdrawValue;

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
  }, [maxWithdrawValue, withdrawHeadroomAssets]);

  const exceedsWithdrawLimit =
    Boolean(
      withdrawParsedAmount &&
        withdrawLimitAssets !== null &&
        withdrawParsedAmount > withdrawLimitAssets,
    );

  const borrowHeadroomExceeded =
    Boolean(
      borrowParsedAmount &&
        (borrowHeadroom === null ||
          borrowHeadroom === BigInt(0) ||
          borrowParsedAmount > borrowHeadroom),
    );

  const exceedsRepayBorrowed =
    Boolean(
      repayParsedAmount &&
        borrowedAmount !== null &&
        repayParsedAmount > borrowedAmount,
    );

  const insufficientRepayBalance =
    Boolean(
      repayParsedAmount &&
        borrowData.dbusdWalletBalance &&
        repayParsedAmount > borrowData.dbusdWalletBalance.value,
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

  const resetStatus = () => {
    setStatusMessage(null);
  };

  const handleDepositAmountChange = (value: string) => {
    setDepositAmount(value);
    resetStatus();
  };

  const handleWithdrawAmountChange = (value: string) => {
    setWithdrawAmount(value);
    resetStatus();
  };

  const handleBorrowAmountChange = (value: string) => {
    setBorrowAmount(value);
    resetStatus();
  };

  const handleRepayAmountChange = (value: string) => {
    setRepayAmount(value);
    resetStatus();
  };

  const handleDepositAssetChange = (asset: DepositAsset) => {
    if (asset === depositAsset) {
      return;
    }

    setDepositAsset(asset);
    resetStatus();
  };

  const handleDepositMax = () => {
    const balance =
      depositAsset === "ETH"
        ? borrowData.ethWalletBalance
        : borrowData.wethWalletBalance;

    if (!balance || balance.value === BigInt(0)) {
      return;
    }

    setDepositAmount(
      formatTokenAmount(balance.value, balance.decimals ?? WETH_DECIMALS),
    );
    resetStatus();
  };

  const handleWithdrawMax = () => {
    if (!withdrawLimitAssets || withdrawLimitAssets === BigInt(0)) {
      return;
    }

    setWithdrawAmount(formatTokenAmount(withdrawLimitAssets, WETH_DECIMALS));
    resetStatus();
  };

  const handleBorrowMax = () => {
    if (!borrowHeadroom || borrowHeadroom === BigInt(0)) {
      return;
    }

    setBorrowAmount(formatDbusdAmount(borrowHeadroom));
    resetStatus();
  };

  const handleRepayMax = () => {
    if (!borrowedAmount || borrowedAmount === BigInt(0)) {
      return;
    }

    setRepayAmount(formatDbusdAmount(borrowedAmount));
    resetStatus();
  };

  const needsDepositApproval = useMemo(() => {
    if (!depositParsedAmount) {
      return false;
    }

    const allowance = borrowData.wethAllowanceQuery.data;

    if (!allowance) {
      return true;
    }

    return allowance < depositParsedAmount;
  }, [borrowData.wethAllowanceQuery.data, depositParsedAmount]);

  const needsRepayApproval = useMemo(() => {
    if (!repayParsedAmount) {
      return false;
    }

    const allowance = borrowData.dbusdAllowanceQuery.data;

    if (!allowance) {
      return true;
    }

    return allowance < repayParsedAmount;
  }, [borrowData.dbusdAllowanceQuery.data, repayParsedAmount]);

  const performAction = async (action: BorrowMode) => {
    resetStatus();

    if (!isConnected || !address) {
      setStatusMessage("Connect your wallet first.");
      return;
    }

    const parsedAmount =
      action === "depositCollateral"
        ? depositParsedAmount
        : action === "withdrawCollateral"
        ? withdrawParsedAmount
        : action === "borrowDbusd"
        ? borrowParsedAmount
        : repayParsedAmount;

    if (!parsedAmount || parsedAmount === BigInt(0)) {
      setStatusMessage("Enter an amount.");
      return;
    }

    if (
      (action === "depositCollateral" || action === "withdrawCollateral") &&
      !wethVaultAddress
    ) {
      setStatusMessage("WETH vault address is not configured.");
      return;
    }

    if (action === "depositCollateral" && !wethAddress) {
      setStatusMessage("WETH address is not configured.");
      return;
    }

    if (
      (action === "borrowDbusd" || action === "repayDbusd") &&
      !dbusdVaultAddress
    ) {
      setStatusMessage("dbUSD vault address is not configured.");
      return;
    }

    if (action === "repayDbusd" && !dbusdAddress) {
      setStatusMessage("dbUSD token address is not configured.");
      return;
    }

    if (action === "depositCollateral" && exceedsDepositBalance) {
      setStatusMessage("Amount exceeds wallet balance.");
      return;
    }

    if (action === "withdrawCollateral") {
      if (!withdrawLimitAssets || withdrawLimitAssets === BigInt(0)) {
        setStatusMessage("No collateral available to withdraw.");
        return;
      }

      if (exceedsWithdrawLimit) {
        setStatusMessage("Amount exceeds withdrawable collateral.");
        return;
      }
    }

    if (action === "borrowDbusd" && borrowHeadroomExceeded) {
      setStatusMessage("Amount exceeds available to borrow.");
      return;
    }

    if (action === "repayDbusd") {
      if (exceedsRepayBorrowed) {
        setStatusMessage("Amount exceeds borrowed balance.");
        return;
      }

      if (insufficientRepayBalance) {
        setStatusMessage("Amount exceeds wallet balance.");
        return;
      }
    }

    try {
      setActiveAction(action);
      setIsProcessing(true);

      if (action === "depositCollateral" && wethAddress && wethVaultAddress) {
        if (depositAsset === "ETH") {
          setStatusMessage("Wrapping ETH…");
          const wrapHash = await writeContractAsync({
            abi: WETH_ABI,
            address: wethAddress,
            functionName: "deposit",
            args: [],
            value: parsedAmount,
          });

          await waitForTransactionReceipt(wagmiConfig, { hash: wrapHash });
        }

        if (needsDepositApproval) {
          setStatusMessage("Submitting approval…");
          const approvalHash = await writeContractAsync({
            abi: erc20Abi,
            address: wethAddress,
            functionName: "approve",
            args: [wethVaultAddress, parsedAmount],
          });

          await waitForTransactionReceipt(wagmiConfig, { hash: approvalHash });
        }

        setStatusMessage("Depositing…");
        const depositHash = await writeContractAsync({
          abi: VAULT_ABI,
          address: wethVaultAddress,
          functionName: "deposit",
          args: [parsedAmount, address],
        });

        await waitForTransactionReceipt(wagmiConfig, { hash: depositHash });
        setStatusMessage("Deposit completed successfully.");
        setDepositAmount("");
      } else if (action === "withdrawCollateral" && wethVaultAddress) {
        setStatusMessage("Withdrawing…");
        const withdrawHash = await writeContractAsync({
          abi: VAULT_ABI,
          address: wethVaultAddress,
          functionName: "withdraw",
          args: [parsedAmount, address, address],
        });

        await waitForTransactionReceipt(wagmiConfig, { hash: withdrawHash });
        setStatusMessage("Withdrawal completed successfully.");
        setWithdrawAmount("");
      } else if (action === "borrowDbusd" && dbusdVaultAddress) {
        setStatusMessage("Borrowing…");
        const borrowHash = await writeContractAsync({
          abi: VAULT_ABI,
          address: dbusdVaultAddress,
          functionName: "borrow",
          args: [parsedAmount, address],
        });

        await waitForTransactionReceipt(wagmiConfig, { hash: borrowHash });
        setStatusMessage("Borrow completed successfully.");
        setBorrowAmount("");
      } else if (action === "repayDbusd" && dbusdVaultAddress && dbusdAddress) {
        if (needsRepayApproval) {
          setStatusMessage("Submitting approval…");
          const approvalHash = await writeContractAsync({
            abi: erc20Abi,
            address: dbusdAddress,
            functionName: "approve",
            args: [dbusdVaultAddress, parsedAmount],
          });

          await waitForTransactionReceipt(wagmiConfig, { hash: approvalHash });
        }

        setStatusMessage("Repaying…");
        const repayHash = await writeContractAsync({
          abi: VAULT_ABI,
          address: dbusdVaultAddress,
          functionName: "repay",
          args: [parsedAmount, address],
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
      setActiveAction(null);
    }
  };

  const depositButtonLabel = useMemo(() => {
    if (!isConnected) {
      return "Connect wallet";
    }

    if (!depositAmount || !depositParsedAmount) {
      return "Enter amount";
    }

    if (isProcessing && activeAction === "depositCollateral") {
      return needsDepositApproval ? "Approving…" : "Depositing…";
    }

    if (needsDepositApproval) {
      return "Approve & deposit";
    }

    return "Deposit";
  }, [
    activeAction,
    depositAmount,
    depositParsedAmount,
    isConnected,
    isProcessing,
    needsDepositApproval,
  ]);

  const withdrawButtonLabel = useMemo(() => {
    if (!isConnected) {
      return "Connect wallet";
    }

    if (!withdrawAmount || !withdrawParsedAmount) {
      return "Enter amount";
    }

    if (withdrawLimitAssets === null || withdrawLimitAssets === BigInt(0)) {
      return "Nothing to withdraw";
    }

    if (isProcessing && activeAction === "withdrawCollateral") {
      return "Withdrawing…";
    }

    return "Withdraw";
  }, [
    activeAction,
    isConnected,
    isProcessing,
    withdrawAmount,
    withdrawLimitAssets,
    withdrawParsedAmount,
  ]);

  const borrowButtonLabel = useMemo(() => {
    if (!isConnected) {
      return "Connect wallet";
    }

    if (!borrowAmount || !borrowParsedAmount) {
      return "Enter amount";
    }

    if (borrowHeadroom === null || borrowHeadroom === BigInt(0)) {
      return "Nothing to borrow";
    }

    if (isProcessing && activeAction === "borrowDbusd") {
      return "Borrowing…";
    }

    return "Borrow";
  }, [
    activeAction,
    borrowAmount,
    borrowHeadroom,
    borrowParsedAmount,
    isConnected,
    isProcessing,
  ]);

  const repayButtonLabel = useMemo(() => {
    if (!isConnected) {
      return "Connect wallet";
    }

    if (!repayAmount || !repayParsedAmount) {
      return "Enter amount";
    }

    if (!borrowedAmount || borrowedAmount === BigInt(0)) {
      return "Nothing to repay";
    }

    if (isProcessing && activeAction === "repayDbusd") {
      return needsRepayApproval ? "Approving…" : "Repaying…";
    }

    if (needsRepayApproval) {
      return "Approve & repay";
    }

    return "Repay";
  }, [
    activeAction,
    borrowedAmount,
    isConnected,
    isProcessing,
    needsRepayApproval,
    repayAmount,
    repayParsedAmount,
  ]);

  const isDepositDisabled =
    !isConnected ||
    !depositParsedAmount ||
    isProcessing ||
    (depositAsset === "ETH"
      ? !borrowData.ethWalletBalance ||
        borrowData.ethWalletBalance.value === BigInt(0)
      : !borrowData.wethWalletBalance ||
        borrowData.wethWalletBalance.value === BigInt(0)) ||
    exceedsDepositBalance;

  const isWithdrawDisabled =
    !isConnected ||
    !withdrawParsedAmount ||
    isProcessing ||
    withdrawLimitAssets === null ||
    withdrawLimitAssets === BigInt(0) ||
    exceedsWithdrawLimit;

  const isBorrowDisabled =
    !isConnected ||
    !borrowParsedAmount ||
    isProcessing ||
    borrowHeadroom === null ||
    borrowHeadroom === BigInt(0) ||
    borrowHeadroomExceeded;

  const isRepayDisabled =
    !isConnected ||
    !repayParsedAmount ||
    isProcessing ||
    !borrowedAmount ||
    borrowedAmount === BigInt(0) ||
    exceedsRepayBorrowed ||
    insufficientRepayBalance;

  const collateralValueNumber =
    collateralValue !== null
      ? Number(formatUnits(collateralValue, unitOfAccountDecimals))
      : null;

  const collateralAssetsNumber =
    maxWithdrawValue !== null
      ? Number(formatUnits(maxWithdrawValue, WETH_DECIMALS))
      : null;

  const collateralPriceDisplay =
    collateralValueNumber !== null &&
    collateralAssetsNumber !== null &&
    collateralAssetsNumber > 0
      ? `${(collateralValueNumber / collateralAssetsNumber).toFixed(2)} ${unitOfAccountSymbol}/${WETH_SYMBOL}`
      : "—";

  const liquidationPriceDisplay = (() => {
    if (
      liquidationLtvBasisPoints === null ||
      liquidationLtvBasisPoints === 0 ||
      borrowedAmountInUnit === null ||
      collateralAssetsNumber === null ||
      collateralAssetsNumber <= 0
    ) {
      return "—";
    }

    const debtValue = Number(
      formatUnits(borrowedAmountInUnit, unitOfAccountDecimals),
    );

    const threshold = liquidationLtvBasisPoints / 10000;

    if (!Number.isFinite(debtValue) || threshold <= 0) {
      return "—";
    }

    const price = debtValue / (collateralAssetsNumber * threshold);

    if (!Number.isFinite(price)) {
      return "—";
    }

    return `${price.toFixed(2)} ${unitOfAccountSymbol}/${WETH_SYMBOL}`;
  })();

  const maxLtvDisplay =
    maxLtvBasisPoints !== null
      ? `${(maxLtvBasisPoints / 100).toFixed(2)}%`
      : "—";

  const liquidationLtvDisplay =
    liquidationLtvBasisPoints !== null
      ? `${(liquidationLtvBasisPoints / 100).toFixed(2)}%`
      : "—";

  const withdrawableWethDisplay =
    withdrawLimitAssets !== null
      ? `${formatTokenAmount(withdrawLimitAssets, WETH_DECIMALS)} ${WETH_SYMBOL}`
      : "—";

  const collateralValueDisplay =
    collateralValue !== null
      ? `${formatTokenAmount(collateralValue, unitOfAccountDecimals, 2)} ${unitOfAccountSymbol}`
      : "—";

  const borrowedDisplay =
    borrowedAmount !== null
      ? `${formatDbusdAmount(borrowedAmount)} ${DBUSD_SYMBOL}`
      : "—";

  const interestRateDisplay =
    borrowAprPercent !== null ? `${borrowAprPercent.toFixed(2)}% APR` : "—";

  const debtValueUnits = borrowedAmountInUnit;

  const currentLtvPercent = useMemo(() => {
    if (
      collateralValue === null ||
      collateralValue === BigInt(0) ||
      debtValueUnits === null
    ) {
      return null;
    }

    const debt = Number(formatUnits(debtValueUnits, unitOfAccountDecimals));
    const collateral = Number(
      formatUnits(collateralValue, unitOfAccountDecimals),
    );

    if (!Number.isFinite(debt) || !Number.isFinite(collateral) || collateral === 0) {
      return null;
    }

    return (debt / collateral) * 100;
  }, [collateralValue, debtValueUnits, unitOfAccountDecimals]);

  const projectedLtvPercent = useMemo(() => {
    if (
      collateralValue === null ||
      debtValueUnits === null
    ) {
      return null;
    }

    let projectedCollateral = collateralValue;
    let projectedDebt = debtValueUnits;

    if (depositValueUnit !== null) {
      projectedCollateral += depositValueUnit;
    }

    if (withdrawValueUnit !== null) {
      projectedCollateral =
        projectedCollateral > withdrawValueUnit
          ? projectedCollateral - withdrawValueUnit
          : BigInt(0);
    }

    if (borrowValueUnit !== null) {
      projectedDebt += borrowValueUnit;
    }

    if (repayValueUnit !== null) {
      projectedDebt =
        projectedDebt > repayValueUnit ? projectedDebt - repayValueUnit : BigInt(0);
    }

    if (projectedCollateral === BigInt(0)) {
      return null;
    }

    const debt = Number(formatUnits(projectedDebt, unitOfAccountDecimals));
    const collateral = Number(
      formatUnits(projectedCollateral, unitOfAccountDecimals),
    );

    if (!Number.isFinite(debt) || !Number.isFinite(collateral) || collateral === 0) {
      return null;
    }

    return (debt / collateral) * 100;
  }, [
    borrowValueUnit,
    collateralValue,
    debtValueUnits,
    depositValueUnit,
    repayValueUnit,
    unitOfAccountDecimals,
    withdrawValueUnit,
  ]);

  const formatPercent = (value: number | null) =>
    value === null ? "—" : `${value.toFixed(2)}%`;

  const borrowCapacityDisplay =
    borrowHeadroom !== null
      ? `${formatDbusdAmount(borrowHeadroom)} ${DBUSD_SYMBOL}`
      : "—";

  const collateralRows: CollateralRow[] = [
    {
      key: "weth",
      symbol: WETH_SYMBOL,
      depositedAmount:
        maxWithdrawValue !== null
          ? `${formatTokenAmount(maxWithdrawValue, WETH_DECIMALS)} ${WETH_SYMBOL}`
          : "—",
      depositedValue: collateralValueDisplay,
      price: collateralPriceDisplay,
      maxLtv: maxLtvDisplay,
      liquidationLtv: liquidationLtvDisplay,
      liquidationPrice: liquidationPriceDisplay,
      primaryActionLabel: "Deposit",
      primaryAction: {
        amount: depositAmount,
        onChange: handleDepositAmountChange,
        onMax: handleDepositMax,
        isMaxDisabled:
          !depositBalance || (depositBalance.value ?? BigInt(0)) === BigInt(0),
        buttonLabel: depositButtonLabel,
        isDisabled: isDepositDisabled,
        onSubmit: () => {
          void performAction("depositCollateral");
        },
        assetOptions: depositAssetOptions,
        selectedAsset: depositAsset,
        onAssetChange: (value) =>
          handleDepositAssetChange(value as DepositAsset),
        helperText: `Wallet: ${
          depositBalance
            ? `${formatTokenAmount(
                depositBalance.value,
                depositBalance.decimals ?? WETH_DECIMALS,
              )} ${depositAsset}`
            : "—"
        }`,
      },
      secondaryActionLabel: "Withdraw",
      secondaryAction: {
        amount: withdrawAmount,
        onChange: handleWithdrawAmountChange,
        onMax: handleWithdrawMax,
        isMaxDisabled:
          !withdrawLimitAssets || withdrawLimitAssets === BigInt(0),
        buttonLabel: withdrawButtonLabel,
        isDisabled: isWithdrawDisabled,
        onSubmit: () => {
          void performAction("withdrawCollateral");
        },
        helperText: `Withdrawable: ${withdrawableWethDisplay}`,
      },
    },
  ];

  const loanSummary: LoanSummary = {
    stats: [
      { label: "Borrowed", value: borrowedDisplay },
      { label: "Interest rate", value: interestRateDisplay },
      { label: "Current LTV", value: formatPercent(currentLtvPercent) },
      { label: "Projected LTV", value: formatPercent(projectedLtvPercent) },
    ],
    borrow: {
      amount: borrowAmount,
      onChange: handleBorrowAmountChange,
      onMax: handleBorrowMax,
      isMaxDisabled:
        borrowHeadroom === null || borrowHeadroom === BigInt(0),
      buttonLabel: borrowButtonLabel,
      isDisabled: isBorrowDisabled,
      onSubmit: () => {
        void performAction("borrowDbusd");
      },
      helperText: `Available: ${borrowCapacityDisplay}`,
    },
    repay: {
      amount: repayAmount,
      onChange: handleRepayAmountChange,
      onMax: handleRepayMax,
      isMaxDisabled:
        !borrowedAmount || borrowedAmount === BigInt(0),
      buttonLabel: repayButtonLabel,
      isDisabled: isRepayDisabled,
      onSubmit: () => {
        void performAction("repayDbusd");
      },
      helperText: `Outstanding: ${borrowedDisplay}`,
    },
  };

  return {
    collateralRows,
    loanSummary,
    statusMessage,
  };
}
