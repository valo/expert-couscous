type TokenAmountInputProps = {
  label: string;
  amount: string;
  onChange: (value: string) => void;
  onMax: () => void;
  tokenSymbol: string;
  balanceFormatted?: string;
  amountInputTestId?: string;
  tokenSymbolTestId?: string;
};

export function TokenAmountInput({
  label,
  amount,
  onChange,
  onMax,
  tokenSymbol,
  balanceFormatted,
  amountInputTestId,
  tokenSymbolTestId,
}: TokenAmountInputProps) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        <span>{label}</span>
        <button
          type="button"
          onClick={onMax}
          className="text-blue-600 hover:underline"
        >
          Max
        </button>
      </div>
      <div className="flex items-center rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus-within:border-blue-500 dark:border-neutral-700 dark:bg-neutral-900">
        <input
          className="flex-1 bg-transparent text-lg outline-none"
          data-testid={amountInputTestId}
          placeholder="0.0"
          value={amount}
          onChange={(event) => onChange(event.target.value)}
          inputMode="decimal"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <span
          className="ml-3 text-sm font-semibold"
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
