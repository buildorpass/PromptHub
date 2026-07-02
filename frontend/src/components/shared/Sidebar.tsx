"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FolderOpen,
  FileText,
  GitCompare,
  FlaskConical,
  Layers,
  CircleDollarSign,
  BarChart3,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/library", label: "Library", icon: FolderOpen },
  { href: "/editor/new", label: "Prompt Editor", icon: FileText },
  { href: "/comparison", label: "Comparison", icon: GitCompare },
  { href: "/test-cases", label: "Test Cases", icon: FlaskConical },
  { href: "/assets", label: "Assets", icon: Layers },
  { href: "/pricing", label: "Pricing", icon: CircleDollarSign },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/editor/new") {
      return pathname.startsWith("/editor");
    }
    return pathname.startsWith(href);
  };

  return (
    <aside
      className="flex h-screen w-60 flex-col border-r border-brand-border bg-brand-surface"
      style={{ minWidth: "240px", maxWidth: "240px" }}
    >
      {/* Logo */}
      <div className="flex h-12 items-center px-4 border-b border-brand-border">
        <span className="font-mono text-sm font-bold tracking-wider text-brand-primary">
          PROMPTHUB
        </span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-4 py-2 text-sm transition-colors relative",
                active
                  ? "text-brand-text-primary bg-brand-elevated"
                  : "text-brand-text-secondary hover:text-brand-text-primary hover:bg-[#1a1a1a]"
              )}
            >
              {active && (
                <span className="absolute left-0 top-0 h-full w-0.5 bg-brand-primary rounded-r" />
              )}
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-brand-border py-2">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-4 py-2 text-sm text-brand-text-muted hover:text-brand-text-secondary transition-colors"
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span>Settings</span>
        </Link>
      </div>
    </aside>
  );
}
