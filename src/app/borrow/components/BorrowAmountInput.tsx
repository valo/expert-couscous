type BorrowAmountInputProps = {
  label: string;
  amount: string;
  tokenSymbol: string;
  infoLines: string[];
  errorMessage: string | null;
  isMaxDisabled: boolean;
  onChange: (value: string) => void;
  onMax: () => void;
};

export function BorrowAmountInput({
  label,
  amount,
  tokenSymbol,
  infoLines,
  errorMessage,
  isMaxDisabled,
  onChange,
  onMax,
}: BorrowAmountInputProps) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        <span>{label}</span>
        <button
          type="button"
          onClick={onMax}
          className="text-blue-600 hover:underline disabled:pointer-events-none disabled:text-neutral-400"
          disabled={isMaxDisabled}
        >
          Max
        </button>
      </div>
      <div className="flex items-center rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus-within:border-blue-500 dark:border-neutral-700 dark:bg-neutral-900">
        <input
          className="flex-1 bg-transparent text-lg outline-none"
          placeholder="0.0"
          value={amount}
          onChange={(event) => onChange(event.target.value)}
          inputMode="decimal"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <span className="ml-3 text-sm font-semibold">{tokenSymbol}</span>
      </div>
      {infoLines.map((line) => (
        <p
          key={line}
          className="mt-1 text-xs text-neutral-500 dark:text-neutral-400"
        >
          {line}
        </p>
      ))}
      {errorMessage && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
