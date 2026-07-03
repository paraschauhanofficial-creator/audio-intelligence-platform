"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Trash2, Bell, ArrowLeft, CheckSquare, Square } from "lucide-react";
import Navbar from "@/components/Navbar";

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

function severityColor(type: string): string {
  if (type === "egress_blocked" || type === "storage_limit_90") return "#FF6B4A";
  if (type === "egress_warning_70" || type === "storage_warning_70" || type === "egress_limit_90") return "#F0A500";
  return "#00B7FF";
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearingAll, setClearingAll] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => { loadNotifications(); }, []);

  const loadNotifications = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) setNotifications(data as NotificationRow[]);
    setLoading(false);
  };

  const markAsRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    await supabase.from("notifications").update({ read: true }).eq("id", id);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = notifications.length > 0 && selectedIds.size === notifications.length;

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(notifications.map(n => n.id)));
  };

  const deleteNotification = async (id: string) => {
    setDeletingId(id);
    const prev = notifications;
    setNotifications(current => current.filter(n => n.id !== id));
    setSelectedIds(prevSel => {
      const next = new Set(prevSel);
      next.delete(id);
      return next;
    });

    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (error) {
      console.error("notification delete failed:", error);
      setNotifications(prev);
    }
    setDeletingId(null);
  };

  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const confirmed = confirm(`Delete ${selectedIds.size} selected notification${selectedIds.size > 1 ? "s" : ""}?`);
    if (!confirmed) return;

    setDeletingSelected(true);
    const idsToDelete = Array.from(selectedIds);
    const prev = notifications;
    setNotifications(current => current.filter(n => !selectedIds.has(n.id)));
    setSelectedIds(new Set());

    const { error } = await supabase.from("notifications").delete().in("id", idsToDelete);
    if (error) {
      console.error("bulk delete failed:", error);
      setNotifications(prev);
    }
    setDeletingSelected(false);
  };

  const deleteAll = async () => {
    if (notifications.length === 0) return;
    const confirmed = confirm(`Delete all ${notifications.length} notifications? This can't be undone.`);
    if (!confirmed) return;

    setClearingAll(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setClearingAll(false); return; }

    const prev = notifications;
    setNotifications([]);
    setSelectedIds(new Set());

    const { error } = await supabase.from("notifications").delete().eq("user_id", user.id);
    if (error) {
      console.error("delete all notifications failed:", error);
      setNotifications(prev);
    }
    setClearingAll(false);
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const selectionMode = selectedIds.size > 0;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--background)", color: "var(--text)" }}>
      <Navbar accentColor="#00B7FF" />

      <div className="max-w-3xl mx-auto px-8 py-12">

        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => router.push("/projects")}
            className="flex items-center justify-center w-9 h-9 rounded-lg border transition"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold" style={{ color: "var(--text)" }}>Notifications</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              {notifications.length === 0
                ? "You're all caught up."
                : `${notifications.length} total${unreadCount > 0 ? ` · ${unreadCount} unread` : ""}`}
            </p>
          </div>
          {notifications.length > 0 && (
            <button onClick={deleteAll} disabled={clearingAll}
              className="px-4 py-2 rounded-lg border text-sm font-semibold transition disabled:opacity-50"
              style={{ borderColor: "#FF6B4A40", color: "#FF6B4A" }}>
              {clearingAll ? "Deleting..." : "Delete all"}
            </button>
          )}
        </div>

        {notifications.length > 0 && (
          <div className="flex items-center justify-between mb-6 px-1">
            <button onClick={toggleSelectAll} className="flex items-center gap-2 text-sm transition"
              style={{ color: "var(--text-muted)" }}>
              {allSelected ? <CheckSquare size={16} style={{ color: "#00B7FF" }} /> : <Square size={16} />}
              {allSelected ? "Deselect all" : "Select all"}
            </button>

            {selectionMode && (
              <button onClick={deleteSelected} disabled={deletingSelected}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-50"
                style={{ backgroundColor: "#FF6B4A", color: "#000" }}>
                {deletingSelected ? "Deleting..." : `Delete selected (${selectedIds.size})`}
              </button>
            )}
          </div>
        )}

        {loading ? (
          <div className="text-center py-20" style={{ color: "var(--text-muted)" }}>Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 rounded-2xl border"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
            <Bell size={32} style={{ color: "var(--text-muted)" }} className="mb-3" />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>No notifications yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map(n => {
              const color = severityColor(n.type);
              const isSelected = selectedIds.has(n.id);
              return (
                <div key={n.id}
                  className="group flex items-start gap-3 rounded-xl border px-5 py-4 transition"
                  style={{
                    backgroundColor: isSelected ? "#00B7FF10" : "var(--surface)",
                    borderColor: isSelected ? "#00B7FF60" : (n.read ? "var(--border)" : color + "40"),
                  }}>

                  <button onClick={() => toggleSelect(n.id)} className="flex-shrink-0 mt-0.5" title="Select">
                    {isSelected
                      ? <CheckSquare size={16} style={{ color: "#00B7FF" }} />
                      : <Square size={16} style={{ color: "var(--text-muted)" }} />}
                  </button>

                  <div onClick={() => !n.read && markAsRead(n.id)} className="flex-1 min-w-0 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>{n.title}</p>
                      {!n.read && (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: color + "20", color }}>
                          New
                        </span>
                      )}
                    </div>
                    <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>{n.message}</p>
                    <p className="text-xs mt-2" style={{ color: "var(--text-muted)", opacity: 0.6 }}>
                      {new Date(n.created_at).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
                      })}
                    </p>
                  </div>

                  <button
                    onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                    disabled={deletingId === n.id}
                    className="flex-shrink-0 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition disabled:opacity-50"
                    style={{ color: "var(--text-muted)" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#FF6B4A")}
                    onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
                    title="Delete notification"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}