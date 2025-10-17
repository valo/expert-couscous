import type { BorrowFormState } from "../hooks/useBorrowForm";
import { BorrowAmountInput } from "./BorrowAmountInput";
import { BorrowHeader } from "./BorrowHeader";
import { BorrowStatusMessage } from "./BorrowStatusMessage";
import { ModeToggle } from "./ModeToggle";

type BorrowCardProps = BorrowFormState;

export function BorrowCard({
  modeOptions,
  buttonLabel,
  statusMessage,
  isActionDisabled,
  amountField,
  summaryItems,
  handlers,
}: BorrowCardProps) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-black">
      <BorrowHeader />

      <ModeToggle options={modeOptions} onSelect={handlers.onModeChange} />

      <BorrowAmountInput
        label={amountField.label}
        amount={amountField.amount}
        tokenSymbol={amountField.tokenSymbol}
        infoLines={amountField.infoLines}
        errorMessage={amountField.errorMessage}
        isMaxDisabled={amountField.isMaxDisabled}
        onChange={handlers.onAmountChange}
        onMax={handlers.onMax}
        assetOptions={amountField.assetOptions}
        selectedAsset={amountField.selectedAsset}
        onAssetChange={
          handlers.onDepositAssetChange
            ? (value) => handlers.onDepositAssetChange?.(value as "ETH" | "WETH")
            : undefined
        }
      />

      {summaryItems.length > 0 && (
        <dl className="mt-6 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          {summaryItems.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900"
            >
              <dt className="text-xs uppercase text-neutral-500 dark:text-neutral-400">
                {item.label}
              </dt>
              <dd className="mt-1 text-base font-semibold text-neutral-900 dark:text-white">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <button
        type="button"
        onClick={() => handlers.onSubmit()}
        disabled={isActionDisabled}
        className="mt-6 w-full rounded-xl bg-blue-600 py-3 text-center text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500"
      >
        {buttonLabel}
      </button>

      <BorrowStatusMessage message={statusMessage} />
    </section>
  );
}
