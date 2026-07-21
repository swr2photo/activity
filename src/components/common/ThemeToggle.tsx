"use client";

import React, { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Variant = "icon" | "menu" | "segmented";

interface ThemeToggleProps {
  variant?: Variant;
  className?: string;
  /** @deprecated kept for call-site compatibility — always uses shadcn */
  appearance?: "mui" | "plain";
}

const OPTIONS = [
  { value: "light", label: "สว่าง", icon: Sun },
  { value: "dark", label: "มืด", icon: Moon },
  { value: "system", label: "ตามระบบ", icon: Monitor },
] as const;

export default function ThemeToggle({
  variant = "icon",
  className,
}: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="สลับธีม"
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground",
          className
        )}
        disabled
      >
        <Sun className="h-4 w-4 opacity-40 dark:hidden" />
        <Moon className="h-4 w-4 opacity-40 hidden dark:block" />
      </button>
    );
  }

  const CurrentIcon = resolvedTheme === "dark" ? Moon : Sun;

  if (variant === "segmented") {
    return (
      <div
        className={cn(
          "inline-flex rounded-lg border border-border bg-muted/40 p-0.5",
          className
        )}
        role="group"
        aria-label="เลือกธีม"
      >
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              theme === value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="สลับธีม"
          aria-label="สลับธีม"
          className={cn("h-9 w-9 text-muted-foreground", className)}
        >
          <CurrentIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => setTheme(value)}
            className={cn(theme === value && "bg-accent")}
          >
            <Icon className="h-4 w-4" />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
