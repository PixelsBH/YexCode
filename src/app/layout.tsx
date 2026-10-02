import './globals.css'
import { ClerkProvider } from '@clerk/nextjs'
import Navbar from './components/Navbar'

export const metadata = {
  title: 'YexCode',
  description: 'Code benchmarking platform',
  icons: {
    icon: '/favicon.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="site-background text-white">
          <Navbar />
          <div className="relative z-0">{children}</div>
        </body>
      </html>
    </ClerkProvider>
  )
}

