"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Boxes,
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  Command,
  Database,
  FlaskConical,
  Gauge,
  LayoutDashboard,
  Menu,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const navigation = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard },
      { label: "Datasets", href: "/datasets", icon: Database },
      { label: "Model Training", href: "/training", icon: FlaskConical },
      { label: "Model Evaluation", href: "/evaluation", icon: Gauge },
    ],
  },
  {
    title: "Workspace",
    items: [
      { label: "AI Playground", href: "/playground", icon: Sparkles },
      { label: "NLP Playground", href: "/nlp", icon: BrainCircuit },
      { label: "Model Registry", href: "/registry", icon: Boxes },
    ],
  },
  {
    title: "System",
    items: [{ label: "Settings", href: "/settings", icon: Settings2 }],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileOpenButtonRef = useRef<HTMLButtonElement>(null);
  const mobileCloseButtonRef = useRef<HTMLButtonElement>(null);
  const mobileDrawerRef = useRef<HTMLDivElement>(null);
  const wasMobileOpenRef = useRef(false);

  useEffect(() => {
    if (!mobileOpen) {
      if (wasMobileOpenRef.current) {
        wasMobileOpenRef.current = false;
        mobileOpenButtonRef.current?.focus();
      }
      return;
    }

    wasMobileOpenRef.current = true;
    mobileCloseButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileOpen(false);
        return;
      }

      if (event.key === "Tab" && mobileDrawerRef.current) {
        const focusable = Array.from(
          mobileDrawerRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]):not([tabindex="-1"]), a[href]:not([tabindex="-1"]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])',
          ),
        );
        if (focusable.length === 0) {
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement as HTMLElement | null;

        if (event.shiftKey) {
          if (active === first || !mobileDrawerRef.current.contains(active)) {
            event.preventDefault();
            last.focus();
          }
        } else if (
          active === last ||
          !mobileDrawerRef.current.contains(active)
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileOpen]);

  const renderSidebar = (isMobileDrawer: boolean) => (
    <div className="flex h-full flex-col">
      <div className="flex h-[76px] items-center gap-3 px-5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-950/40">
          <Command className="size-5 text-white" aria-hidden="true" />
        </div>
        {(!collapsed || isMobileDrawer) && (
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight text-white">
              DeepVision
            </p>
            <p className="text-[11px] text-zinc-500">
              AI Studio <span className="text-indigo-400">•</span> v1.0
            </p>
          </div>
        )}
        {isMobileDrawer && (
          <Button
            ref={mobileCloseButtonRef}
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close navigation menu"
            className="ml-auto lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        )}
      </div>

      <Separator className="bg-white/[0.06]" />

      <nav
        aria-label={
          isMobileDrawer ? "Mobile primary navigation" : "Primary navigation"
        }
        className="flex-1 space-y-7 overflow-y-auto px-3 py-6"
      >
        {navigation.map((group) => (
          <div key={group.title}>
            {(!collapsed || isMobileDrawer) && (
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
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
                    aria-label={item.label}
                    aria-current={active ? "page" : undefined}
                    title={collapsed && !isMobileDrawer ? item.label : undefined}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "group flex h-10 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-indigo-400",
                      active
                        ? "bg-indigo-500/15 text-indigo-300 ring-1 ring-inset ring-indigo-400/20"
                        : "text-zinc-400 hover:bg-white/[0.045] hover:text-zinc-200",
                    )}
                  >
                    <Icon
                      aria-hidden="true"
                      className={cn(
                        "size-[17px] shrink-0",
                        active && "text-indigo-400",
                      )}
                    />
                    {(!collapsed || isMobileDrawer) && <span>{item.label}</span>}
                    {active && (!collapsed || isMobileDrawer) && (
                      <span
                        aria-hidden="true"
                        className="ml-auto size-1.5 rounded-full bg-indigo-400"
                      />
                    )}
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
            <span className="relative flex size-2" aria-hidden="true">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-30" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
            {(!collapsed || isMobileDrawer) && (
              <span className="text-xs text-zinc-400">Local workspace</span>
            )}
          </div>
          {(!collapsed || isMobileDrawer) && (
            <p className="mt-2 text-[10px] text-zinc-500">
              Your models. Your machine.
            </p>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between">
          {(!collapsed || isMobileDrawer) && (
            <span className="text-[10px] text-zinc-500">
              DEEPVISION AI STUDIO
            </span>
          )}
          {!isMobileDrawer && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              className="hidden size-8 text-zinc-400 hover:text-white lg:flex"
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? (
                <ChevronRight className="size-4" aria-hidden="true" />
              ) : (
                <ChevronLeft className="size-4" aria-hidden="true" />
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  const pageTitle =
    navigation.flatMap((g) => g.items).find((i) => i.href === pathname)
      ?.label ?? "Dashboard";

  return (
    <div className="min-h-screen bg-[#0B0C10] text-zinc-100">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-indigo-600 focus:px-4 focus:py-2 focus:text-xs focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none"
      >
        Skip to main content
      </a>

      <aside
        aria-label="Workspace sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden border-r border-white/[0.06] bg-[#0E1016] transition-[width] duration-200 lg:block",
          collapsed ? "w-[76px]" : "w-[264px]",
        )}
      >
        {renderSidebar(false)}
      </aside>

      {mobileOpen && (
        <div
          ref={mobileDrawerRef}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          className="fixed inset-0 z-50 lg:hidden"
        >
          <button
            type="button"
            tabIndex={-1}
            aria-label="Close navigation backdrop"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-[280px] border-r border-white/10 bg-[#0E1016]">
            {renderSidebar(true)}
          </aside>
        </div>
      )}

      <div
        className={cn(
          "min-h-screen transition-[padding] duration-200",
          collapsed ? "lg:pl-[76px]" : "lg:pl-[264px]",
        )}
      >
        <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-white/[0.06] bg-[#0B0C10]/85 px-4 backdrop-blur-xl sm:px-7">
          <div className="flex items-center gap-3">
            <Button
              ref={mobileOpenButtonRef}
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Open navigation menu"
              aria-expanded={mobileOpen}
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="size-5" aria-hidden="true" />
            </Button>
            <div>
              <p className="text-sm font-semibold text-zinc-100">{pageTitle}</p>
              <p className="hidden text-[11px] text-zinc-500 sm:block">
                DeepVision AI Studio{" "}
                <span className="mx-1 text-zinc-600">/</span> Workspace
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5 sm:flex">
              <Activity
                className="size-3 text-emerald-400"
                aria-hidden="true"
              />
              <span className="text-[11px] text-zinc-400">
                Local environment
              </span>
            </div>
            <div
              aria-hidden="true"
              className="flex size-8 items-center justify-center rounded-full border border-indigo-400/20 bg-indigo-500/10 text-[11px] font-semibold text-indigo-300"
            >
              DV
            </div>
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1600px] p-4 outline-none sm:p-7 xl:p-9"
        >
          {children}
        </main>
        <footer className="border-t border-white/[0.05] px-7 py-4 text-center text-[10px] text-zinc-500">
          DEEPVISION AI STUDIO <span className="mx-2">·</span> LOCAL-FIRST DEEP
          LEARNING WORKSPACE
        </footer>
      </div>
    </div>
  );
}
