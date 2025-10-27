import './globals.css'; 
import React from 'react';
import Navbar from './components/Navbar';
import { ClerkProvider } from '@clerk/nextjs'

export const metadata = {
  title: 'YexCode',
  description: 'Code benchmarking platform',
};

export default function RootLayout({ 
    children 
}: { 
    children: React.ReactNode 
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
            <Navbar />
            <main className="p-8">
              {children}
            </main>  
        </body>
      </html>
    </ClerkProvider>
  );
}
