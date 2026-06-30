'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Sparkles, Crown, Zap } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import Navbar from '@/components/Navbar';
import AudioBackground from '@/components/AudioBackground';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Mirrors PLAN_LIMITS on the Profile page — keep these two in sync.
const PLANS = [
  {
    key: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    icon: Sparkles,
    accent: '#a1a1aa',
    storage: '1GB',
    projects: '3 / month',
    features: ['Mix & Stems workflows', '1GB storage', '3 projects per month', 'Standard AI mastering'],
    cta: 'Current plan',
  },
  {
    key: 'pro',
    name: 'Pro',
    price: '$19',
    period: '/ month',
    icon: Zap,
    accent: '#00B7FF',
    storage: '25GB',
    projects: 'Unlimited',
    features: ['Everything in Free', '25GB storage', 'Unlimited projects', 'Priority AI processing', 'Open DAW access'],
    cta: 'Upgrade to Pro',
    highlighted: true,
  },
  {
    key: 'studio',
    name: 'Studio',
    price: '$49',
    period: '/ month',
    icon: Crown,
    accent: '#14D8C4',
    storage: '100GB',
    projects: 'Unlimited',
    features: ['Everything in Pro', '100GB storage', 'Unlimited projects', 'Highest-fidelity mastering', 'Early access to new features'],
    cta: 'Upgrade to Studio',
  },
];

export default function UpgradePage() {
  const router = useRouter();
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('plan, role')
        .eq('id', user.id)
        .single();

      // admin / super_user already have unlimited access — bounce to Profile
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
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-[#a1a1aa]">Loading…</div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#0a0a0f]">
      <AudioBackground />
      <Navbar accentColor="#00B7FF" />

      <main className="relative z-10 max-w-6xl mx-auto px-6 pt-32 pb-24">
        <div className="text-center mb-16">
          <p className="text-xs uppercase tracking-[0.2em] text-[#a1a1aa] mb-3">Plans</p>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Choose your sound</h1>
          <p className="text-[#a1a1aa] max-w-xl mx-auto">
            More storage, more projects, faster processing. Upgrade whenever your sessions outgrow Free.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 items-stretch">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            const isCurrent = currentPlan === plan.key;
            return (
              <div
                key={plan.key}
                className={`relative rounded-2xl p-8 flex flex-col bg-[#111827]/80 backdrop-blur-sm border transition-transform ${
                  plan.highlighted
                    ? 'border-[#00B7FF]/60 md:-translate-y-3 shadow-[0_0_40px_-12px_#00B7FF]'
                    : 'border-white/10'
                }`}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-[#00B7FF] text-[#0a0a0f]">
                    Most popular
                  </span>
                )}

                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-6"
                  style={{ backgroundColor: `${plan.accent}1A` }}
                >
                  <Icon className="w-5 h-5" style={{ color: plan.accent }} />
                </div>

                <h2 className="text-xl font-semibold text-white mb-1">{plan.name}</h2>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-3xl font-bold text-white">{plan.price}</span>
                  <span className="text-sm text-[#a1a1aa]">{plan.period}</span>
                </div>

                <div className="flex justify-between text-xs text-[#a1a1aa] mb-6 pb-6 border-b border-white/10">
                  <span>{plan.storage} storage</span>
                  <span>{plan.projects}</span>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-[#d4d4d8]">
                      <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: plan.accent }} />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  disabled={isCurrent}
                  className={`w-full py-3 rounded-lg text-sm font-medium transition-colors ${
                    isCurrent
                      ? 'bg-white/5 text-[#a1a1aa] cursor-default'
                      : 'text-[#0a0a0f]'
                  }`}
                  style={!isCurrent ? { backgroundColor: plan.accent } : undefined}
                  onClick={() => {
                    // Billing/checkout not wired yet — placeholder action.
                    console.log(`TODO: start checkout for ${plan.key}`);
                  }}
                >
                  {isCurrent ? 'Current plan' : plan.cta}
                </button>
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-[#a1a1aa] mt-12">
          Plan limits are not yet enforced anywhere in the app — this page is the storefront only.
        </p>
      </main>
    </div>
  );
}