import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/layout/app-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/datasets",
}));

describe("AppShell accessibility & keyboard interactions", () => {
  it("exposes skip link, primary landmarks, aria-current on active route, and accessible names when collapsed", async () => {
    const user = userEvent.setup();
    render(
      <AppShell>
        <h1>Datasets</h1>
      </AppShell>,
    );

    // Skip link & main landmark
    const skipLink = screen.getByRole("link", {
      name: "Skip to main content",
    });
    expect(skipLink).toHaveAttribute("href", "#main-content");
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");

    // Primary nav landmark & active page state
    const nav = screen.getByRole("navigation", {
      name: "Primary navigation",
    });
    expect(nav).toBeInTheDocument();

    const activeLink = screen.getByRole("link", { name: "Datasets" });
    expect(activeLink).toHaveAttribute("aria-current", "page");

    const dashboardLink = screen.getByRole("link", { name: "Dashboard" });
    expect(dashboardLink).not.toHaveAttribute("aria-current");

    // Collapse desktop sidebar and confirm accessible labels remain intact
    const collapseBtn = screen.getByRole("button", {
      name: "Collapse sidebar",
    });
    expect(collapseBtn).toHaveAttribute("aria-expanded", "true");

    await user.click(collapseBtn);

    const expandBtn = screen.getByRole("button", { name: "Expand sidebar" });
    expect(expandBtn).toHaveAttribute("aria-expanded", "false");

    // All 8 links remain accessible by name when collapsed
    for (const label of [
      "Dashboard",
      "Datasets",
      "Model Training",
      "Model Evaluation",
      "AI Playground",
      "NLP Playground",
      "Model Registry",
      "Settings",
    ]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  it("opens mobile navigation dialog with initial focus, traps Tab focus inside drawer, and restores focus on close", async () => {
    const user = userEvent.setup();
    render(
      <AppShell>
        <h1>Datasets</h1>
      </AppShell>,
    );

    const openBtn = screen.getByRole("button", {
      name: "Open navigation menu",
    });
    expect(openBtn).toHaveAttribute("aria-expanded", "false");

    await user.click(openBtn);
    expect(openBtn).toHaveAttribute("aria-expanded", "true");

    const dialog = screen.getByRole("dialog", { name: "Navigation menu" });
    expect(dialog).toHaveAttribute("aria-modal", "true");

    const closeBtn = screen.getByRole("button", {
      name: "Close navigation menu",
    });
    // Initial focus moves to Close navigation menu button
    expect(closeBtn).toHaveFocus();

    // Shift+Tab from first element wraps to last link inside drawer (Settings)
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(dialog.contains(document.activeElement)).toBe(true);

    // Tab from last element wraps back to first element (Close button)
    await user.keyboard("{Tab}");
    expect(closeBtn).toHaveFocus();

    // Close via Escape key and verify focus returns to Open navigation menu button
    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("dialog", { name: "Navigation menu" }),
    ).not.toBeInTheDocument();
    expect(openBtn).toHaveFocus();

    // Re-open and close via close button, verifying focus restoration again
    await user.click(openBtn);
    expect(
      screen.getByRole("dialog", { name: "Navigation menu" }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Close navigation menu" }),
    );
    expect(
      screen.queryByRole("dialog", { name: "Navigation menu" }),
    ).not.toBeInTheDocument();
    expect(openBtn).toHaveFocus();
  });
});
