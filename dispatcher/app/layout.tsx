import type { Metadata } from 'next'
import './globals.css'
import Providers from './providers'

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
      <head>
        <link
          rel="stylesheet"
          href="https://atlas.microsoft.com/sdk/javascript/mapcontrol/3/atlas.min.css"
        />
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script
          src="https://atlas.microsoft.com/sdk/javascript/mapcontrol/3/atlas.min.js"
          defer
        />
      </head>
      <body className="min-h-screen bg-navy text-slate-100 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
