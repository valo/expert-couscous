import type { Mode } from "../constants";

export type ModeOption = {
  value: Mode;
  label: string;
  isActive: boolean;
};

type ModeToggleProps = {
  options: ModeOption[];
  onSelect: (mode: Mode) => void;
};

export function ModeToggle({ options, onSelect }: ModeToggleProps) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-2 text-sm font-semibold">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onSelect(option.value)}
          className={`rounded-xl border px-4 py-2 transition ${
            option.isActive
              ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-100"
              : "border-neutral-200 text-neutral-600 hover:border-neutral-300 hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-neutral-600 dark:hover:text-white"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
