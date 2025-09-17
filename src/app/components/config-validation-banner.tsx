import { CONTRACT_CONFIG_VALIDATION } from "@/lib/configValidation";

export function ConfigValidationBanner() {
  const { hasError, missing, invalid } = CONTRACT_CONFIG_VALIDATION;

  if (!hasError) {
    return null;
  }

  return (
    <div className="border-b border-amber-300 bg-amber-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/60 dark:bg-amber-500/10 dark:text-amber-100">
        <p className="font-medium">Missing contract configuration.</p>
        {missing.length > 0 && (
          <p>
            Define {missing.join(", ")} in your environment and restart the dev server.
          </p>
        )}
        {invalid.length > 0 && (
          <p>Check that {invalid.join(", ")} contain valid 0x addresses.</p>
        )}
      </div>
    </div>
  );
}
