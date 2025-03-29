"use client";

import { cn } from "@/lib/utils";
import { DotPattern } from "@/components/ui/dot-pattern";
import { useState, useEffect } from "react";

export default function Background() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return (  
    <div className="fixed top-0 left-0 w-full h-full">
      <DotPattern
        className={cn(
          "opacity-40",
          `[mask-image:radial-gradient(100px_at_${mousePosition.x}px_${mousePosition.y}px,white,transparent)]`,
        )}
      />
    </div>
  );
}
