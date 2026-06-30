"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import { Shield, Crown, User as UserIcon, Plus, Mail, X, Check } from "lucide-react";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "super_user" | "user";
  plan: "free" | "pro" | "studio";
  created_at: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [toast, setToast] = useState("");

  // Add user form state
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<"user" | "super_user" | "admin">("user");
  const [newPlan, setNewPlan] = useState<"free" | "pro" | "studio">("free");
  const [creating, setCreating] = useState(false);

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
    await loadUsers();
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

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.full_name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const roleColor = (role: string) =>
    role === "admin" ? "#FF6B4A" : role === "super_user" ? "#F0A500" : "#6B7280";

  const planColor = (plan: string) =>
    plan === "studio" ? "#F0A500" : plan === "pro" ? "#00B7FF" : "#6B7280";

  if (authorized === false) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white">
        <Navbar accentColor="#00B7FF" />
        <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
          <Shield size={40} className="text-zinc-700" />
          <p className="text-zinc-500">You don't have access to this page.</p>
          <button onClick={() => router.push("/projects")} className="text-sm text-[#00B7FF] hover:underline">Go back home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <Navbar accentColor="#00B7FF" />

      <div className="max-w-6xl mx-auto px-8 py-12">

        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold flex items-center gap-3">
              <Shield size={28} style={{ color: "#FF6B4A" }} />
              Admin Panel
            </h2>
            <p className="text-zinc-500 mt-1">Manage users, roles, and plans.</p>
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
          className="w-full bg-[#111827] border border-[#1F2937] rounded-xl px-4 py-3 mb-6 focus:outline-none focus:border-[#00B7FF] transition"
        />

        {loading ? (
          <p className="text-zinc-500 text-center py-12">Loading users...</p>
        ) : (
          <div className="bg-[#111827] border border-[#1F2937] rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1F2937] text-left text-zinc-500 text-xs uppercase">
                  <th className="px-5 py-3 font-medium">User</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Plan</th>
                  <th className="px-5 py-3 font-medium">Joined</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => (
                  <tr key={u.id} className="border-b border-[#1F2937] last:border-0 hover:bg-[#1F293720] transition">
                    <td className="px-5 py-4">
                      <p className="font-medium text-zinc-200">{u.full_name || "—"}</p>
                      <p className="text-xs text-zinc-500">{u.email}</p>
                    </td>
                    <td className="px-5 py-4">
                      <select
                        value={u.role}
                        onChange={e => updateUserRole(u.id, e.target.value)}
                        className="bg-[#0A0A0A] border border-[#1F2937] rounded-lg px-2 py-1.5 text-xs font-semibold focus:outline-none"
                        style={{ color: roleColor(u.role) }}
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
                        className="bg-[#0A0A0A] border border-[#1F2937] rounded-lg px-2 py-1.5 text-xs font-semibold focus:outline-none capitalize"
                        style={{ color: planColor(u.plan) }}
                      >
                        <option value="free">Free</option>
                        <option value="pro">Pro</option>
                        <option value="studio">Studio</option>
                      </select>
                    </td>
                    <td className="px-5 py-4 text-zinc-500 text-xs">
                      {new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button onClick={() => sendPasswordReset(u.email)}
                        className="flex items-center gap-1.5 ml-auto text-xs text-zinc-400 hover:text-[#00B7FF] transition px-3 py-1.5 rounded-lg border border-[#1F2937] hover:border-[#00B7FF40]">
                        <Mail size={12} />
                        Reset Password
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr><td colSpan={5} className="text-center text-zinc-600 py-8">No users found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold">Add User</h3>
              <button onClick={() => setShowAddModal(false)} className="text-zinc-500 hover:text-zinc-300">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">Full Name (optional)</label>
                <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-[#1F2937] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#00B7FF]"/>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">Email *</label>
                <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-[#1F2937] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#00B7FF]"/>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">Password *</label>
                <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full bg-[#0A0A0A] border border-[#1F2937] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#00B7FF]"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">Role</label>
                  <select value={newRole} onChange={e => setNewRole(e.target.value as any)}
                    className="w-full bg-[#0A0A0A] border border-[#1F2937] rounded-lg px-3 py-2.5 text-sm focus:outline-none">
                    <option value="user">User</option>
                    <option value="super_user">Super User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">Plan</label>
                  <select value={newPlan} onChange={e => setNewPlan(e.target.value as any)}
                    className="w-full bg-[#0A0A0A] border border-[#1F2937] rounded-lg px-3 py-2.5 text-sm focus:outline-none">
                    <option value="free">Free</option>
                    <option value="pro">Pro</option>
                    <option value="studio">Studio</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAddModal(false)}
                className="flex-1 py-2.5 rounded-lg border border-[#1F2937] text-sm">Cancel</button>
              <button onClick={handleCreateUser} disabled={creating}
                className="flex-1 py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50"
                style={{ backgroundColor: "#00B7FF", color: "#000" }}>
                {creating ? "Creating..." : "Create User"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-[#111827] border border-[#1F2937] rounded-xl px-5 py-3 flex items-center gap-2 shadow-lg z-50">
          <Check size={16} className="text-[#14D8C4]" />
          <span className="text-sm">{toast}</span>
        </div>
      )}
    </div>
  );
}