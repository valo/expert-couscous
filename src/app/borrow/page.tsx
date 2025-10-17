"use client";

import { BorrowCard } from "./components/BorrowCard";
import { useBorrowForm } from "./hooks/useBorrowForm";

export default function BorrowPage() {
  const borrowForm = useBorrowForm();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 py-12 sm:px-6">
      <BorrowCard {...borrowForm} />
    </main>
  );
}
