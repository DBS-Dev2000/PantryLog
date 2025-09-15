import { Inter } from 'next/font/google'
import { ThemeProvider } from '@/components/ThemeProvider'
import { StoreProvider } from '@/store/StoreProvider'
import { HouseholdProvider } from '@/contexts/HouseholdContext'
import AppLayout from '@/components/AppLayout'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'PantryIQ - Smart Inventory Management',
  description: 'Intelligent inventory management with AI-powered recognition, barcode scanning, and smart tracking.',
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