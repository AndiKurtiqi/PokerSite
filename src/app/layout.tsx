import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { auth } from "@/auth";
import { Nav } from "@/components/nav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Poker Home Games",
  description: "Home game tracker for buy-ins, sessions, and leaderboards",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await auth();
  const showNav = session?.user.status === "APPROVED";

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {showNav && (
          <Nav
            displayName={session!.user.name ?? session!.user.email ?? ""}
            isAdmin={session!.user.role === "ADMIN"}
          />
        )}
        {children}
      </body>
    </html>
  );
}
