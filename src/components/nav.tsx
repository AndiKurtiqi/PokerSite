"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/friends", label: "Friends" },
  { href: "/games", label: "Games" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export function Nav({
  displayName,
  isAdmin,
}: {
  displayName: string;
  isAdmin: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex items-center justify-between border-b border-black/10 px-6 py-3 dark:border-white/10">
      <div className="flex items-center gap-6">
        <span className="font-semibold">Poker Home Games</span>
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={
              pathname.startsWith(link.href)
                ? "text-sm font-medium underline"
                : "text-sm font-medium text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white"
            }
          >
            {link.label}
          </Link>
        ))}
        {isAdmin && (
          <Link
            href="/admin/requests"
            className={
              pathname.startsWith("/admin")
                ? "text-sm font-medium underline"
                : "text-sm font-medium text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white"
            }
          >
            Admin
          </Link>
        )}
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-black/60 dark:text-white/60">
          {displayName}
        </span>
        <button
          onClick={() => signOut({ redirectTo: "/login" })}
          className="text-sm underline"
        >
          Log out
        </button>
      </div>
    </nav>
  );
}
