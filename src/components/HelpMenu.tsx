"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./HelpMenu.module.css";

type HelpItem = {
  label: string;
  href?: string;
  external?: boolean;
  onClick?: () => void;
  icon: React.ReactNode;
  divider?: boolean;
};

const iconProps = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const Icons = {
  rocket: (
    <svg {...iconProps}>
      <path d="M4 13a8 8 0 0 1 7 7 6 6 0 0 0 3 -5 9 9 0 0 0 6 -8 3 3 0 0 0 -3 -3 9 9 0 0 0 -8 6 6 6 0 0 0 -5 3" />
      <path d="M7 14a6 6 0 0 0 -3 6 6 6 0 0 0 6 -3" />
      <circle cx="15" cy="9" r="1" />
    </svg>
  ),
  book: (
    <svg {...iconProps}>
      <path d="M3 19a9 9 0 0 1 9 0 9 9 0 0 1 9 0" />
      <path d="M3 6a9 9 0 0 1 9 0 9 9 0 0 1 9 0" />
      <path d="M3 6v13M12 6v13M21 6v13" />
    </svg>
  ),
  faq: (
    <svg {...iconProps}>
      <path d="M8 9h8M8 13h6" />
      <path d="M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12z" />
    </svg>
  ),
  keyboard: (
    <svg {...iconProps}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 10h0M10 10h0M14 10h0M18 10h0M6 14h0M18 14h0M9 14h6" />
    </svg>
  ),
  headset: (
    <svg {...iconProps}>
      <path d="M4 14v-3a8 8 0 0 1 16 0v3" />
      <path d="M18 19a2 2 0 0 1 -2 2h-2" />
      <rect x="2" y="14" width="4" height="6" rx="1" />
      <rect x="18" y="14" width="4" height="6" rx="1" />
    </svg>
  ),
  sparkles: (
    <svg {...iconProps}>
      <path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0 -1.3 1.3L12 21l-1.9 -5.8a2 2 0 0 0 -1.3 -1.3L3 12l5.8 -1.9a2 2 0 0 0 1.3 -1.3L12 3z" />
    </svg>
  ),
  external: (
    <svg {...iconProps} width={13} height={13}>
      <path d="M12 6h-6a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-6" />
      <path d="M11 13l9 -9M15 4h5v5" />
    </svg>
  ),
  help: (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 17v.01" />
      <path d="M12 13.5a1.5 1.5 0 0 1 1 -1.5 2.6 2.6 0 1 0 -3 -4" />
    </svg>
  ),
};

interface HelpMenuProps {
  /** Optional handler to open a keyboard-shortcuts modal instead of navigating */
  onShortcuts?: () => void;
  /** Optional handler to open the contact-support modal (Step 3) */
  onContactSupport?: () => void;
}

export default function HelpMenu({ onShortcuts, onContactSupport }: HelpMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const items: HelpItem[] = [
    { label: "Getting started", href: "/help/getting-started", icon: Icons.rocket },
    { label: "User guide", href: "/help/guide", icon: Icons.book },
    { label: "FAQs", href: "/help/faqs", icon: Icons.faq },
    {
      label: "Keyboard shortcuts",
      icon: Icons.keyboard,
      onClick: onShortcuts,
      href: onShortcuts ? undefined : "/help/shortcuts",
    },
    {
      label: "Contact support",
      icon: Icons.headset,
      onClick: onContactSupport,
      href: onContactSupport ? undefined : "/help/contact",
      divider: true,
    },
    { label: "What's new", href: "/help/whats-new", icon: Icons.sparkles },
  ];

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-label="Help and support"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {Icons.help}
      </button>

      {open && (
        <div className={styles.menu} role="menu" aria-label="Help and support">
          <p className={styles.heading}>Help &amp; support</p>
          {items.map((item) => (
            <div key={item.label}>
              {item.divider && <div className={styles.divider} />}
              {item.href ? (
                <Link
                  href={item.href}
                  role="menuitem"
                  className={styles.item}
                  target={item.external ? "_blank" : undefined}
                  onClick={() => setOpen(false)}
                >
                  <span className={styles.icon}>{item.icon}</span>
                  {item.label}
                  {item.external && (
                    <span className={styles.trailing}>{Icons.external}</span>
                  )}
                </Link>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  className={styles.item}
                  onClick={() => {
                    setOpen(false);
                    item.onClick?.();
                  }}
                >
                  <span className={styles.icon}>{item.icon}</span>
                  {item.label}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}