"use client";

import { EarnCard } from "./components/EarnCard";
import { useEarnForm } from "./hooks/useEarnForm";

export default function EarnPage() {
  const earnForm = useEarnForm();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 py-12 sm:px-6">
      <EarnCard {...earnForm} />
    </main>
  );
}
