"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import { Shield, Crown, User as UserIcon, Plus, Mail, X, Check, Trash2 } from "lucide-react";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "super_user" | "user";
  plan: "free" | "pro" | "studio";
  created_at: string;
}

function formatBytes(bytes: number) {
  if (bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

export default function AdminPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [users, setUsers]           = useState<Profile[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [toast, setToast]           = useState("");
  const [userToDelete, setUserToDelete] = useState<Profile | null>(null);
  const [deleting, setDeleting]         = useState(false);
  const [usageById, setUsageById]   = useState<Record<string, {
    storageUsedBytes: number; storageBudgetBytes: number;
    egressUsedBytes: number; egressBudgetBytes: number;
  }>>({});

  // Add user form state
  const [newEmail, setNewEmail]       = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName]         = useState("");
  const [newRole, setNewRole]         = useState<"user" | "super_user" | "admin">("user");
  const [newPlan, setNewPlan]         = useState<"free" | "pro" | "studio">("free");
  const [creating, setCreating]       = useState(false);

  // Theme — identical pattern to every other migrated page (see projects/page.tsx)
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("nokashi-theme");
    setIsDarkMode(saved !== "light");
    const observer = new MutationObserver(() => {
      setIsDarkMode(!document.documentElement.classList.contains("theme-light"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const inputBg = isDarkMode ? "#0A0A0A" : "rgba(255,255,255,0.6)";

  useEffect(() => { checkAdminAndLoad(); }, []);

  const checkAdminAndLoad = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") {
      setAuthorized(false);
      setLoading(false);
      return;
    }

    setAuthorized(true);
    await Promise.all([loadUsers(), loadUsageData()]);
  };

  const getAuthHeader = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return { Authorization: `Bearer ${session?.access_token}` };
  };

  const loadUsers = async () => {
    setLoading(true);
    const headers = await getAuthHeader();
    const res = await fetch("/api/admin/users", { headers });
    const data = await res.json();
    if (data.users) setUsers(data.users);
    setLoading(false);
  };

  const loadUsageData = async () => {
    const headers = await getAuthHeader();
    const res = await fetch("/api/admin/usage", { headers });
    const data = await res.json();
    if (data.users) {
      const map: typeof usageById = {};
      for (const u of data.users) {
        map[u.id] = {
          storageUsedBytes:  u.storageUsedBytes,
          storageBudgetBytes: u.storageBudgetBytes,
          egressUsedBytes:   u.egressUsedBytes,
          egressBudgetBytes: u.egressBudgetBytes,
        };
      }
      setUsageById(map);
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const handleCreateUser = async () => {
    if (!newEmail || !newPassword) { showToast("Email and password required"); return; }
    setCreating(true);
    const headers = await getAuthHeader();
    const res = await fetch("/api/admin/create-user", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ email: newEmail, password: newPassword, fullName: newName, role: newRole, plan: newPlan }),
    });
    const data = await res.json();
    setCreating(false);
    if (data.error) { showToast(data.error); return; }
    showToast("User created ✓");
    setShowAddModal(false);
    setNewEmail(""); setNewPassword(""); setNewName(""); setNewRole("user"); setNewPlan("free");
    loadUsers();
  };

  const updateUserRole = async (userId: string, role: string) => {
    const headers = await getAuthHeader();
    await fetch("/api/admin/update-role", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role }),
    });
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: role as any } : u));
    showToast("Role updated ✓");
  };

  const updateUserPlan = async (userId: string, plan: string) => {
    const headers = await getAuthHeader();
    await fetch("/api/admin/update-role", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ userId, plan }),
    });
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, plan: plan as any } : u));
    showToast("Plan updated ✓");
  };

  const sendPasswordReset = async (email: string) => {
    const headers = await getAuthHeader();
    const res = await fetch("/api/admin/reset-password", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (data.error) { showToast(data.error); return; }
    showToast(`Reset email sent to ${email} ✓`);
  };

  const handleRemoveUser = async () => {
    if (!userToDelete) return;
    setDeleting(true);
    const headers = await getAuthHeader();
    const res = await fetch("/api/admin/delete-user", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ userId: userToDelete.id }),
    });
    const data = await res.json();
    setDeleting(false);
    if (data.error) { showToast(data.error); return; }
    setUsers(prev => prev.filter(u => u.id !== userToDelete.id));
    setUserToDelete(null);
    showToast("User removed permanently ✓");
  };

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.full_name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  // Semantic colors — encode role/plan identity, not theme
  const roleColor = (role: string) =>
    role === "admin" ? "#FF6B4A" : role === "super_user" ? "#F0A500" : "#6B7280";

  const planColor = (plan: string) =>
    plan === "studio" ? "#F0A500" : plan === "pro" ? "#00B7FF" : "#6B7280";

  if (authorized === false) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: "var(--background)", color: "var(--text)" }}>
        <Navbar accentColor="#00B7FF" />
        <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
          <Shield size={40} style={{ color: "var(--text-muted)" }} />
          <p style={{ color: "var(--text-muted)" }}>You don't have access to this page.</p>
          <button onClick={() => router.push("/projects")} className="text-sm text-[#00B7FF] hover:underline">Go back home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--background)", color: "var(--text)" }}>
      <Navbar accentColor="#00B7FF" />

      <div className="max-w-6xl mx-auto px-8 py-12">

        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold flex items-center gap-3" style={{ color: "var(--text)" }}>
              <Shield size={28} style={{ color: "#FF6B4A" }} />
              Admin Panel
            </h2>
            <p className="mt-1" style={{ color: "var(--text-muted)" }}>Manage users, roles, and plans.</p>
          </div>
          <button onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm"
            style={{ backgroundColor: "#00B7FF", color: "#000" }}>
            <Plus size={16} />
            Add User
          </button>
        </div>

        <input
          type="text" placeholder="Search by name or email..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full rounded-xl px-4 py-3 mb-6 focus:outline-none transition border"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
          onFocus={e => (e.currentTarget.style.borderColor = "#00B7FF")}
          onBlur={e => (e.currentTarget.style.borderColor = "var(--border)")}
        />

        {loading ? (
          <p className="text-center py-12" style={{ color: "var(--text-muted)" }}>Loading users...</p>
        ) : (
          <div className="rounded-2xl overflow-hidden border" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase" style={{ borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }}>
                  <th className="px-5 py-3 font-medium">User</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Plan</th>
                  <th className="px-5 py-3 font-medium">Storage</th>
                  <th className="px-5 py-3 font-medium">Egress (mo)</th>
                  <th className="px-5 py-3 font-medium">Joined</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => (
                  <tr key={u.id} className="transition last:border-0"
                    style={{ borderBottom: "1px solid var(--border)" }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = isDarkMode ? "rgba(31,41,55,0.3)" : "rgba(0,0,0,0.03)")}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>
                    <td className="px-5 py-4">
                      <p className="font-medium" style={{ color: "var(--text)" }}>{u.full_name || "—"}</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{u.email}</p>
                    </td>
                    <td className="px-5 py-4">
                      <select
                        value={u.role}
                        onChange={e => updateUserRole(u.id, e.target.value)}
                        className="rounded-lg px-2 py-1.5 text-xs font-semibold focus:outline-none border"
                        style={{ backgroundColor: inputBg, borderColor: "var(--border)", color: roleColor(u.role) }}
                      >
                        <option value="user">User</option>
                        <option value="super_user">Super User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-5 py-4">
                      <select
                        value={u.plan}
                        onChange={e => updateUserPlan(u.id, e.target.value)}
                        className="rounded-lg px-2 py-1.5 text-xs font-semibold focus:outline-none capitalize border"
                        style={{ backgroundColor: inputBg, borderColor: "var(--border)", color: planColor(u.plan) }}
                      >
                        <option value="free">Free</option>
                        <option value="pro">Pro</option>
                        <option value="studio">Studio</option>
                      </select>
                    </td>
                    <td className="px-5 py-4 min-w-[120px]">
                      {usageById[u.id] ? (() => {
                        const s = usageById[u.id];
                        const pct = Math.min(100, Math.round((s.storageUsedBytes / s.storageBudgetBytes) * 100));
                        const color = pct >= 90 ? "#FF6B4A" : pct >= 70 ? "#F0A500" : "#6B7280";
                        return (
                          <div>
                            <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{formatBytes(s.storageUsedBytes)} / {formatBytes(s.storageBudgetBytes)}</p>
                            <div className="w-full h-1 rounded-full overflow-hidden" style={{ backgroundColor: "var(--background)" }}>
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                            </div>
                          </div>
                        );
                      })() : <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>}
                    </td>
                    <td className="px-5 py-4 min-w-[120px]">
                      {usageById[u.id] ? (() => {
                        const s = usageById[u.id];
                        const pct = Math.min(100, Math.round((s.egressUsedBytes / s.egressBudgetBytes) * 100));
                        const color = pct >= 90 ? "#FF6B4A" : pct >= 70 ? "#F0A500" : "#6B7280";
                        return (
                          <div>
                            <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{formatBytes(s.egressUsedBytes)} / {formatBytes(s.egressBudgetBytes)}</p>
                            <div className="w-full h-1 rounded-full overflow-hidden" style={{ backgroundColor: "var(--background)" }}>
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                            </div>
                          </div>
                        );
                      })() : <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>}
                    </td>
                    <td className="px-5 py-4 text-xs" style={{ color: "var(--text-muted)" }}>
                      {new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => sendPasswordReset(u.email)}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition"
                          style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                          onMouseEnter={e => { e.currentTarget.style.color = "#00B7FF"; e.currentTarget.style.borderColor = "#00B7FF40"; }}
                          onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.borderColor = "var(--border)"; }}>
                          <Mail size={12} />
                          Reset Password
                        </button>
                        <button onClick={() => setUserToDelete(u)}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition"
                          style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                          onMouseEnter={e => { e.currentTarget.style.color = "#FF6B4A"; e.currentTarget.style.borderColor = "#FF6B4A40"; }}
                          onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.borderColor = "var(--border)"; }}>
                          <Trash2 size={12} />
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-8" style={{ color: "var(--text-muted)" }}>No users found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 px-4" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="rounded-2xl p-6 w-full max-w-md border" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold" style={{ color: "var(--text)" }}>Add User</h3>
              <button onClick={() => setShowAddModal(false)} style={{ color: "var(--text-muted)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}>
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>Full Name (optional)</label>
                <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                  className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none border transition"
                  style={{ backgroundColor: inputBg, borderColor: "var(--border)", color: "var(--text)" }}
                  onFocus={e => (e.currentTarget.style.borderColor = "#00B7FF")}
                  onBlur={e => (e.currentTarget.style.borderColor = "var(--border)")}/>
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>Email *</label>
                <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                  className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none border transition"
                  style={{ backgroundColor: inputBg, borderColor: "var(--border)", color: "var(--text)" }}
                  onFocus={e => (e.currentTarget.style.borderColor = "#00B7FF")}
                  onBlur={e => (e.currentTarget.style.borderColor = "var(--border)")}/>
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>Password *</label>
                <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none border transition"
                  style={{ backgroundColor: inputBg, borderColor: "var(--border)", color: "var(--text)" }}
                  onFocus={e => (e.currentTarget.style.borderColor = "#00B7FF")}
                  onBlur={e => (e.currentTarget.style.borderColor = "var(--border)")}/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>Role</label>
                  <select value={newRole} onChange={e => setNewRole(e.target.value as any)}
                    className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none border"
                    style={{ backgroundColor: inputBg, borderColor: "var(--border)", color: "var(--text)" }}>
                    <option value="user">User</option>
                    <option value="super_user">Super User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>Plan</label>
                  <select value={newPlan} onChange={e => setNewPlan(e.target.value as any)}
                    className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none border"
                    style={{ backgroundColor: inputBg, borderColor: "var(--border)", color: "var(--text)" }}>
                    <option value="free">Free</option>
                    <option value="pro">Pro</option>
                    <option value="studio">Studio</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAddModal(false)}
                className="flex-1 py-2.5 rounded-lg border text-sm transition"
                style={{ borderColor: "var(--border)", color: "var(--text)" }}>Cancel</button>
              <button onClick={handleCreateUser} disabled={creating}
                className="flex-1 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50"
                style={{ backgroundColor: "#00B7FF", color: "#000" }}>
                {creating ? "Creating..." : "Create User"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove User Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 flex items-center justify-center z-50 px-4" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="rounded-2xl p-6 w-full max-w-md border" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: "#FF6B4A20" }}>
                <Trash2 size={18} style={{ color: "#FF6B4A" }} />
              </div>
              <h3 className="text-lg font-bold" style={{ color: "var(--text)" }}>Remove user permanently?</h3>
            </div>
            <p className="text-sm mb-2" style={{ color: "var(--text)" }}>
              {userToDelete.full_name || userToDelete.email}
            </p>
            <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
              This deletes their account, all projects, and all audio files. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setUserToDelete(null)} disabled={deleting}
                className="flex-1 py-2.5 rounded-lg border text-sm transition"
                style={{ borderColor: "var(--border)", color: "var(--text)" }}>Cancel</button>
              <button onClick={handleRemoveUser} disabled={deleting}
                className="flex-1 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50"
                style={{ backgroundColor: "#FF6B4A", color: "#000" }}>
                {deleting ? "Removing..." : "Remove Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 rounded-xl px-5 py-3 flex items-center gap-2 shadow-lg z-50 border"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
          <Check size={16} className="text-[#14D8C4]" />
          <span className="text-sm" style={{ color: "var(--text)" }}>{toast}</span>
        </div>
      )}
    </div>
  );
}