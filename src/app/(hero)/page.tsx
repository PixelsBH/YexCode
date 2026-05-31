import Dither from '../components/Dither'

export default function HomePage() {
  return (
    <div className="relative min-h-screen bg-black">

      {/* Background */}
      <div className="fixed inset-0 z-0">
        <Dither
          waveColor={[1.0, 0.6, 1.0]}
          disableAnimation={false}
          enableMouseInteraction={false}
          mouseRadius={0}
          colorNum={3}
          waveAmplitude={0.15}
          waveFrequency={2.5}
          waveSpeed={0.04}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-white mb-4">YexCode</h1>
          <p className="text-white/80">Code benchmarking platform</p>
        </div>
      </div>

    </div>
  )
}
