import Image from 'next/image';
import Aurora from '../components/Aurora';
  


export default function HomePage() {
  return (
    <div className="relative min-h-screen bg-black">

      {/* Background */}
      <div aria-hidden="true" className="fixed inset-0 z-0 pointer-events-none">
        <Aurora
          colorStops={["#8939eb","#260347","#4f4cf8"]}
          blend={0.8}
          amplitude={1.0}
          speed={1.2}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="mb-4">
            <Image
              src="/yexcode-wordmark.svg"
              alt="YexCode"
              width={280}
              height={80}
              priority
              className="mx-auto block h-16 w-auto sm:h-20"
            />
          </h1>
          <p className="text-white/80">Code benchmarking platform</p>
        </div>
      </div>

    </div>
  )
}
