import Image from "next/image";
import Link from "next/link";
import {
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";

import "./Navbar.css";

export default function Navbar() {
  return (
    <header className="fixed inset-x-0 top-3 z-50 flex justify-center px-2">
      <div className="liquid-glass-nav w-full max-w-[1800px] rounded-full p-1">
        <div className="relative z-10 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-2 py-2 sm:gap-5 sm:px-5">
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
            className="liquid-glass-links flex w-max min-w-0 items-center justify-start gap-0.5 overflow-x-auto text-xs sm:gap-5 sm:text-base"
          >
            <Link href="/benchmark" className="liquid-glass-link">
              <span className="sm:hidden">Bench</span>
              <span className="hidden sm:inline">Benchmark</span>
            </Link>
            <Link href="/problems-list" className="liquid-glass-link">
              Problems
            </Link>
            <Link href="/foryou" className="liquid-glass-link">
              For You
            </Link>
          </nav>

          <div className="flex w-[4.5rem] shrink-0 items-center justify-end gap-1 justify-self-end sm:w-40 sm:gap-2">
            <SignedOut>
              <SignInButton>
                <button type="button" className="liquid-glass-action">
                  <span className="sm:hidden">Sign in</span>
                  <span className="hidden sm:inline">Sign In</span>
                </button>
              </SignInButton>
            </SignedOut>

            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>
        </div>
      </div>
    </header>
  );
}
