"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Tornado } from "lucide-react"
import { motion } from "framer-motion"

export default function Nav() {
  const pathname = usePathname()

  const navLinks = [
    { href: "/", label: "Status" },
    { href: "/events", label: "Events" },
    { href: "/monitors", label: "Monitors" },
  ]

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-[1200px] mx-auto px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Logo and brand */}
          <Link href="/" className="flex items-center space-x-2">
            <motion.div 
              className="rounded-full bg-blue-50 p-1.5"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <Tornado className="h-5 w-5 text-black" />
            </motion.div>
            <span className="text-base font-medium text-black">Storm</span>
          </Link>

          {/* Main navigation */}
          <nav>
            <ul className="flex space-x-6">
              {navLinks.map((link) => {
                const isActive = pathname === link.href
                return (
                  <li key={link.href}>
                    <Link href={link.href} className="relative px-1 py-3 block">
                      <span
                        className={`text-sm font-medium ${
                          isActive ? "text-black" : "text-gray-600 hover:text-gray-900"
                        }`}
                      >
                        {link.label}
                      </span>
                      {isActive && (
                        <motion.div
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-black"
                          layoutId="activeIndicator"
                          transition={{ duration: 0.2 }}
                        />
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
        </div>
      </div>
    </header>
  )
}
