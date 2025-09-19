"use client";

import { SwapCard } from "./components/SwapCard";
import { useSwapForm } from "./hooks/useSwapForm";

export default function SwapPage() {
  const swapForm = useSwapForm();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 py-12 sm:px-6">
      <SwapCard {...swapForm} />
    </main>
  );
}
