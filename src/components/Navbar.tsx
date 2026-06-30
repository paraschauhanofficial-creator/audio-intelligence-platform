"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { User, Sparkles, LogOut, ChevronDown } from "lucide-react";

interface NavbarProps {
  accentColor?: string; // pass project accent (cyan or turquoise) when relevant
}

export default function Navbar({ accentColor = "#00B7FF" }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setUserEmail(data.user.email);
    });
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const navLinks = [
    { label: "Home", href: "/projects" },
    { label: "My Projects", href: "/projects/list" },
  ];

  const initials = userEmail ? userEmail.slice(0, 2).toUpperCase() : "N";

  return (
    <div className="relative z-20 flex items-center justify-between px-8 py-5 border-b border-[#1F2937]">
      {/* Logo */}
      <h1 className="heading-brand text-xl font-bold flex-shrink-0">
        <span className="text-white">NOKASHI</span>
        <span className="text-[#00B7FF]"> STUDIOS</span>
      </h1>

      {/* Nav links — glow hover text style */}
      <nav className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
        {navLinks.map(link => {
          const isActive = pathname === link.href;
          return (
            <button
              key={link.href}
              onClick={() => router.push(link.href)}
              className="relative text-sm font-medium transition-all duration-200 py-1"
              style={{
                color: isActive ? accentColor : "#a1a1aa",
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = accentColor; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = "#a1a1aa"; }}
            >
              {link.label}
              <span
                className="absolute -bottom-1 left-0 right-0 h-[2px] rounded-full transition-all duration-200"
                style={{
                  backgroundColor: accentColor,
                  opacity: isActive ? 1 : 0,
                  boxShadow: isActive ? `0 0 8px ${accentColor}` : "none",
                }}
              />
            </button>
          );
        })}
      </nav>

      {/* User dropdown */}
      <div className="relative flex-shrink-0" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(v => !v)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#1F2937] hover:border-[#374151] transition-all duration-200 group"
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
            style={{ backgroundColor: accentColor + "20", color: accentColor }}
          >
            {initials}
          </div>
          <ChevronDown
            size={14}
            className="text-zinc-500 group-hover:text-zinc-300 transition-transform duration-200"
            style={{ transform: dropdownOpen ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 top-full mt-2 w-56 bg-[#111827] border border-[#1F2937] rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.4)] overflow-hidden animate-fade-in">
            {userEmail && (
              <div className="px-4 py-3 border-b border-[#1F2937]">
                <p className="text-xs text-zinc-500">Signed in as</p>
                <p className="text-sm text-zinc-200 truncate mt-0.5">{userEmail}</p>
              </div>
            )}

            <button
              onClick={() => { setDropdownOpen(false); router.push("/projects/profile"); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-300 hover:bg-[#1F2937] transition-colors"
            >
              <User size={16} className="text-zinc-500" />
              Profile
            </button>

            <button
              onClick={() => { setDropdownOpen(false); router.push("/projects/upgrade"); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors group"
              style={{ color: "#F0A500" }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = "#F0A50012"}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
            >
              <Sparkles size={16} style={{ color: "#F0A500" }} />
              Upgrade plan
            </button>

            <div className="border-t border-[#1F2937]" />

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut size={16} />
              Log out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}