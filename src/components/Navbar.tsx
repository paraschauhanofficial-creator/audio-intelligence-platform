"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { User, Sparkles, LogOut, ChevronDown, Shield, Bell, Settings, Sun, Moon, Menu, X } from "lucide-react";
import { notifyLoginSummary } from "@/lib/usageTracking";

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

interface NavbarProps {
  accentColor?: string;
}

export default function Navbar({ accentColor = "#00B7FF" }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter(n => !n.read).length;

  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  const [isDarkMode, setIsDarkMode] = useState(true);

  // Mobile menu
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user?.email) setUserEmail(data.user.email);
      if (data.user?.id) {
        const { data: profile } = await supabase
          .from("profiles").select("role").eq("id", data.user.id).single();
        if (profile?.role === "admin") setIsAdmin(true);
      }
    });
    loadNotifications();
    notifyLoginSummary();

    const saved = localStorage.getItem("nokashi-theme");
    if (saved === "light") {
      document.documentElement.classList.add("theme-light");
      setIsDarkMode(false);
    }
  }, []);

  const loadNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (!error && data) setNotifications(data as NotificationRow[]);
  };

  const markAsRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    await supabase.from("notifications").update({ read: true }).eq("id", id);
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) return;
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    await supabase.from("notifications").update({ read: true }).in("id", unreadIds);
  };

  const toggleTheme = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.classList.remove("theme-light");
      localStorage.setItem("nokashi-theme", "dark");
    } else {
      document.documentElement.classList.add("theme-light");
      localStorage.setItem("nokashi-theme", "light");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setSettingsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navLinks = [
    { href: "/projects", label: "Home" },
    { href: "/projects/list", label: "My Projects" },
  ];

  const iconBtn = "flex items-center justify-center w-8 h-8 md:w-9 md:h-9 rounded-lg border transition-colors";
  const dropdownBase = "absolute right-0 top-full mt-2 rounded-xl overflow-hidden animate-fade-in z-50";
  const dropdownStyle = { backgroundColor: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 8px 24px var(--shadow)" };

  return (
    <div className="relative z-20" style={{ backgroundColor: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between px-4 md:px-8 py-3 md:py-4">

        {/* Logo */}
        <div className="flex-shrink-0 cursor-pointer" onClick={() => router.push("/projects")}>
          <span className="text-xs md:text-sm font-semibold tracking-[0.25em]"
            style={{ color: isDarkMode ? "#E8E4DC" : "#1A1714" }}>
            NOKASHI STUDIOS
          </span>
        </div>

        {/* Desktop nav links — centered */}
        <nav className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
          {navLinks.map(link => (
            <button
              key={link.href}
              onClick={() => router.push(link.href)}
              className="text-sm font-medium transition-colors relative pb-1"
              style={{ color: pathname === link.href ? accentColor : "var(--text-muted)" }}
            >
              {link.label}
              {pathname === link.href && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full"
                  style={{ backgroundColor: accentColor }} />
              )}
            </button>
          ))}
        </nav>

        {/* Right side icons */}
        <div className="flex items-center gap-1 md:gap-2">

          {/* Bell */}
          <div className="relative" ref={notifRef}>
            <button onClick={() => setNotifOpen(v => !v)}
              className={iconBtn} style={{ borderColor: "var(--border)" }}>
              <Bell size={15} className="text-zinc-400" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#FF6B4A] text-[9px] font-bold text-white flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className={`${dropdownBase} w-72 md:w-80`} style={dropdownStyle}>
                <div className="px-4 py-3 flex items-center justify-between"
                  style={{ borderBottom: "1px solid var(--border)" }}>
                  <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>Notifications</p>
                  {unreadCount > 0 && (
                    <button onClick={markAllAsRead} className="text-xs transition"
                      style={{ color: "var(--text-muted)" }}>
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>
                      No notifications yet.
                    </p>
                  ) : notifications.map(n => (
                    <button key={n.id} onClick={() => markAsRead(n.id)}
                      className="w-full text-left px-4 py-3 last:border-0 transition-colors"
                      style={{
                        borderBottom: "1px solid var(--border)",
                        backgroundColor: n.read ? "transparent" : "#00B7FF08",
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = "var(--card)"}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = n.read ? "transparent" : "#00B7FF08"}
                    >
                      <div className="flex items-start gap-2">
                        {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-[#00B7FF] mt-1.5 flex-shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-xs font-semibold" style={{ color: "var(--text)" }}>{n.title}</p>
                          <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{n.message}</p>
                          <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)", opacity: 0.6 }}>
                            {new Date(n.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Settings */}
          <div className="relative" ref={settingsRef}>
            <button onClick={() => setSettingsOpen(v => !v)}
              className={iconBtn} style={{ borderColor: "var(--border)" }}>
              <Settings size={15} className="text-zinc-400" />
            </button>

            {settingsOpen && (
              <div className={`${dropdownBase} w-48`} style={dropdownStyle}>
                <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Settings</p>
                </div>
                <button
                  onClick={() => { toggleTheme(); setSettingsOpen(false); }}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm transition-colors"
                  style={{ color: "var(--text)" }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = "rgba(128,128,128,0.1)"}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  <div className="flex items-center gap-3">
                    {isDarkMode
                      ? <Sun size={15} style={{ color: "var(--text-muted)" }} />
                      : <Moon size={15} style={{ color: "var(--text-muted)" }} />
                    }
                    {isDarkMode ? "Light Mode" : "Dark Mode"}
                  </div>
                  <div className="w-8 h-4 rounded-full relative transition-colors flex-shrink-0"
                    style={{ backgroundColor: isDarkMode ? "#1F2937" : accentColor }}>
                    <div className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all"
                      style={{ left: isDarkMode ? "2px" : "18px" }} />
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Avatar dropdown */}
          <div className="relative flex-shrink-0" ref={dropdownRef}>
            <button onClick={() => setDropdownOpen(v => !v)}
              className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1.5 md:py-2 rounded-lg border transition-all duration-200"
              style={{ borderColor: "var(--border)" }}>
              <div className="w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ backgroundColor: accentColor }}>
                {userEmail?.[0]?.toUpperCase() ?? "U"}
              </div>
              <ChevronDown size={12} className="text-zinc-400 hidden md:block" />
            </button>

            {dropdownOpen && (
              <div className={`${dropdownBase} w-52`} style={dropdownStyle}>
                <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>Signed in as</p>
                  <p className="text-sm truncate mt-0.5" style={{ color: "var(--text)" }}>{userEmail}</p>
                </div>

                <button onClick={() => { setDropdownOpen(false); router.push("/projects/profile"); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors"
                  style={{ color: "var(--text)" }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = "rgba(128,128,128,0.1)"}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}>
                  <User size={15} style={{ color: "var(--text-muted)" }} />
                  Profile
                </button>

                <button onClick={() => { setDropdownOpen(false); router.push("/projects/upgrade"); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors"
                  style={{ color: "#F0A500" }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = "rgba(128,128,128,0.1)"}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}>
                  <Sparkles size={15} />
                  Upgrade plan
                </button>

                {isAdmin && (
                  <button onClick={() => { setDropdownOpen(false); router.push("/admin"); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors"
                    style={{ color: "#FF6B4A" }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = "rgba(128,128,128,0.1)"}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}>
                    <Shield size={15} />
                    Admin panel
                  </button>
                )}

                <div style={{ borderTop: "1px solid var(--border)" }} />

                <button onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 transition-colors"
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.1)"}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}>
                  <LogOut size={15} />
                  Log out
                </button>
              </div>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(v => !v)}
            className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg border transition-colors ml-1"
            style={{ borderColor: "var(--border)" }}
          >
            {mobileOpen ? <X size={15} className="text-zinc-400" /> : <Menu size={15} className="text-zinc-400" />}
          </button>

        </div>
      </div>

      {/* Mobile nav menu */}
      {mobileOpen && (
        <div className="md:hidden border-t" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
          {navLinks.map(link => (
            <button
              key={link.href}
              onClick={() => { router.push(link.href); setMobileOpen(false); }}
              className="w-full flex items-center px-6 py-4 text-sm font-medium transition-colors"
              style={{ color: pathname === link.href ? accentColor : "var(--text)" }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = "rgba(128,128,128,0.1)"}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
            >
              {link.label}
              {pathname === link.href && (
                <span className="ml-2 w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: accentColor }} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}