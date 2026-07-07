"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Wrench, CreditCard, UserCog, MessageSquareHeart, CircleEllipsis, Send, CheckCircle2, Clock } from "lucide-react";

const ACCENT = "#00B7FF";

const CATEGORIES = [
  { key: "technical", label: "Technical issue", Icon: Wrench },
  { key: "billing", label: "Billing", Icon: CreditCard },
  { key: "account", label: "Account", Icon: UserCog },
  { key: "feedback", label: "Feedback", Icon: MessageSquareHeart },
  { key: "other", label: "Other", Icon: CircleEllipsis },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]["key"];

interface TicketRow {
  id: string;
  category: string;
  subject: string;
  status: string;
  created_at: string;
}

const STATUS_STYLES: Record<string, { label: string; color: string }> = {
  open: { label: "Open", color: "#00B7FF" },
  in_progress: { label: "In progress", color: "#F0A500" },
  resolved: { label: "Resolved", color: "#2DD4BF" },
  closed: { label: "Closed", color: "#9CA3AF" },
};

export default function ContactSupportPage() {
  const [category, setCategory] = useState<CategoryKey>("technical");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [tickets, setTickets] = useState<TicketRow[]>([]);

  const loadTickets = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("support_tickets")
      .select("id, category, subject, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);
    if (data) setTickets(data as TicketRow[]);
  };

  useEffect(() => { loadTickets(); }, []);

  const handleSubmit = async () => {
    setError("");
    if (subject.trim().length < 3) { setError("Give your request a short subject (at least 3 characters)."); return; }
    if (message.trim().length < 10) { setError("Tell us a bit more — at least 10 characters helps us help you."); return; }

    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !user.email) {
      setError("Your session expired. Refresh and sign in again.");
      setSubmitting(false);
      return;
    }

    const { error: insertError } = await supabase.from("support_tickets").insert({
      user_id: user.id,
      email: user.email,
      category,
      subject: subject.trim(),
      message: message.trim(),
    });

    setSubmitting(false);
    if (insertError) {
      console.error("support ticket insert failed:", insertError);
      setError("Couldn't send your request. Try again in a moment.");
      return;
    }

    setSubmitted(true);
    setSubject("");
    setMessage("");
    loadTickets();
  };

  return (
    <div className="max-w-2xl">
      {submitted ? (
        <div className="rounded-2xl p-8 text-center mb-8"
          style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}>
          <CheckCircle2 size={36} className="mx-auto mb-3" style={{ color: "#2DD4BF" }} />
          <h2 className="text-lg font-semibold mb-1"
            style={{ color: "var(--text)", fontFamily: "var(--font-heading)" }}>
            Request sent
          </h2>
          <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>
            We&rsquo;ve got it. You&rsquo;ll hear back at your account email, and the status will update below.
          </p>
          <button
            onClick={() => setSubmitted(false)}
            className="text-sm font-medium"
            style={{ color: ACCENT }}
          >
            Send another request
          </button>
        </div>
      ) : (
        <div className="space-y-6 mb-10">
          {/* Category */}
          <div>
            <p className="text-sm font-medium mb-2" style={{ color: "var(--text)" }}>
              What&rsquo;s this about?
            </p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(({ key, label, Icon }) => {
                const active = category === key;
                return (
                  <button
                    key={key}
                    onClick={() => setCategory(key)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                    style={{
                      color: active ? ACCENT : "var(--text-muted)",
                      border: `1px solid ${active ? `${ACCENT}66` : "var(--border)"}`,
                      backgroundColor: active ? `${ACCENT}12` : "transparent",
                    }}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="text-sm font-medium block mb-2" style={{ color: "var(--text)" }}>
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              maxLength={150}
              placeholder="Stems upload stuck at 90%"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
              style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--text)" }}
              onFocus={e => (e.currentTarget.style.borderColor = ACCENT)}
              onBlur={e => (e.currentTarget.style.borderColor = "var(--border)")}
            />
          </div>

          {/* Message */}
          <div>
            <label className="text-sm font-medium block mb-2" style={{ color: "var(--text)" }}>
              Details
            </label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              maxLength={4000}
              rows={6}
              placeholder="What happened, what you expected, and the project name if it's about a specific project."
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors resize-y"
              style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--text)" }}
              onFocus={e => (e.currentTarget.style.borderColor = ACCENT)}
              onBlur={e => (e.currentTarget.style.borderColor = "var(--border)")}
            />
            <p className="text-[11px] mt-1 text-right" style={{ color: "var(--text-muted)" }}>
              {message.length}/4000
            </p>
          </div>

          {error && (
            <p className="text-sm px-4 py-3 rounded-lg"
              style={{ color: "#FF6B4A", backgroundColor: "#FF6B4A12", border: "1px solid #FF6B4A40" }}>
              {error}
            </p>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: ACCENT }}
          >
            <Send size={15} />
            {submitting ? "Sending..." : "Send request"}
          </button>
        </div>
      )}

      {/* Previous tickets */}
      {tickets.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-3"
            style={{ color: "var(--text-muted)" }}>
            Your recent requests
          </h2>
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            {tickets.map((t, i) => {
              const status = STATUS_STYLES[t.status] ?? STATUS_STYLES.open;
              return (
                <div key={t.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                  style={{ borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>
                      {t.subject}
                    </p>
                    <p className="text-[11px] mt-0.5 flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                      <Clock size={11} />
                      {new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      <span>·</span>
                      <span className="capitalize">{t.category}</span>
                    </p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0"
                    style={{ color: status.color, backgroundColor: `${status.color}15`, border: `1px solid ${status.color}40` }}>
                    {status.label}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}