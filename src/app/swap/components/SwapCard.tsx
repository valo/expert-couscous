import { SwapFormState } from "../hooks/useSwapForm";
import { FaucetLinks } from "./FaucetLinks";
import { SwapHeader } from "./SwapHeader";
import { SwapStatusMessage } from "./SwapStatusMessage";
import { TokenAmountInput } from "./TokenAmountInput";
import { TokenAmountSummary } from "./TokenAmountSummary";

type SwapCardProps = SwapFormState;

export function SwapCard({
  amount,
  buttonLabel,
  directionLabel,
  from,
  to,
  isSwapDisabled,
  statusMessage,
  handlers,
}: SwapCardProps) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-black">
      <SwapHeader />

      <div className="space-y-4">
        <TokenAmountInput
          label="From"
          amount={amount}
          onChange={handlers.onAmountChange}
          onMax={handlers.onMax}
          tokenSymbol={from.symbol}
          balanceFormatted={from.balanceFormatted}
          amountInputTestId="amount-input"
          tokenSymbolTestId="from-token-symbol"
        />

        <button
          type="button"
          onClick={handlers.onToggleDirection}
          className="flex w-full items-center justify-center rounded-full border border-neutral-200 bg-neutral-100 py-2 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
          data-testid="direction-toggle"
        >
          {directionLabel}
        </button>

        <TokenAmountSummary
          label="To"
          amountDisplay={to.amountDisplay}
          tokenSymbol={to.symbol}
          balanceFormatted={to.balanceFormatted}
          amountDisplayTestId="to-amount-display"
          tokenSymbolTestId="to-token-symbol"
        />
      </div>

      <button
        type="button"
        onClick={() => handlers.onSwap()}
        disabled={isSwapDisabled}
        className="mt-6 w-full rounded-xl bg-blue-600 py-3 text-center text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500"
        data-testid="swap-submit-button"
      >
        {buttonLabel}
      </button>

      <SwapStatusMessage message={statusMessage} />

      <FaucetLinks />
    </section>
  );
}
