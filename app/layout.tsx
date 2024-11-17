import { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from "@/components/theme-provider"
import { SpeedInsights } from '@vercel/speed-insights/next';

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Trackit',
  description: 'Manage your financial transactions with ease',
  icons: {
    icon: '/favicon.ico',  // Path to your favicon
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head />
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <SpeedInsights />
        </ThemeProvider>
      </body>
    </html>
  )
}
