'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { signIn } from 'next-auth/react';
import {
  FiCheckCircle, FiCircle, FiRefreshCw, FiArrowRight,
  FiMail, FiSmartphone, FiShield, FiLock,
} from 'react-icons/fi';

// ─── Types ───────────────────────────────────────────────────────────────────

interface VerificationFlags {
  emailVerified: boolean;
  hasGoogleAuth: boolean;
  hasDiscordAuth: boolean;
  hasGithubAuth: boolean;
  hasVerifiedWallet: boolean;
  hasWeb2Payment: boolean;
  hasWeb3Payment: boolean;
  phoneVerified: boolean;
  isTwoFactorEnabled: boolean;
}

interface VerificationData {
  flags: VerificationFlags;
  tier: string;
  score: number;
  multiplier: number;
  linkedProviders: string[];
  phoneNumber: string | null;
}

// ─── Tier display metadata ───────────────────────────────────────────────────

const TIER_DISPLAY: Record<string, { label: string; icon: string; color: string; description: string }> = {
  ANONYMOUS:        { label: 'Anonymous',         icon: '👤', color: '#6b7280', description: 'Not logged in'                   },
  WALLET_ONLY:      { label: 'Wallet Connected',  icon: '🔗', color: '#8b5cf6', description: 'Web3 wallet connected'           },
  WEB2_BASIC:       { label: 'Email Verified',    icon: '📧', color: '#3b82f6', description: 'Email address confirmed'          },
  WEB3_BASIC:       { label: 'Web3 Basic',        icon: '⛓️', color: '#7c3aed', description: 'Wallet with signed message'      },
  SOCIAL_BASIC:     { label: 'Social Connected',  icon: '🔵', color: '#06b6d4', description: 'Discord or GitHub OAuth'         },
  SOCIAL_VERIFIED:  { label: 'Social Verified',   icon: '✓',  color: '#10b981', description: 'Google OAuth verified'           },
  MULTI_SOCIAL:     { label: 'Multi-Social',      icon: '🔗', color: '#14b8a6', description: '2+ OAuth providers linked'       },
  WEB2_PAYMENT:     { label: 'Payment Verified',  icon: '💳', color: '#f59e0b', description: 'Card payment on file'            },
  WEB3_VERIFIED:    { label: 'Web3 Verified',     icon: '🏆', color: '#8b5cf6', description: 'Google + Verified wallet'        },
  WEB3_PAYMENT:     { label: 'Crypto Payments',   icon: '₿',  color: '#f97316', description: 'Crypto transaction verified'     },
  PAYMENT_VERIFIED: { label: 'Full Payment',      icon: '💰', color: '#eab308', description: 'Multiple payment methods'        },
  PHONE_VERIFIED:   { label: 'Phone Verified',    icon: '📱', color: '#22c55e', description: 'SMS verification complete'       },
  FULLY_VERIFIED:   { label: 'Fully Verified',    icon: '⭐', color: '#fbbf24', description: 'All methods verified (bonus!)' },
};

// Tier ordering for progress display
const TIER_ORDER = [
  'ANONYMOUS', 'WALLET_ONLY', 'WEB2_BASIC', 'WEB3_BASIC', 'SOCIAL_BASIC',
  'SOCIAL_VERIFIED', 'MULTI_SOCIAL', 'WEB2_PAYMENT', 'WEB3_VERIFIED',
  'WEB3_PAYMENT', 'PAYMENT_VERIFIED', 'PHONE_VERIFIED', 'FULLY_VERIFIED',
];

// ─── Checklist item definitions ──────────────────────────────────────────────

interface ChecklistItem {
  key: keyof VerificationFlags;
  label: string;
  description: string;
  points: number;
  icon: string;
  action?: 'google' | 'github' | 'discord' | 'wallet' | 'phone' | 'purchase' | '2fa';
}

const CHECKLIST: ChecklistItem[] = [
  { key: 'emailVerified',      label: 'Verify Email',           description: 'Confirm your email address',                    points: 10,  icon: '📧' },
  { key: 'hasGoogleAuth',      label: 'Link Google',            description: 'Connect your Google account',                   points: 20,  icon: '🔴', action: 'google' },
  { key: 'hasGithubAuth',      label: 'Link GitHub',            description: 'Connect your GitHub account',                   points: 12,  icon: '⚫', action: 'github' },
  { key: 'hasDiscordAuth',     label: 'Link Discord',           description: 'Connect your Discord account',                  points: 10,  icon: '🟣', action: 'discord' },
  { key: 'hasVerifiedWallet',  label: 'Verify Wallet',          description: 'Connect and sign with your crypto wallet',      points: 15,  icon: '⛓️', action: 'wallet' },
  { key: 'hasWeb2Payment',     label: 'Make a Card Purchase',   description: 'Complete a purchase with Vipps/Klarna/PayPal',  points: 15,  icon: '💳', action: 'purchase' },
  { key: 'hasWeb3Payment',     label: 'Make a Crypto Purchase', description: 'Complete a purchase with cryptocurrency',       points: 15,  icon: '₿',  action: 'purchase' },
  { key: 'phoneVerified',      label: 'Verify Phone',           description: 'Confirm your phone number via SMS',             points: 20,  icon: '📱', action: 'phone' },
  { key: 'isTwoFactorEnabled', label: 'Enable 2FA',             description: 'Enable two-factor authentication',              points: 5,   icon: '🔐', action: '2fa' },
];

// ─── Phone Verification Sub-component ────────────────────────────────────────

function PhoneVerificationFlow({
  onVerified,
}: {
  onVerified: () => void;
}) {
  const [step, setStep] = useState<'input' | 'verify'>('input');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+47');
  const [code, setCode] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState(3);
  const [cooldown, setCooldown] = useState(0);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handleSend = async () => {
    if (!phone || phone.length < 8) {
      toast.error('Enter a valid phone number');
      return;
    }
    setIsPending(true);
    try {
      const res = await fetch('/api/auth/phone/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone, countryCode }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message || data.error || 'Failed to send code');
        if (data.retryAfterSeconds) setCooldown(data.retryAfterSeconds);
        return;
      }

      toast.success('Verification code sent!');
      setStep('verify');
      setCooldown(60);
    } catch {
      toast.error('Failed to send verification code');
    } finally {
      setIsPending(false);
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      toast.error('Enter the 6-digit code');
      return;
    }
    setIsPending(true);
    try {
      const res = await fetch('/api/auth/phone/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message || data.error || 'Invalid code');
        if (data.attemptsRemaining != null) setAttemptsRemaining(data.attemptsRemaining);
        return;
      }

      toast.success('Phone verified!');
      onVerified();
    } catch {
      toast.error('Verification failed');
    } finally {
      setIsPending(false);
    }
  };

  if (step === 'input') {
    return (
      <div className="space-y-3 mt-3">
        <div className="flex gap-2">
          <select
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
            className="w-24 rounded-lg border border-border bg-white/70 px-2 py-2 text-sm dark:bg-white/5 dark:border-white/10"
          >
            <option value="+47">🇳🇴 +47</option>
            <option value="+46">🇸🇪 +46</option>
            <option value="+45">🇩🇰 +45</option>
            <option value="+44">🇬🇧 +44</option>
            <option value="+1">🇺🇸 +1</option>
            <option value="+49">🇩🇪 +49</option>
          </select>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
            placeholder="Phone number"
            className="flex-1 bg-white/70 border-border dark:bg-white/5 dark:border-white/10"
            maxLength={15}
          />
        </div>
        <Button
          size="sm"
          onClick={handleSend}
          disabled={isPending || cooldown > 0}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
        >
          {isPending ? 'Sending...' : cooldown > 0 ? `Retry in ${cooldown}s` : 'Send Code'}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 mt-3">
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="6-digit code"
        className="text-center text-lg tracking-widest bg-white/70 border-border dark:bg-white/5 dark:border-white/10"
        maxLength={6}
      />
      <p className="text-xs text-muted-foreground dark:text-white/40">
        {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''} remaining
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => { setStep('input'); setCode(''); }}
          className="flex-1"
        >
          Back
        </Button>
        <Button
          size="sm"
          onClick={handleVerify}
          disabled={isPending || code.length !== 6}
          className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white"
        >
          {isPending ? 'Verifying...' : 'Verify'}
        </Button>
      </div>
      {cooldown === 0 && (
        <button
          onClick={handleSend}
          disabled={isPending}
          className="text-xs text-blue-500 hover:underline w-full text-center"
        >
          Resend code
        </button>
      )}
    </div>
  );
}

// ─── Main Verification Dashboard ─────────────────────────────────────────────

export function VerificationDashboard() {
  const [data, setData] = useState<VerificationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [expandedAction, setExpandedAction] = useState<string | null>(null);

  const fetchVerification = useCallback(async () => {
    try {
      const res = await fetch('/api/users/verification');
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json);
    } catch {
      toast.error('Failed to load verification data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVerification();
  }, [fetchVerification]);

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try {
      const res = await fetch('/api/users/verification', { method: 'POST' });
      if (!res.ok) throw new Error();
      toast.success('Verification recalculated');
      await fetchVerification();
    } catch {
      toast.error('Recalculation failed');
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleAction = (item: ChecklistItem) => {
    switch (item.action) {
      case 'google':
        signIn('google');
        break;
      case 'github':
        signIn('github');
        break;
      case 'discord':
        toast.info('Discord OAuth is not configured yet');
        break;
      case 'wallet':
        // Navigate to wallet section or open wallet modal
        window.location.href = '/settings?section=account';
        toast.info('Connect your wallet in the Account section');
        break;
      case 'purchase':
        window.location.href = '/products';
        break;
      case '2fa':
        window.location.href = '/settings?section=security';
        break;
      case 'phone':
        setExpandedAction(expandedAction === 'phone' ? null : 'phone');
        break;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-32 bg-white/5 rounded-xl" />
        <div className="h-48 bg-white/5 rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-muted-foreground dark:text-white/40">
        <p>Unable to load verification data.</p>
        <Button variant="outline" size="sm" onClick={fetchVerification} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  const tierInfo = TIER_DISPLAY[data.tier] ?? TIER_DISPLAY.ANONYMOUS;
  const tierIndex = TIER_ORDER.indexOf(data.tier);
  const completedSteps = CHECKLIST.filter(i => data.flags[i.key]).length;
  const totalSteps = CHECKLIST.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-border pb-6 dark:border-white/10">
        <h2 className="text-xl font-semibold text-foreground dark:text-white flex items-center gap-2">
          <FiShield className="text-emerald-500" />
          Verification & Trust
        </h2>
        <p className="text-sm text-muted-foreground dark:text-white/50 mt-1">
          Increase your verification level to boost your Reach multiplier and unlock more features
        </p>
      </div>

      {/* Tier Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border p-6"
        style={{
          borderColor: tierInfo.color + '40',
          background: `linear-gradient(135deg, ${tierInfo.color}08, ${tierInfo.color}15)`,
        }}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div
              className="flex items-center justify-center w-16 h-16 rounded-2xl text-3xl"
              style={{ backgroundColor: tierInfo.color + '20' }}
            >
              {tierInfo.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold" style={{ color: tierInfo.color }}>
                  {tierInfo.label}
                </h3>
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-bold"
                  style={{
                    backgroundColor: tierInfo.color + '20',
                    color: tierInfo.color,
                  }}
                >
                  {data.multiplier}x
                </span>
              </div>
              <p className="text-sm text-muted-foreground dark:text-white/50 mt-0.5">
                {tierInfo.description}
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleRecalculate}
            disabled={isRecalculating}
            className="text-muted-foreground hover:text-foreground"
            title="Recalculate verification tier"
          >
            <FiRefreshCw className={`w-4 h-4 ${isRecalculating ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Score progress bar */}
        <div className="mt-5">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-muted-foreground dark:text-white/40">
              Verification Score
            </span>
            <span className="font-mono font-bold" style={{ color: tierInfo.color }}>
              {data.score}/100
            </span>
          </div>
          <div className="w-full h-2.5 bg-white/10 dark:bg-white/5 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${data.score}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{ backgroundColor: tierInfo.color }}
            />
          </div>
        </div>

        {/* Tier Progress Strip */}
        <div className="mt-4 flex items-center gap-1">
          {TIER_ORDER.map((t, i) => {
            const info = TIER_DISPLAY[t];
            const isCurrent = t === data.tier;
            const isPast = i < tierIndex;
            return (
              <div
                key={t}
                className="relative group flex-1"
                title={`${info?.label}: ${(
                  (i / (TIER_ORDER.length - 1)) * 1.2
                ).toFixed(2)}x`}
              >
                <div
                  className={`h-1.5 rounded-full transition-all ${
                    isCurrent ? 'ring-2 ring-offset-1' : ''
                  }`}
                  style={{
                    backgroundColor: isPast || isCurrent
                      ? info?.color ?? '#6b7280'
                      : 'rgba(255,255,255,0.08)',
                    ...(isCurrent ? { '--tw-ring-color': info?.color } as React.CSSProperties : {}),
                  }}
                />
                {isCurrent && (
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs">
                    {info?.icon}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground dark:text-white/30 mt-1">
          <span>0.1x</span>
          <span>1.2x</span>
        </div>
      </motion.div>

      {/* Verification Checklist */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground dark:text-white/80 mb-3">
          Verification Checklist — {completedSteps}/{totalSteps} complete
        </h3>

        {CHECKLIST.map((item) => {
          const isComplete = data.flags[item.key];
          const isExpanded = expandedAction === item.action;

          return (
            <div key={item.key}>
              <div
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  isComplete
                    ? 'bg-emerald-500/5 border-emerald-500/20'
                    : 'bg-white/50 border-border hover:border-blue-500/30 dark:bg-white/[0.02] dark:border-white/10 dark:hover:border-white/20'
                }`}
              >
                {/* Status icon */}
                <div className="flex-shrink-0">
                  {isComplete ? (
                    <FiCheckCircle className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <FiCircle className="w-5 h-5 text-muted-foreground/40 dark:text-white/20" />
                  )}
                </div>

                {/* Icon */}
                <span className="text-lg flex-shrink-0">{item.icon}</span>

                {/* Label & description */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${
                    isComplete
                      ? 'text-emerald-600 dark:text-emerald-400 line-through'
                      : 'text-foreground dark:text-white/90'
                  }`}>
                    {item.label}
                  </p>
                  <p className="text-xs text-muted-foreground dark:text-white/40 truncate">
                    {item.description}
                  </p>
                </div>

                {/* Points badge */}
                <span className={`text-xs font-mono px-2 py-0.5 rounded-full flex-shrink-0 ${
                  isComplete
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'bg-white/80 text-muted-foreground dark:bg-white/5 dark:text-white/40'
                }`}>
                  +{item.points}
                </span>

                {/* Action button */}
                {!isComplete && item.action && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAction(item)}
                    className="flex-shrink-0 text-blue-500 hover:text-blue-400 hover:bg-blue-500/10"
                  >
                    {item.action === 'phone' && isExpanded ? 'Close' : 'Start'}
                    <FiArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                )}
              </div>

              {/* Phone verification flow (inline) */}
              <AnimatePresence>
                {item.action === 'phone' && isExpanded && !isComplete && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden px-3 pb-3"
                  >
                    <div className="ml-11 border-l-2 border-emerald-500/20 pl-4">
                      <PhoneVerificationFlow
                        onVerified={() => {
                          setExpandedAction(null);
                          fetchVerification();
                        }}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Linked Accounts Overview */}
      {data.linkedProviders.length > 0 && (
        <div className="p-4 rounded-xl border border-border bg-white/50 dark:border-white/10 dark:bg-white/[0.02]">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground dark:text-white/40 mb-3">
            Linked Accounts
          </h4>
          <div className="flex flex-wrap gap-2">
            {data.linkedProviders.map((p) => (
              <span
                key={p}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              >
                <FiCheckCircle className="w-3 h-3" />
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Reach Impact Explainer */}
      <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5">
        <h4 className="text-sm font-semibold text-blue-400 flex items-center gap-2 mb-2">
          <FiShield className="w-4 h-4" />
          How Verification Affects Your Reach
        </h4>
        <div className="text-xs text-muted-foreground dark:text-white/50 space-y-1.5">
          <p>
            Your verification tier directly multiplies your <strong>Reach score</strong>. 
            Higher tiers mean your views, engagements, and poll votes carry more weight.
          </p>
          <p>
            Your current <strong>{data.multiplier}x</strong> multiplier means every view 
            you generate is worth <strong>{(data.multiplier * 100).toFixed(0)}%</strong> of 
            its base value. Fully verified users get a <strong>1.2x bonus</strong>.
          </p>
          <p className="text-blue-400/60">
            Cross-verifying with multiple methods (OAuth + wallet + payment + phone) 
            makes your identity exponentially harder to fake.
          </p>
        </div>
      </div>
    </div>
  );
}
