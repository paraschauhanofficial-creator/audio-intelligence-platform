"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { User, Sparkles, LogOut, ChevronDown, Shield, Bell } from "lucide-react";

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

interface NavbarProps {
  accentColor?: string; // pass project accent (cyan or turquoise) when relevant
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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
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

      {/* Notifications */}
      <div className="relative flex-shrink-0 flex items-center gap-3">
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen(v => !v)}
            className="relative flex items-center justify-center w-9 h-9 rounded-lg border border-[#1F2937] hover:border-[#374151] transition-colors"
          >
            <Bell size={16} className="text-zinc-400" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#FF6B4A] text-[9px] font-bold text-white flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-[#111827] border border-[#1F2937] rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.4)] overflow-hidden animate-fade-in">
              <div className="px-4 py-3 border-b border-[#1F2937] flex items-center justify-between">
                <p className="text-sm font-semibold text-zinc-200">Notifications</p>
                {unreadCount > 0 && (
                  <button onClick={markAllAsRead} className="text-xs text-zinc-500 hover:text-zinc-300 transition">
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="text-sm text-zinc-600 text-center py-8">No notifications yet.</p>
                ) : (
                  notifications.map(n => (
                    <button
                      key={n.id}
                      onClick={() => markAsRead(n.id)}
                      className="w-full text-left px-4 py-3 border-b border-[#1F2937] last:border-0 hover:bg-[#1F293750] transition-colors"
                      style={{ backgroundColor: n.read ? "transparent" : "#00B7FF08" }}
                    >
                      <div className="flex items-start gap-2">
                        {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-[#00B7FF] mt-1.5 flex-shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-zinc-200">{n.title}</p>
                          <p className="text-[11px] text-zinc-500 mt-0.5">{n.message}</p>
                          <p className="text-[10px] text-zinc-700 mt-1">
                            {new Date(n.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

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

            {isAdmin && (
              <button
                onClick={() => { setDropdownOpen(false); router.push("/admin"); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#FF6B4A] hover:bg-[#FF6B4A12] transition-colors"
              >
                <Shield size={16} className="text-[#FF6B4A]" />
                Admin panel
              </button>
            )}

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
    </div>
  );
}