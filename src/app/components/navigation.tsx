"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectBtn } from "./connectButton";

const NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/swap", label: "Swap" },
] as const;

export function Navigation() {
  const pathname = usePathname();

  return (
    <header className="border-b border-neutral-200 bg-white/80 backdrop-blur-md dark:border-neutral-800 dark:bg-black/60">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-4 py-4 sm:px-6">
        <nav className="flex items-center gap-4 text-sm font-medium">
          {NAV_LINKS.map(({ href, label }) => {
            const isActive = href === "/"
              ? pathname === href
              : pathname?.startsWith(href);

            return (
              <Link
                key={href}
                href={href}
                className={
                  "rounded-lg px-3 py-2 transition hover:bg-neutral-100 dark:hover:bg-neutral-800" +
                  (isActive
                    ? " bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-white"
                    : " text-neutral-600 dark:text-neutral-300")
                }
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <ConnectBtn />
      </div>
    </header>
  );
}
