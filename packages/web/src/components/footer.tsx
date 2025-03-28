"use client";

import { Tornado } from "lucide-react";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t py-6 bg-white">
      <div className="max-w-[1200px] mx-auto px-6 flex flex-col md:flex-row justify-between items-center">
        <div className="flex items-center mb-4 md:mb-0">
          <div className="rounded-md flex items-center justify-center mr-2">
            <Tornado className="h-6 w-6" />
          </div>
          <span className="text-sm font-medium text-gray-700">Storm {new Date().getFullYear()}</span>
        </div>
        <div className="flex items-center space-x-6">
          <Link href="#" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Terms</Link>
          <Link href="#" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Privacy</Link>
          <Link href="#" className="text-sm text-blue-600 hover:text-blue-800 transition-colors">Contact Support</Link>
        </div>
      </div>
    </footer>
  );
} 