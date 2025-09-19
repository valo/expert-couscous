type TokenAmountSummaryProps = {
  label: string;
  amountDisplay: string;
  tokenSymbol: string;
  balanceFormatted?: string;
  amountDisplayTestId?: string;
  tokenSymbolTestId?: string;
};

export function TokenAmountSummary({
  label,
  amountDisplay,
  tokenSymbol,
  balanceFormatted,
  amountDisplayTestId,
  tokenSymbolTestId,
}: TokenAmountSummaryProps) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        <span>{label}</span>
      </div>
      <div className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900">
        <span
          className="text-lg font-semibold"
          data-testid={amountDisplayTestId}
        >
          {amountDisplay}
        </span>
        <span
          className="text-sm font-semibold"
          data-testid={tokenSymbolTestId}
        >
          {tokenSymbol}
        </span>
      </div>
      {balanceFormatted && (
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Balance: {balanceFormatted} {tokenSymbol}
        </p>
      )}
    </div>
  );
}
