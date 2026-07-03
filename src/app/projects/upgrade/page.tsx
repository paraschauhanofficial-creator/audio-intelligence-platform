'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Sparkles, Crown, Zap } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import Navbar from '@/components/Navbar';
import AudioBackground from '@/components/AudioBackground';
import { STORAGE_BUDGET, EGRESS_BUDGET } from '@/lib/usageTracking';

function formatBytes(bytes: number) {
  if (bytes <= 0) return '0MB';
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb % 1 === 0 ? mb : mb.toFixed(1)}MB`;
  return `${(mb / 1024).toFixed(mb / 1024 % 1 === 0 ? 0 : 1)}GB`;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const PLANS = [
  {
    key: 'free',
    name: 'Free',
    price: '₹0',
    period: 'forever',
    icon: Sparkles,
    accent: '#a1a1aa',
    projects: '2 total',
    features: ['Mix workflow only', `${formatBytes(STORAGE_BUDGET.free)} storage`, '2 projects total', 'Standard AI mastering'],
    cta: 'Current plan',
  },
  {
    key: 'pro',
    name: 'Pro',
    price: '₹1,799',
    period: '/ month',
    icon: Zap,
    accent: '#00B7FF',
    projects: '5 / month',
    features: ['Everything in Free', 'Stems workflow unlocked', `${formatBytes(STORAGE_BUDGET.pro)} storage`, '5 projects per month', 'Priority AI processing', 'Open DAW access'],
    cta: 'Upgrade to Pro',
    highlighted: true,
  },
  {
    key: 'studio',
    name: 'Studio',
    price: '₹4,599',
    period: '/ month',
    icon: Crown,
    accent: '#14D8C4',
    projects: 'Unlimited',
    features: ['Everything in Pro', `${formatBytes(STORAGE_BUDGET.studio)} storage`, 'Unlimited projects', 'Highest-fidelity mastering', 'Early access to new features'],
    cta: 'Upgrade to Studio',
  },
];

export default function UpgradePage() {
  const router = useRouter();
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);

  // Theme — identical pattern to every other migrated page (see projects/page.tsx)
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [parallax, setParallax]     = useState({ x: 0, y: 0 });

  useEffect(() => {
    const saved = localStorage.getItem("nokashi-theme");
    setIsDarkMode(saved !== "light");
    const observer = new MutationObserver(() => {
      setIsDarkMode(!document.documentElement.classList.contains("theme-light"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * -20;
      const y = (e.clientY / window.innerHeight - 0.5) * -14;
      setParallax({ x, y });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const { data: profile } = await supabase
        .from('profiles').select('plan, role').eq('id', user.id).single();

      if (profile?.role === 'admin' || profile?.role === 'super_user') {
        router.push('/projects/profile');
        return;
      }
      setCurrentPlan(profile?.plan ?? 'free');
      setLoading(false);
    })();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--background)" }}>
        <div style={{ color: "var(--text-muted)" }}>Loading…</div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen" style={{ backgroundColor: "var(--background)" }}>
      <AudioBackground parallax={parallax} lightMode={!isDarkMode} />
      <div className="relative z-20">
        <Navbar accentColor="#00B7FF" />
      </div>

      <main className="relative z-10 max-w-6xl mx-auto px-6 pt-32 pb-24">
        <div className="text-center mb-16">
          <p className="text-xs uppercase tracking-[0.2em] mb-3" style={{ color: "var(--text-muted)" }}>Plans</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4" style={{ color: "var(--text)" }}>Choose your sound</h1>
          <p className="max-w-xl mx-auto" style={{ color: "var(--text-muted)" }}>
            More storage, more projects, faster processing. Upgrade whenever your sessions outgrow Free.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 items-stretch">
          {PLANS.map((plan) => {
            const Icon     = plan.icon;
            const isCurrent = currentPlan === plan.key;
            return (
              <div
                key={plan.key}
                className={`relative rounded-2xl p-8 flex flex-col backdrop-blur-sm border transition-transform ${
                  plan.highlighted ? 'md:-translate-y-3' : ''
                }`}
                style={{
                  backgroundColor: isDarkMode ? "rgba(17,24,39,0.8)" : "rgba(234,228,216,0.85)",
                  // Highlighted card keeps its semantic cyan border — it marks "most popular"
                  borderColor: plan.highlighted ? "rgba(0,183,255,0.6)" : "var(--border)",
                  boxShadow: plan.highlighted ? "0 0 40px -12px #00B7FF" : undefined,
                }}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-[#00B7FF] text-[#0a0a0f]">
                    Most popular
                  </span>
                )}

                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-6"
                  style={{ backgroundColor: `${plan.accent}1A` }}>
                  <Icon className="w-5 h-5" style={{ color: plan.accent }} />
                </div>

                <h2 className="text-xl font-semibold mb-1" style={{ color: "var(--text)" }}>{plan.name}</h2>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-3xl font-bold" style={{ color: "var(--text)" }}>{plan.price}</span>
                  <span className="text-sm" style={{ color: "var(--text-muted)" }}>{plan.period}</span>
                </div>

                <div className="space-y-1.5 mb-6 pb-6 text-xs" style={{ borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }}>
                  <div className="flex justify-between">
                    <span>{formatBytes(STORAGE_BUDGET[plan.key])} storage</span>
                    <span>{plan.projects}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{formatBytes(EGRESS_BUDGET[plan.key])} preview &amp; playback</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm" style={{ color: "var(--text)" }}>
                      <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: plan.accent }} />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  disabled={isCurrent}
                  className="w-full py-3 rounded-lg text-sm font-medium transition-colors"
                  style={isCurrent
                    ? { backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", color: "var(--text-muted)", cursor: "default" }
                    : { backgroundColor: plan.accent, color: "#0a0a0f" }}
                  onClick={() => { console.log(`TODO: start checkout for ${plan.key}`); }}
                >
                  {isCurrent ? 'Current plan' : plan.cta}
                </button>
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs mt-12" style={{ color: "var(--text-muted)" }}>
          Storage and monthly preview &amp; playback limits are enforced — your plan determines how much you can store and stream each month.
        </p>
      </main>
    </div>
  );
}