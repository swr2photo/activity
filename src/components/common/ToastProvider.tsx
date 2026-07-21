"use client";

import { Toaster } from "sonner";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <>
      {children}
      {mounted && (
        <Toaster
          theme={resolvedTheme === "dark" ? "dark" : "light"}
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            classNames: {
              toast:
                "border border-border bg-background text-foreground shadow-lg",
            },
          }}
        />
      )}
    </>
  );
}
