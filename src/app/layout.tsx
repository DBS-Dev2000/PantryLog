import { Inter } from 'next/font/google'
import { ThemeProvider } from '@/components/ThemeProvider'
import { StoreProvider } from '@/store/StoreProvider'
import AppLayout from '@/components/AppLayout'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'BITE - Basic Inventory Tracking Engine',
  description: 'Take a BITE out of waste. Smart inventory management for your pantry and freezer.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <StoreProvider>
          <ThemeProvider>
            <AppLayout>
              {children}
            </AppLayout>
          </ThemeProvider>
        </StoreProvider>
      </body>
    </html>
  )
}