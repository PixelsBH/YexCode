import Navbar from '../components/Navbar'

export default function HeroLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Navbar overlay */}
      <div className="fixed top-0 left-0 right-0 z-20">
        <Navbar transparent />
      </div>

      {children}
    </div>
  )
}
