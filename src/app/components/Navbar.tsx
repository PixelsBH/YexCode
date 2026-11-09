"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";

import "./Navbar.css";

export default function Navbar() {
  const pathname = usePathname();
  const isActive = (href: string) => href === "/workspace"
    ? pathname === href || pathname === "/benchmark"
    : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-0 sm:px-4 sm:pt-3">
      <div className="liquid-glass-nav w-full max-w-[1800px] sm:rounded-2xl">
        <div className="relative z-10 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 sm:gap-5 sm:px-5 sm:py-3">
          <Link
            href="/"
            className="justify-self-start whitespace-nowrap"
          >
            <Image
              src="/yexcode-wordmark.svg"
              alt="YexCode"
              width={224}
              height={64}
              priority
              className="h-6 w-auto sm:h-8"
            />
          </Link>

          <nav
            aria-label="Main navigation"
            className="liquid-glass-links flex min-w-0 items-center justify-center gap-0.5 overflow-x-auto text-xs sm:gap-2 sm:text-sm"
          >
            <Link href="/workspace" aria-current={isActive("/workspace") ? "page" : undefined} className={`liquid-glass-link ${isActive("/workspace") ? "is-active" : ""}`}>
              Workspace
            </Link>
            <Link href="/problems-list" aria-current={isActive("/problems-list") ? "page" : undefined} className={`liquid-glass-link ${isActive("/problems-list") ? "is-active" : ""}`}>
              Problems
            </Link>
            <Link href="/playlists" aria-current={isActive("/playlists") ? "page" : undefined} className={`liquid-glass-link ${isActive("/playlists") ? "is-active" : ""}`}>
              Playlists
            </Link>
          </nav>

          <div className="flex shrink-0 items-center justify-end gap-1 justify-self-end sm:gap-2">
            <SignedOut>
              <SignInButton>
                <button type="button" className="liquid-glass-action">
                  <span className="sm:hidden">Sign in</span>
                  <span className="hidden sm:inline">Sign In</span>
                </button>
              </SignInButton>
            </SignedOut>

            <SignedIn>
              <Link href="/profile" aria-current={isActive("/profile") ? "page" : undefined} className={`liquid-glass-link hidden sm:inline-flex ${isActive("/profile") ? "is-active" : ""}`}>Profile</Link>
              <UserButton />
            </SignedIn>
          </div>
        </div>
      </div>
    </header>
  );
}
