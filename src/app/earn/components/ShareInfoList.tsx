import type { ShareCard } from "../hooks/useEarnForm";

type ShareInfoListProps = {
  items: ShareCard[];
};

export function ShareInfoList({ items }: ShareInfoListProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        >
          <p className="text-neutral-600 dark:text-neutral-300">
            {item.label}:{" "}
            <span className="font-semibold">{item.value}</span>
          </p>
        </div>
      ))}
    </div>
  );
}
