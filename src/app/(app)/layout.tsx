import Navbar from '../components/Navbar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="p-2 bg-neutral-900">{children}</main>
    </>
  )
}
