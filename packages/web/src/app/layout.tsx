import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import Background from "@/components/background"

const inter = Inter({ subsets: ["latin"] })

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
        <body className={inter.className}>
          {children}
        </body>
      </html>
  )
}
