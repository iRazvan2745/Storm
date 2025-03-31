import type React from "react"
import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Storm - System Status",
  description: "Monitor the uptime and performance of your systems",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
      <html lang="en">
        <body>
          {children}
        </body>
      </html>
  )
}
