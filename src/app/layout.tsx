import type { Metadata } from 'next'
import './globals.css'
import 'easymde/dist/easymde.min.css'

export const metadata: Metadata = {
  title: '유어메이트 시스템',
  description: '유어메이트 사내 운영 시스템',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className="antialiased bg-gray-50 text-gray-900">{children}</body>
    </html>
  )
}
