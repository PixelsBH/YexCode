import './globals.css'
import { ClerkProvider } from '@clerk/nextjs'

export const metadata = {
  title: 'YexCode',
  description: 'Code benchmarking platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="bg-neutral-900">{children}</body>
      </html>
    </ClerkProvider>
  )
}

