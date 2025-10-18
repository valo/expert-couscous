"use client";

import { useState } from "react";

import { BorrowHeader } from "./BorrowHeader";
import { BorrowStatusMessage } from "./BorrowStatusMessage";
import type {
  ActionFormControls,
  CollateralRow,
  LoanSummary,
} from "../hooks/useBorrowForm";

function FormField({
  form,
  placeholder,
  actionLabel,
}: {
  form: ActionFormControls;
  placeholder: string;
  actionLabel: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex w-full flex-1 items-center rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 focus-within:border-blue-500 dark:border-neutral-700 dark:bg-neutral-900">
          <input
            className="flex-1 bg-transparent text-sm outline-none"
            value={form.amount}
            onChange={(event) => form.onChange(event.target.value)}
            placeholder={placeholder}
            inputMode="decimal"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {form.assetOptions && form.onAssetChange ? (
            <div className="relative ml-2">
              <select
                value={form.selectedAsset}
                onChange={(event) => form.onAssetChange?.(event.target.value)}
                className="appearance-none rounded-lg bg-neutral-200 px-3 py-1 pr-6 text-xs font-semibold text-neutral-900 outline-none transition hover:bg-neutral-300 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
              >
                {form.assetOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-neutral-600 dark:text-neutral-400">
                ▾
              </span>
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={form.onMax}
            disabled={form.isMaxDisabled}
            className="rounded-lg border border-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:text-neutral-400 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Max
          </button>
          <button
            type="button"
            onClick={form.onSubmit}
            disabled={form.isDisabled}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500"
          >
            {actionLabel}
          </button>
        </div>
      </div>
      {form.helperText ? (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {form.helperText}
        </p>
      ) : null}
    </div>
  );
}

function ActionButton({
  form,
  placeholder,
}: {
  form: ActionFormControls;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <input
          className="w-full flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-900"
          value={form.amount}
          onChange={(event) => form.onChange(event.target.value)}
          placeholder={placeholder}
          inputMode="decimal"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={form.onMax}
            disabled={form.isMaxDisabled}
            className="rounded-lg border border-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:text-neutral-400 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Max
          </button>
          <button
            type="button"
            onClick={form.onSubmit}
            disabled={form.isDisabled}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500"
          >
            {form.buttonLabel}
          </button>
        </div>
      </div>
      {form.helperText ? (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {form.helperText}
        </p>
      ) : null}
    </div>
  );
}

function CollateralRowCard({ row }: { row: CollateralRow }) {
  const [activeAction, setActiveAction] = useState<"primary" | "secondary">(
    "primary",
  );

  const isPrimary = activeAction === "primary";
  const action = isPrimary ? row.primaryAction : row.secondaryAction;
  const actionLabel = isPrimary
    ? row.primaryActionLabel
    : row.secondaryActionLabel;
  const placeholder = `Amount to ${actionLabel.toLowerCase()}`;

  return (
    <div className="grid grid-cols-1 gap-4 px-4 py-4 sm:grid-cols-12 sm:items-center sm:gap-5 sm:px-5">
      <div className="sm:col-span-2">
        <p className="text-sm font-semibold text-neutral-900 dark:text-white">
          {row.symbol}
        </p>
      </div>
      <div className="flex flex-col gap-1 text-sm text-neutral-600 dark:text-neutral-300 sm:col-span-2">
        <span>{row.depositedAmount}</span>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          {row.depositedValue}
        </span>
      </div>
      <div className="sm:col-span-2">
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          {row.price}
        </p>
      </div>
      <div className="sm:col-span-2 space-y-1">
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          {row.maxLtv}
        </p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Liquidation: {row.liquidationLtv}
        </p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Liquidation price: {row.liquidationPrice}
        </p>
      </div>
      <div className="space-y-4 sm:col-span-4">
        <div className="flex w-full rounded-full border border-neutral-200 bg-neutral-100 p-1 text-xs font-semibold text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
          <button
            type="button"
            onClick={() => setActiveAction("primary")}
            className={`flex-1 rounded-full px-3 py-1 transition ${
              isPrimary
                ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-white"
                : "hover:text-neutral-900 dark:hover:text-white"
            }`}
          >
            {row.primaryActionLabel}
          </button>
          <button
            type="button"
            onClick={() => setActiveAction("secondary")}
            className={`flex-1 rounded-full px-3 py-1 transition ${
              !isPrimary
                ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-white"
                : "hover:text-neutral-900 dark:hover:text-white"
            }`}
          >
            {row.secondaryActionLabel}
          </button>
        </div>

        <FormField
          form={action}
          placeholder={placeholder}
          actionLabel={action.buttonLabel || actionLabel}
        />
      </div>
    </div>
  );
}

function CollateralTable({ rows }: { rows: CollateralRow[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
      <div className="hidden bg-neutral-100 text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300 sm:grid sm:grid-cols-12 sm:gap-4 sm:px-5 sm:py-3">
        <span className="col-span-2">Collateral</span>
        <span className="col-span-2">Deposited</span>
        <span className="col-span-2">Value</span>
        <span className="col-span-2">Price</span>
        <span className="col-span-2">LTV / Liquidation</span>
        <span className="col-span-2">Action</span>
      </div>
      <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
        {rows.map((row) => (
          <CollateralRowCard key={row.key} row={row} />
        ))}
      </div>
    </div>
  );
}

function LoanSummaryPanel({ summary }: { summary: LoanSummary }) {
  return (
    <div className="mt-8 space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {summary.stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
          >
            <p className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              {stat.label}
            </p>
            <p className="mt-2 text-base font-semibold text-neutral-900 dark:text-white">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          <h3 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-white">
            Borrow dbUSD
          </h3>
          <ActionButton
            form={summary.borrow}
            placeholder="Amount to borrow"
          />
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          <h3 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-white">
            Repay dbUSD
          </h3>
          <ActionButton
            form={summary.repay}
            placeholder="Amount to repay"
          />
        </div>
      </div>
    </div>
  );
}

export type BorrowCardProps = {
  collateralRows: CollateralRow[];
  loanSummary: LoanSummary;
  statusMessage: string | null;
};

export function BorrowCard({ collateralRows, loanSummary, statusMessage }: BorrowCardProps) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-black">
      <BorrowHeader />

      <CollateralTable rows={collateralRows} />

      <LoanSummaryPanel summary={loanSummary} />

      <BorrowStatusMessage message={statusMessage} />
    </section>
  );
}
