import type { EarnFormState } from "../hooks/useEarnForm";
import { ApySummary } from "./ApySummary";
import { EarnAmountInput } from "./EarnAmountInput";
import { EarnHeader } from "./EarnHeader";
import { EarnStatusMessage } from "./EarnStatusMessage";
import { ModeToggle } from "./ModeToggle";
import { ShareInfoList } from "./ShareInfoList";

type EarnCardProps = EarnFormState;

export function EarnCard({
  modeOptions,
  apyDisplay,
  buttonLabel,
  statusMessage,
  isActionDisabled,
  amountField,
  shareCards,
  handlers,
}: EarnCardProps) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-black">
      <EarnHeader />

      <ApySummary apyDisplay={apyDisplay} />

      <ModeToggle options={modeOptions} onSelect={handlers.onModeChange} />

      <div className="space-y-4">
        <EarnAmountInput
          label={amountField.label}
          amount={amountField.amount}
          tokenSymbol={amountField.tokenSymbol}
          infoLines={amountField.infoLines}
          errorMessage={amountField.errorMessage}
          isMaxDisabled={amountField.isMaxDisabled}
          onChange={handlers.onAmountChange}
          onMax={handlers.onMax}
        />

        <ShareInfoList items={shareCards} />
      </div>

      <button
        type="button"
        onClick={() => handlers.onSubmit()}
        disabled={isActionDisabled}
        className="mt-6 w-full rounded-xl bg-blue-600 py-3 text-center text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500"
      >
        {buttonLabel}
      </button>

      <EarnStatusMessage message={statusMessage} />
    </section>
  );
}
