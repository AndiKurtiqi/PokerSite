import type { ReactNode } from "react";

/** Centered brand + card used by the logged-out pages (login, signup, pending). */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <span
          aria-hidden
          className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-2xl leading-none text-accent-foreground shadow-lg shadow-accent/20"
        >
          ♠
        </span>
        <p className="text-sm font-medium uppercase tracking-widest text-muted">Poker Home Games</p>
      </div>
      <div className="card flex flex-col gap-5 p-6 shadow-xl shadow-black/30 sm:p-8">
        <div className="flex flex-col gap-1.5">
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
        {children}
      </div>
      {footer && <p className="text-center text-sm text-muted">{footer}</p>}
    </main>
  );
}
