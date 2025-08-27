import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Assessment Data Analyzer',
  description: 'Analyze student assessment data and performance by scale',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
