import Link from "next/link";
import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";

function Navbar({ transparent = false }: { transparent?: boolean }) {
  return (
    <header className="w-full flex justify-center pt-2">
      {/* Pill container */}
      <div className={`
          group relative
          flex items-center justify-between gap-8 
          w-[98vw] max-w-[1800px]
          px-6 sm:px-10 
          py-3
          rounded-full
          backdrop-blur-xl
          border border-white/15
          shadow-lg
          ${transparent? "bg-white/10": "bg-white/10"}`}>
        <Link href="/" className="text-white text-lg font-semibold">
          YexCode
        </Link>

        <nav className="flex items-center gap-4 text-sm">
          <Link href="/benchmark" className="text-white/80 hover:text-white">
            Benchmark
          </Link>
          <Link href="/problems-list" className="text-white/80 hover:text-white">
            Problems
          </Link>
          <Link href="/foryou" className="text-white/80 hover:text-white">
            For You
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <SignedOut>
            <SignInButton>
              <button className="px-4 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-sm backdrop-blur-md">
                Sign In
              </button>
            </SignInButton>
            <SignUpButton>
              <button className="px-4 py-1.5 rounded-full bg-[#6c47ff] hover:opacity-90 text-white text-sm">
                Sign Up
              </button>
            </SignUpButton>
          </SignedOut>

          <SignedIn>
            <UserButton />
          </SignedIn>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
