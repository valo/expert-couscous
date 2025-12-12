"use client";

import { useMemo, useState } from "react";
import { erc20Abi, formatUnits, parseUnits } from "viem";
import { useAccount, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";

import {
  DBUSD_DECIMALS,
  DBUSD_SYMBOL,
  WETH_DECIMALS,
  WBTC_DECIMALS,
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

export type CollateralKey = "weth" | "wbtc";
export type DepositAsset = "WETH" | "ETH" | "WBTC";

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
  const [depositAmounts, setDepositAmounts] = useState<
    Record<CollateralKey, string>
  >({
    weth: "",
    wbtc: "",
  });
  const [withdrawAmounts, setWithdrawAmounts] = useState<
    Record<CollateralKey, string>
  >({
    weth: "",
    wbtc: "",
  });
  const [borrowAmount, setBorrowAmount] = useState("");
  const [repayAmount, setRepayAmount] = useState("");
  const [depositAssetSelection, setDepositAssetSelection] = useState<
    Record<CollateralKey, DepositAsset>
  >({
    weth: "WETH",
    wbtc: "WBTC",
  });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<{
    mode: BorrowMode;
    collateral?: CollateralKey;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { address, isConnected } = useAccount();

  const wethAddress = TOKEN_METADATA.WETH.address as `0x${string}` | undefined;
  const wbtcAddress = TOKEN_METADATA.WBTC.address as `0x${string}` | undefined;
  const dbusdAddress = TOKEN_METADATA.DBUSD.address as `0x${string}` | undefined;
  const wethVaultAddress = CONTRACT_ADDRESSES.wethVault as
    | `0x${string}`
    | undefined;
  const wbtcVaultAddress = CONTRACT_ADDRESSES.wbtcVault as
    | `0x${string}`
    | undefined;
  const dbusdVaultAddress = CONTRACT_ADDRESSES.dbusdVault as
    | `0x${string}`
    | undefined;

  const borrowData = useBorrowContractData({
    address,
    wethAddress,
    wbtcAddress,
    dbusdAddress,
    wethVaultAddress,
    wbtcVaultAddress,
    dbusdVaultAddress,
  });

  const {
    collaterals,
    unitOfAccountDecimals,
    unitOfAccountSymbol,
    borrowedAmount,
    borrowedAmountInUnit,
    borrowHeadroom,
    borrowAprPercent,
    convertDbusdToUnit,
    wethAllowanceQuery,
    wbtcAllowanceQuery,
    dbusdAllowanceQuery,
    wethWalletBalance,
    wbtcWalletBalance,
    ethWalletBalance,
    dbusdWalletBalance,
    totalCollateralValue,
    refetchAll,
  } = borrowData;
  const collateralMap = useMemo(
    () =>
      collaterals.reduce<Record<CollateralKey, (typeof collaterals)[number]>>(
        (map, collateral) => {
          map[collateral.key] = collateral;
          return map;
        },
        {} as Record<CollateralKey, (typeof collaterals)[number]>,
      ),
    [collaterals],
  );

  const depositAssetOptions: Record<CollateralKey, Array<{ value: string; label: string }>> = {
    weth: [
      { value: "WETH", label: "WETH" },
      { value: "ETH", label: "ETH" },
    ],
    wbtc: [{ value: "WBTC", label: "WBTC" }],
  };

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

  const depositParsedAmounts = useMemo(
    () => ({
      weth: parseAmount(depositAmounts.weth, WETH_DECIMALS),
      wbtc: parseAmount(depositAmounts.wbtc, WBTC_DECIMALS),
    }),
    [depositAmounts],
  );

  const withdrawParsedAmounts = useMemo(
    () => ({
      weth: parseAmount(withdrawAmounts.weth, WETH_DECIMALS),
      wbtc: parseAmount(withdrawAmounts.wbtc, WBTC_DECIMALS),
    }),
    [withdrawAmounts],
  );

  const getDepositBalance = (key: CollateralKey) => {
    if (key === "weth") {
      return depositAssetSelection.weth === "ETH"
        ? ethWalletBalance
        : wethWalletBalance;
    }

    return wbtcWalletBalance;
  };

  const getDepositParsedAmount = (key: CollateralKey) =>
    key === "weth" ? depositParsedAmounts.weth : depositParsedAmounts.wbtc;

  const getWithdrawParsedAmount = (key: CollateralKey) =>
    key === "weth" ? withdrawParsedAmounts.weth : withdrawParsedAmounts.wbtc;

  const getDepositAssetLabel = (key: CollateralKey): DepositAsset =>
    key === "weth" ? depositAssetSelection.weth : "WBTC";

  const borrowParsedAmount = useMemo(
    () => parseAmount(borrowAmount, DBUSD_DECIMALS),
    [borrowAmount],
  );

  const repayParsedAmount = useMemo(
    () => parseAmount(repayAmount, DBUSD_DECIMALS),
    [repayAmount],
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
        dbusdWalletBalance &&
        repayParsedAmount > dbusdWalletBalance.value,
    );

  const depositValueUnitByKey = useMemo(() => {
    const values: Record<CollateralKey, bigint | null> = {
      weth: null,
      wbtc: null,
    };

    collaterals.forEach((collateral) => {
      const parsedAmount =
        collateral.key === "weth"
          ? depositParsedAmounts.weth
          : depositParsedAmounts.wbtc;

      values[collateral.key] =
        parsedAmount !== undefined
          ? collateral.convertAssetsToUnit(parsedAmount) ?? null
          : null;
    });

    return values;
  }, [collaterals, depositParsedAmounts]);

  const withdrawValueUnitByKey = useMemo(() => {
    const values: Record<CollateralKey, bigint | null> = {
      weth: null,
      wbtc: null,
    };

    collaterals.forEach((collateral) => {
      const parsedAmount =
        collateral.key === "weth"
          ? withdrawParsedAmounts.weth
          : withdrawParsedAmounts.wbtc;

      values[collateral.key] =
        parsedAmount !== undefined
          ? collateral.convertAssetsToUnit(parsedAmount) ?? null
          : null;
    });

    return values;
  }, [collaterals, withdrawParsedAmounts]);

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

  const handleDepositAmountChange = (key: CollateralKey, value: string) => {
    setDepositAmounts((prev) => ({ ...prev, [key]: value }));
    resetStatus();
  };

  const handleWithdrawAmountChange = (key: CollateralKey, value: string) => {
    setWithdrawAmounts((prev) => ({ ...prev, [key]: value }));
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

  const handleDepositAssetChange = (
    key: CollateralKey,
    asset: DepositAsset,
  ) => {
    if (asset === depositAssetSelection[key]) {
      return;
    }

    setDepositAssetSelection((prev) => ({ ...prev, [key]: asset }));
    resetStatus();
  };

  const handleDepositMax = (key: CollateralKey) => {
    const balance = getDepositBalance(key);

    if (!balance || balance.value === BigInt(0)) {
      return;
    }

    setDepositAmounts((prev) => ({
      ...prev,
      [key]: formatTokenAmount(
        balance.value,
        balance.decimals ??
          (key === "weth" ? WETH_DECIMALS : WBTC_DECIMALS),
      ),
    }));
    resetStatus();
  };

  const handleWithdrawMax = (key: CollateralKey) => {
    const collateral = collateralMap[key];
    const withdrawLimitAssets = collateral?.withdrawHeadroomAssets ?? null;

    if (!withdrawLimitAssets || withdrawLimitAssets === BigInt(0)) {
      return;
    }

    setWithdrawAmounts((prev) => ({
      ...prev,
      [key]: formatTokenAmount(
        withdrawLimitAssets,
        key === "weth" ? WETH_DECIMALS : WBTC_DECIMALS,
      ),
    }));
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

  const needsDepositApproval = useMemo(
    () => ({
      weth:
        depositParsedAmounts.weth !== undefined &&
        Boolean(
          !wethAllowanceQuery.data ||
            wethAllowanceQuery.data < depositParsedAmounts.weth,
        ),
      wbtc:
        depositParsedAmounts.wbtc !== undefined &&
        Boolean(
          !wbtcAllowanceQuery.data ||
            wbtcAllowanceQuery.data < depositParsedAmounts.wbtc,
        ),
    }),
    [
      depositParsedAmounts.wbtc,
      depositParsedAmounts.weth,
      wbtcAllowanceQuery.data,
      wethAllowanceQuery.data,
    ],
  );

  const needsRepayApproval = useMemo(() => {
    if (!repayParsedAmount) {
      return false;
    }

    const allowance = dbusdAllowanceQuery.data;

    if (!allowance) {
      return true;
    }

    return allowance < repayParsedAmount;
  }, [dbusdAllowanceQuery.data, repayParsedAmount]);

  const performAction = async (
    action: BorrowMode,
    collateralKey?: CollateralKey,
  ) => {
    resetStatus();

    if (!isConnected || !address) {
      setStatusMessage("Connect your wallet first.");
      return;
    }

    const collateral = collateralKey ? collateralMap[collateralKey] : undefined;
    const parsedAmount =
      action === "depositCollateral"
        ? collateralKey
          ? getDepositParsedAmount(collateralKey)
          : undefined
        : action === "withdrawCollateral"
        ? collateralKey
          ? getWithdrawParsedAmount(collateralKey)
          : undefined
        : action === "borrowDbusd"
        ? borrowParsedAmount
        : repayParsedAmount;

    if (!parsedAmount || parsedAmount === BigInt(0)) {
      setStatusMessage("Enter an amount.");
      return;
    }

    if (
      (action === "depositCollateral" || action === "withdrawCollateral") &&
      (!collateral || !collateral.vaultAddress)
    ) {
      setStatusMessage(
        `${collateral?.symbol ?? "Collateral"} vault address is not configured.`,
      );
      return;
    }

    if (
      action === "depositCollateral" &&
      (!collateral || !collateral.tokenAddress)
    ) {
      setStatusMessage(
        `${collateral?.symbol ?? "Collateral"} address is not configured.`,
      );
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

    const depositBalance =
      action === "depositCollateral" && collateralKey
        ? getDepositBalance(collateralKey)
        : null;

    const exceedsDepositBalance =
      action === "depositCollateral" &&
      collateralKey &&
      Boolean(
        parsedAmount &&
          depositBalance &&
          parsedAmount > (depositBalance.value ?? BigInt(0)),
      );

    const withdrawLimitAssets =
      action === "withdrawCollateral" ? collateral?.withdrawHeadroomAssets : null;

    const exceedsWithdrawLimit =
      action === "withdrawCollateral" &&
      collateralKey &&
      Boolean(
        parsedAmount &&
          withdrawLimitAssets !== null &&
          parsedAmount > withdrawLimitAssets,
      );

    if (exceedsDepositBalance) {
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
      setActiveAction({ mode: action, collateral: collateralKey });
      setIsProcessing(true);

      if (
        action === "depositCollateral" &&
        collateral &&
        collateral.vaultAddress &&
        collateral.tokenAddress
      ) {
        const selectedAsset =
          collateralKey === "weth"
            ? depositAssetSelection.weth
            : depositAssetSelection.wbtc;

        if (collateralKey === "weth" && selectedAsset === "ETH") {
          setStatusMessage("Wrapping ETH…");
          const wrapHash = await writeContractAsync({
            abi: WETH_ABI,
            address: collateral.tokenAddress,
            functionName: "deposit",
            args: [],
            value: parsedAmount,
          });

          await waitForTransactionReceipt(wagmiConfig, { hash: wrapHash });
        }

        const approvalNeeded =
          collateralKey === "weth"
            ? needsDepositApproval.weth
            : needsDepositApproval.wbtc;

        if (approvalNeeded) {
          setStatusMessage("Submitting approval…");
          const approvalHash = await writeContractAsync({
            abi: erc20Abi,
            address: collateral.tokenAddress,
            functionName: "approve",
            args: [collateral.vaultAddress, parsedAmount],
          });

          await waitForTransactionReceipt(wagmiConfig, { hash: approvalHash });
        }

        setStatusMessage("Depositing…");
        const depositHash = await writeContractAsync({
          abi: VAULT_ABI,
          address: collateral.vaultAddress,
          functionName: "deposit",
          args: [parsedAmount, address],
        });

        await waitForTransactionReceipt(wagmiConfig, { hash: depositHash });
        setStatusMessage("Deposit completed successfully.");
        setDepositAmounts((prev) => ({ ...prev, [collateral.key]: "" }));
      } else if (
        action === "withdrawCollateral" &&
        collateral &&
        collateral.vaultAddress
      ) {
        setStatusMessage("Withdrawing…");
        const withdrawHash = await writeContractAsync({
          abi: VAULT_ABI,
          address: collateral.vaultAddress,
          functionName: "withdraw",
          args: [parsedAmount, address, address],
        });

        await waitForTransactionReceipt(wagmiConfig, { hash: withdrawHash });
        setStatusMessage("Withdrawal completed successfully.");
        setWithdrawAmounts((prev) => ({ ...prev, [collateral.key]: "" }));
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

      await refetchAll();
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

    if (isProcessing && activeAction?.mode === "borrowDbusd") {
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

    if (isProcessing && activeAction?.mode === "repayDbusd") {
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

  const borrowedDisplay =
    borrowedAmount !== null
      ? `${formatDbusdAmount(borrowedAmount)} ${DBUSD_SYMBOL}`
      : "—";

  const interestRateDisplay =
    borrowAprPercent !== null ? `${borrowAprPercent.toFixed(2)}% APR` : "—";

  const debtValueUnits = borrowedAmountInUnit;

  const currentLtvPercent = useMemo(() => {
    if (
      totalCollateralValue === null ||
      totalCollateralValue === BigInt(0) ||
      debtValueUnits === null
    ) {
      return null;
    }

    const debt = Number(formatUnits(debtValueUnits, unitOfAccountDecimals));
    const collateral = Number(
      formatUnits(totalCollateralValue, unitOfAccountDecimals),
    );

    if (!Number.isFinite(debt) || !Number.isFinite(collateral) || collateral === 0) {
      return null;
    }

    return (debt / collateral) * 100;
  }, [totalCollateralValue, debtValueUnits, unitOfAccountDecimals]);

  const totalDepositValueUnit = useMemo(
    () =>
      Object.values(depositValueUnitByKey).reduce<bigint>(
        (sum, value) => (value !== null ? sum + value : sum),
        BigInt(0),
      ),
    [depositValueUnitByKey],
  );

  const totalWithdrawValueUnit = useMemo(
    () =>
      Object.values(withdrawValueUnitByKey).reduce<bigint>(
        (sum, value) => (value !== null ? sum + value : sum),
        BigInt(0),
      ),
    [withdrawValueUnitByKey],
  );

  const projectedLtvPercent = useMemo(() => {
    if (
      totalCollateralValue === null ||
      debtValueUnits === null
    ) {
      return null;
    }

    let projectedCollateral = totalCollateralValue;
    let projectedDebt = debtValueUnits;

    projectedCollateral += totalDepositValueUnit;

    projectedCollateral =
      projectedCollateral > totalWithdrawValueUnit
        ? projectedCollateral - totalWithdrawValueUnit
        : BigInt(0);

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
    totalCollateralValue,
    debtValueUnits,
    totalDepositValueUnit,
    repayValueUnit,
    unitOfAccountDecimals,
    totalWithdrawValueUnit,
  ]);

  const formatPercent = (value: number | null) =>
    value === null ? "—" : `${value.toFixed(2)}%`;

  const borrowCapacityDisplay =
    borrowHeadroom !== null
      ? `${formatDbusdAmount(borrowHeadroom)} ${DBUSD_SYMBOL}`
      : "—";

  const collateralRows: CollateralRow[] = collaterals.map((collateral) => {
    const depositAmount = depositAmounts[collateral.key];
    const withdrawAmount = withdrawAmounts[collateral.key];
    const depositParsed = getDepositParsedAmount(collateral.key);
    const withdrawParsed = getWithdrawParsedAmount(collateral.key);
    const depositBalance = getDepositBalance(collateral.key);
    const withdrawLimitAssets = collateral.withdrawHeadroomAssets;
    const depositApprovalNeeded =
      collateral.key === "weth"
        ? needsDepositApproval.weth
        : needsDepositApproval.wbtc;

    const depositButtonLabel = (() => {
      if (!isConnected) {
        return "Connect wallet";
      }

      if (!depositAmount || !depositParsed) {
        return "Enter amount";
      }

      if (
        isProcessing &&
        activeAction?.mode === "depositCollateral" &&
        activeAction.collateral === collateral.key
      ) {
        return depositApprovalNeeded ? "Approving…" : "Depositing…";
      }

      if (depositApprovalNeeded) {
        return "Approve & deposit";
      }

      return "Deposit";
    })();

    const withdrawButtonLabel = (() => {
      if (!isConnected) {
        return "Connect wallet";
      }

      if (!withdrawAmount || !withdrawParsed) {
        return "Enter amount";
      }

      if (withdrawLimitAssets === null || withdrawLimitAssets === BigInt(0)) {
        return "Nothing to withdraw";
      }

      if (
        isProcessing &&
        activeAction?.mode === "withdrawCollateral" &&
        activeAction.collateral === collateral.key
      ) {
        return "Withdrawing…";
      }

      return "Withdraw";
    })();

    const isDepositDisabled =
      !isConnected ||
      !depositParsed ||
      isProcessing ||
      !depositBalance ||
      (depositBalance.value ?? BigInt(0)) === BigInt(0) ||
      depositParsed > (depositBalance.value ?? BigInt(0));

    const isWithdrawDisabled =
      !isConnected ||
      !withdrawParsed ||
      isProcessing ||
      withdrawLimitAssets === null ||
      withdrawLimitAssets === BigInt(0) ||
      withdrawParsed > withdrawLimitAssets;

    const collateralValueNumber =
      collateral.collateralValue !== null
        ? Number(formatUnits(collateral.collateralValue, unitOfAccountDecimals))
        : null;

    const collateralAssetsNumber =
      collateral.maxWithdrawAssets !== null
        ? Number(formatUnits(collateral.maxWithdrawAssets, collateral.decimals))
        : null;

    const priceDisplay =
      collateralValueNumber !== null &&
      collateralAssetsNumber !== null &&
      collateralAssetsNumber > 0
        ? `${(collateralValueNumber / collateralAssetsNumber).toFixed(2)} ${unitOfAccountSymbol}/${collateral.symbol}`
        : "—";

    const liquidationPriceDisplay = (() => {
      if (
        collateral.liquidationLtvBasisPoints === null ||
        collateral.liquidationLtvBasisPoints === 0 ||
        borrowedAmountInUnit === null ||
        collateralAssetsNumber === null ||
        collateralAssetsNumber <= 0
      ) {
        return "—";
      }

      const debtValue = Number(
        formatUnits(borrowedAmountInUnit, unitOfAccountDecimals),
      );

      const threshold = collateral.liquidationLtvBasisPoints / 10000;

      if (!Number.isFinite(debtValue) || threshold <= 0) {
        return "—";
      }

      const price = debtValue / (collateralAssetsNumber * threshold);

      if (!Number.isFinite(price)) {
        return "—";
      }

      return `${price.toFixed(2)} ${unitOfAccountSymbol}/${collateral.symbol}`;
    })();

    const maxLtvDisplay =
      collateral.maxLtvBasisPoints !== null
        ? `${(collateral.maxLtvBasisPoints / 100).toFixed(2)}%`
        : "—";

    const liquidationLtvDisplay =
      collateral.liquidationLtvBasisPoints !== null
        ? `${(collateral.liquidationLtvBasisPoints / 100).toFixed(2)}%`
        : "—";

    const withdrawableDisplay =
      withdrawLimitAssets !== null
        ? `${formatTokenAmount(
            withdrawLimitAssets,
            collateral.decimals,
          )} ${collateral.symbol}`
        : "—";

    const depositedValueDisplay =
      collateral.collateralValue !== null
        ? `${formatTokenAmount(
            collateral.collateralValue,
            unitOfAccountDecimals,
            2,
          )} ${unitOfAccountSymbol}`
        : "—";

    const depositedAmountDisplay =
      collateral.maxWithdrawAssets !== null
        ? `${formatTokenAmount(
            collateral.maxWithdrawAssets,
            collateral.decimals,
          )} ${collateral.symbol}`
        : "—";

    return {
      key: collateral.key,
      symbol: collateral.symbol,
      depositedAmount: depositedAmountDisplay,
      depositedValue: depositedValueDisplay,
      price: priceDisplay,
      maxLtv: maxLtvDisplay,
      liquidationLtv: liquidationLtvDisplay,
      liquidationPrice: liquidationPriceDisplay,
      primaryActionLabel: "Deposit",
      primaryAction: {
        amount: depositAmount,
        onChange: (value) => handleDepositAmountChange(collateral.key, value),
        onMax: () => handleDepositMax(collateral.key),
        isMaxDisabled:
          !depositBalance || (depositBalance.value ?? BigInt(0)) === BigInt(0),
        buttonLabel: depositButtonLabel,
        isDisabled: isDepositDisabled,
        onSubmit: () => {
          void performAction("depositCollateral", collateral.key);
        },
        assetOptions: depositAssetOptions[collateral.key],
        selectedAsset: getDepositAssetLabel(collateral.key),
        onAssetChange: (value) =>
          handleDepositAssetChange(collateral.key, value as DepositAsset),
        helperText: `Wallet: ${
          depositBalance
            ? `${formatTokenAmount(
                depositBalance.value,
                depositBalance.decimals ?? collateral.decimals,
              )} ${getDepositAssetLabel(collateral.key)}`
            : "—"
        }`,
      },
      secondaryActionLabel: "Withdraw",
      secondaryAction: {
        amount: withdrawAmount,
        onChange: (value) => handleWithdrawAmountChange(collateral.key, value),
        onMax: () => handleWithdrawMax(collateral.key),
        isMaxDisabled:
          !withdrawLimitAssets || withdrawLimitAssets === BigInt(0),
        buttonLabel: withdrawButtonLabel,
        isDisabled: isWithdrawDisabled,
        onSubmit: () => {
          void performAction("withdrawCollateral", collateral.key);
        },
        helperText: `Withdrawable: ${withdrawableDisplay}`,
      },
    };
  });

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
