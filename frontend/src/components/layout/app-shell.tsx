"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Activity, BrainCircuit, ChevronLeft, ChevronRight, Command,
  Database, FlaskConical, Gauge, LayoutDashboard, Menu, Settings2,
  Sparkles, X, Boxes,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const navigation = [
  { title: "Overview", items: [
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Datasets", href: "/datasets", icon: Database },
    { label: "Model Training", href: "/training", icon: FlaskConical },
    { label: "Model Evaluation", href: "/evaluation", icon: Gauge },
  ]},
  { title: "Workspace", items: [
    { label: "AI Playground", href: "/playground", icon: Sparkles },
    { label: "NLP Playground", href: "/nlp", icon: BrainCircuit },
    { label: "Model Registry", href: "/registry", icon: Boxes },
  ]},
  { title: "System", items: [
    { label: "Settings", href: "/settings", icon: Settings2 },
  ]},
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-[76px] items-center gap-3 px-5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-950/40">
          <Command className="size-5 text-white" />
        </div>
        {(!collapsed || mobileOpen) && (
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight text-white">DeepVision</p>
            <p className="text-[11px] text-zinc-500">AI Studio <span className="text-indigo-400">•</span> v1.0</p>
          </div>
        )}
        {mobileOpen && (
          <Button variant="ghost" size="icon" className="ml-auto lg:hidden" onClick={() => setMobileOpen(false)}>
            <X className="size-4" />
          </Button>
        )}
      </div>

      <Separator className="bg-white/[0.06]" />

      <nav className="flex-1 space-y-7 overflow-y-auto px-3 py-6">
        {navigation.map((group) => (
          <div key={group.title}>
            {(!collapsed || mobileOpen) && (
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
                {group.title}
              </p>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "group flex h-10 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-all",
                      active
                        ? "bg-indigo-500/15 text-indigo-300 ring-1 ring-inset ring-indigo-400/20"
                        : "text-zinc-500 hover:bg-white/[0.045] hover:text-zinc-200",
                    )}
                  >
                    <Icon className={cn("size-[17px] shrink-0", active && "text-indigo-400")} />
                    {(!collapsed || mobileOpen) && <span>{item.label}</span>}
                    {active && (!collapsed || mobileOpen) && <span className="ml-auto size-1.5 rounded-full bg-indigo-400" />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3">
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
          <div className="flex items-center gap-2">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-30" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
            {(!collapsed || mobileOpen) && <span className="text-xs text-zinc-400">Local workspace</span>}
          </div>
          {(!collapsed || mobileOpen) && <p className="mt-2 text-[10px] text-zinc-600">Your models. Your machine.</p>}
        </div>
        <div className="mt-3 flex items-center justify-between">
          {(!collapsed || mobileOpen) && <span className="text-[10px] text-zinc-700">DEEPVISION AI STUDIO</span>}
          {!mobileOpen && (
            <Button variant="ghost" size="icon" className="hidden size-8 text-zinc-600 hover:text-white lg:flex" onClick={() => setCollapsed(!collapsed)}>
              {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  const pageTitle = navigation.flatMap((g) => g.items).find((i) => i.href === pathname)?.label ?? "Dashboard";

  return (
    <div className="min-h-screen bg-[#0B0C10] text-zinc-100">
      <aside className={cn("fixed inset-y-0 left-0 z-40 hidden border-r border-white/[0.06] bg-[#0E1016] transition-[width] duration-200 lg:block", collapsed ? "w-[76px]" : "w-[264px]")}>
        {sidebar}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button aria-label="Close navigation" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[280px] border-r border-white/10 bg-[#0E1016]">{sidebar}</aside>
        </div>
      )}

      <div className={cn("min-h-screen transition-[padding] duration-200", collapsed ? "lg:pl-[76px]" : "lg:pl-[264px]")}>
        <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-white/[0.06] bg-[#0B0C10]/85 px-4 backdrop-blur-xl sm:px-7">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)}>
              <Menu className="size-5" />
            </Button>
            <div>
              <p className="text-sm font-semibold text-zinc-100">{pageTitle}</p>
              <p className="hidden text-[11px] text-zinc-600 sm:block">DeepVision AI Studio <span className="mx-1 text-zinc-700">/</span> Workspace</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5 sm:flex">
              <Activity className="size-3 text-emerald-400" />
              <span className="text-[11px] text-zinc-400">Local environment</span>
            </div>
            <div className="flex size-8 items-center justify-center rounded-full border border-indigo-400/20 bg-indigo-500/10 text-[11px] font-semibold text-indigo-300">DV</div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-7 xl:p-9">{children}</main>
        <footer className="border-t border-white/[0.05] px-7 py-4 text-center text-[10px] text-zinc-700">
          DEEPVISION AI STUDIO <span className="mx-2">·</span> LOCAL-FIRST DEEP LEARNING WORKSPACE
        </footer>
      </div>
    </div>
  );
}
