type EarnStatusMessageProps = {
  message: string | null;
};

export function EarnStatusMessage({ message }: EarnStatusMessageProps) {
  if (!message) {
    return null;
  }

  return (
    <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">
      {message}
    </p>
  );
}
