type SwapStatusMessageProps = {
  message: string | null;
};

export function SwapStatusMessage({ message }: SwapStatusMessageProps) {
  if (!message) {
    return null;
  }

  return (
    <p
      className="mt-3 text-sm text-neutral-600 dark:text-neutral-300"
      data-testid="status-message"
    >
      {message}
    </p>
  );
}
