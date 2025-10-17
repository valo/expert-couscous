type BorrowAmountInputProps = {
  label: string;
  amount: string;
  tokenSymbol: string;
  infoLines: string[];
  errorMessage: string | null;
  isMaxDisabled: boolean;
  onChange: (value: string) => void;
  onMax: () => void;
  assetOptions?: Array<{ value: string; label: string }>;
  selectedAsset?: string;
  onAssetChange?: (value: string) => void;
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
  assetOptions,
  selectedAsset,
  onAssetChange,
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
        {assetOptions && onAssetChange ? (
          <div className="relative ml-3">
            <select
              value={selectedAsset}
              onChange={(event) => onAssetChange(event.target.value)}
              className="appearance-none rounded-xl bg-neutral-200 px-3 py-1 pr-8 text-sm font-semibold text-neutral-900 outline-none transition hover:bg-neutral-300 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
            >
              {assetOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-600 dark:text-neutral-300">
              ▾
            </span>
          </div>
        ) : (
          <span className="ml-3 text-sm font-semibold">{tokenSymbol}</span>
        )}
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
