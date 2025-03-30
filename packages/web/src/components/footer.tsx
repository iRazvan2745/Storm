"use client";

import Link from "next/link";
import { Tornado } from "lucide-react";

export default function Footer() {
  return (
    <footer className="my-4">
      <div className="flex flex-row items-center justify-center">
        <span className="text-sm text-gray-500">Powered by <Link href="https://github.com/iRazvan2745/Storm" target="_blank" rel="noopener noreferrer" className="inline-flex items-center"><Tornado className="inline h-4 w-4 mx-1" /> Storm</Link></span>
      </div>
    </footer>
  );
} 