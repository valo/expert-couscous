type ApySummaryProps = {
  apyDisplay: string;
};

export function ApySummary({ apyDisplay }: ApySummaryProps) {
  return (
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
  );
}
