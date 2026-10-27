"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const LINKS: [string, string][] = [
  ["How it works", "/#how"],
  ["Check comps", "/find#check"],
  ["Why not an LLM", "/#llm"],
];

export function SiteNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="nav on-ink">
      <div className="container nav-inner">
        <Link className="brand" href="/">
          <SpineMark />
          Nearshelf
        </Link>
        <nav className="nav-links" aria-label="Main">
          {LINKS.map(([label, href]) => (
            <Link key={href} href={href}>{label}</Link>
          ))}
        </nav>
        <Link className="btn btn-primary nav-cta" href="/find">Find my comps</Link>
        <button
          type="button"
          className="menu-btn"
          aria-expanded={open}
          aria-controls="menu-sheet"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((o) => !o)}
        >
          <MenuIcon open={open} />
        </button>
      </div>
      {open && (
        <nav id="menu-sheet" className="container menu-sheet" aria-label="Main">
          {LINKS.map(([label, href]) => (
            <Link key={href} href={href} onClick={() => setOpen(false)}>{label}</Link>
          ))}
        </nav>
      )}
    </header>
  );
}

export function SpineMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="6" y="7" width="5" height="18" rx="1" fill="#f4f4f5" />
      <rect x="12.5" y="9" width="5" height="16" rx="1" fill="#a1a1aa" />
      <rect x="19" y="6" width="5" height="19" rx="1" fill="#f4f4f5" />
      <rect x="4" y="25" width="24" height="3" rx="1" fill="#a1a1aa" />
    </svg>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
    </svg>
  );
}
