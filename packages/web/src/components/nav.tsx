"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tornado } from "lucide-react";
import { useState } from "react";
import SubscribeButton from "./subscribeButton";

export default function Nav() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: "/", label: "Status" },
    { href: "/events", label: "Events" },
    { href: "/monitors", label: "Monitors" },
  ];

  return (
    <div className="flex justify-center w-full py-4 sticky top-0">
      <div className="flex items-center justify-between px-6 py-2 rounded-full border border-gray-200 max-w-screen-md w-full backdrop-blur-sm bg-background/10 z-10">
        {/* Logo */}
        <Link href="/" className="flex items-center">
          <Tornado className="h-8 w-8 text-black" />
        </Link>

        {/* Desktop navigation - centered */}
        <nav className="hidden md:flex items-center justify-center gap-8">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm ${
                  isActive ? "font-medium text-black" : "text-gray-600"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Mobile navigation toggle and Subscribe button */}
        <div className="md:hidden flex items-center gap-2">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="text-gray-600"
          >
            {navLinks.find((link) => link.href === pathname)?.label || "Menu"}
          </button>
        </div>

        {/* Subscribe button */}
        <SubscribeButton />
      </div>

      {/* Mobile menu dropdown */}
      {isMobileMenuOpen && (
        <div className="absolute top-16 left-0 right-0 z-50 bg-white border-t border-gray-200 md:hidden">
          <div className="flex flex-col items-center py-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`py-2 text-sm ${
                  pathname === link.href
                    ? "font-medium text-black"
                    : "text-gray-600"
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
