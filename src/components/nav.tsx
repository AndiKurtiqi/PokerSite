"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/friends", label: "Friends" },
  { href: "/games", label: "Games" },
  { href: "/chip-sets", label: "Chip Sets" },
  { href: "/leaderboard", label: "Leaderboard" },
];

const ADMIN_LINKS = [
  { href: "/admin/requests", label: "Requests" },
  { href: "/admin/guests", label: "Merge Guests" },
  { href: "/admin/users", label: "Accounts" },
];

export function Nav({
  displayName,
  isAdmin,
  pendingRequests = 0,
}: {
  displayName: string;
  isAdmin: boolean;
  pendingRequests?: number;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const badge = (href: string) =>
    href === "/admin/requests" && pendingRequests > 0 ? (
      <span className="ml-1.5 rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-foreground">
        {pendingRequests}
      </span>
    ) : null;

  const linkClass = (href: string) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
      isActive(href)
        ? "bg-white/10 text-foreground"
        : "text-muted hover:bg-white/5 hover:text-foreground"
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-black/40 bg-surface shadow-lg shadow-black/30 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-lg leading-none text-accent-foreground"
            >
              ♠
            </span>
            <span className="font-semibold tracking-tight">Poker Home Games</span>
          </Link>
          <div className="hidden items-center gap-1 lg:flex">
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href} className={linkClass(link.href)}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <Link
            href="/settings"
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted transition-colors hover:bg-white/5 hover:text-foreground"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-foreground">
              {displayName.trim().charAt(0).toUpperCase()}
            </span>
            {displayName}
          </Link>
          <button
            onClick={() => signOut({ redirectTo: "/login" })}
            className="btn-secondary px-3 py-1.5 text-sm"
          >
            Log out
          </button>
        </div>

        <button
          type="button"
          aria-label="Menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
          className="btn-secondary h-9 w-9 lg:hidden"
        >
          <span aria-hidden className="text-lg leading-none">
            {menuOpen ? "✕" : "☰"}
          </span>
        </button>
      </nav>

      {isAdmin && (
        <div className="hidden border-t border-line bg-black/30 lg:block">
          <div className="mx-auto flex max-w-6xl items-center gap-1 px-4 py-1 sm:px-6">
            <span className="section-label mr-2">Admin</span>
            {ADMIN_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className={linkClass(link.href)}>
                {link.label}
                {badge(link.href)}
              </Link>
            ))}
          </div>
        </div>
      )}

      {menuOpen && (
        <div className="border-t border-line-strong bg-[#06120c] shadow-2xl shadow-black/60 lg:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={linkClass(link.href)}
              >
                {link.label}
              </Link>
            ))}
            {isAdmin && (
              <>
                <p className="section-label px-3 pt-3">Admin</p>
                {ADMIN_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className={linkClass(link.href)}
                  >
                    {link.label}
                    {badge(link.href)}
                  </Link>
                ))}
              </>
            )}
            <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
              <Link
                href="/settings"
                onClick={() => setMenuOpen(false)}
                className="text-sm text-muted hover:text-foreground"
              >
                {displayName}
              </Link>
              <button
                onClick={() => signOut({ redirectTo: "/login" })}
                className="btn-secondary px-3 py-1.5 text-sm"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
