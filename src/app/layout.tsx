import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { LanguageProvider } from '@/contexts/LanguageContext'
import GlobalNav from '@/components/GlobalNav'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Instant Messenger - Private Room Chat',
  description: 'Cross-platform instant messenger with voice and video calling',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <LanguageProvider>
          <GlobalNav />
          <div style={{ marginTop: '80px' }}>
            {children}
          </div>
        </LanguageProvider>
      </body>
    </html>
  )
}