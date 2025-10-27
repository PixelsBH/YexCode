import Link from 'next/link';
import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from '@clerk/nextjs'

function Navbar (){
  return (
    <header className=" flex items-start p-4 shadow-md bg-gray-100">
      <Link href="/" className="text-xl font-bold">
      YexCode
      </Link>
      <Link href="/benchmark" className="text-blue-603 underline">
      Benchmark
      </Link>
      <Link href="/problems-list" className="text-blue-603 underline">
      Problems
      </Link>
      <Link href="/foryou" className="text-blue-603 underline">
      For You
      </Link>
      <SignedOut>
        <SignInButton />
        <SignUpButton>
          <button className="bg-[#6c47ff] text-white rounded-full font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 cursor-pointer">
            Sign Up
          </button>
        </SignUpButton>
      </SignedOut>
      <SignedIn>
        <UserButton />
      </SignedIn>
    </header>
  );
};

export default Navbar;