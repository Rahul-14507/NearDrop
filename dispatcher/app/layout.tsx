import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'NearDrop Dispatcher',
  description: 'NearDrop dispatcher portal — manage drivers and deliveries',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-navy text-slate-100 antialiased">
        {children}
      </body>
    </html>
  )
}
