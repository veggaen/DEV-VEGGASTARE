'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authErrorMessage } from '@/lib/auth-errors';
import { isOAuthProvider, OAUTH_PROVIDERS, oauthLinkState, oauthLinkFeedback, type OAuthProvider } from '@/lib/oauth-link-state';
import { confirmOauthLink, resendOauthConfirmation, unlinkOauthProvider } from '@/actions/oauth-links';
import {
  FiCheckCircle, FiCircle, FiRefreshCw, FiArrowRight,
  FiMail, FiSmartphone, FiShield, FiLock, FiXCircle,
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
  pendingProviders: string[];
  phoneNumber: string | null;
}

// ─── Tier display metadata ───────────────────────────────────────────────────

const TIER_DISPLAY: Record<string, { label: string; icon: string; color: string; description: string }> = {
  ANONYMOUS:        { label: 'Unverified',        icon: '👤', color: '#6b7280', description: 'No verification tier recorded yet' },
  WALLET_ONLY:      { label: 'Wallet Connected',  icon: '🔗', color: '#8b5cf6', description: 'Web3 wallet connected'           },
  WEB2_BASIC:       { label: 'Email Verified',    icon: '📧', color: '#3b82f6', description: 'Email address confirmed'          },
  WEB3_BASIC:       { label: 'Web3 Basic',        icon: '⛓️', color: '#7c3aed', description: 'Wallet with signed message'      },
  SOCIAL_BASIC:     { label: 'Social Connected',  icon: '🔵', color: '#06b6d4', description: 'Discord or GitHub OAuth'         },
  SOCIAL_VERIFIED:  { label: 'Social Verified',   icon: '✓',  color: '#10b981', description: 'Google OAuth verified'           },
  MULTI_SOCIAL:     { label: 'Multi-Social',      icon: '🔗', color: '#14b8a6', description: '2+ OAuth providers linked'       },
  WEB2_PAYMENT:     { label: 'Payment Verified',  icon: '💳', color: '#f59e0b', description: 'Verified Live PayPal purchase'   },
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
  { key: 'hasWeb2Payment',     label: 'Make a PayPal Purchase', description: 'Complete a verified PayPal purchase',          points: 15,  icon: '💳', action: 'purchase' },
  { key: 'hasWeb3Payment',     label: 'Crypto payment verification', description: 'Unavailable — server verification is not configured', points: 15, icon: '₿' },
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
            aria-label="Country calling code"
            autoComplete="tel-country-code"
            onChange={(e) => setCountryCode(e.target.value)}
            className="w-24 rounded-lg border border-border bg-surface-1/70 px-2 py-2 text-sm dark:bg-foreground/[0.05]"
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
            aria-label="Phone number"
            type="tel"
            autoComplete="tel-national"
            inputMode="tel"
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
            placeholder="Phone number"
            className="flex-1 bg-surface-1/70 border-border dark:bg-foreground/[0.05]"
            maxLength={15}
          />
        </div>
        <Button
          size="sm"
          onClick={handleSend}
          disabled={isPending || cooldown > 0}
          className="w-full bg-brand-accent-hover hover:bg-brand-accent text-brand-accent-foreground"
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
        aria-label="Verification code"
        autoComplete="one-time-code"
        inputMode="numeric"
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="6-digit code"
        className="text-center text-lg tracking-widest bg-surface-1/70 border-border dark:bg-foreground/[0.05]"
        maxLength={6}
      />
      <p className="text-xs text-muted-foreground">
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
          className="flex-1 bg-brand-accent-hover hover:bg-brand-accent text-brand-accent-foreground"
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
  const [availableProviders, setAvailableProviders] = useState<Record<string, boolean>>({});
  const [unlinking, setUnlinking] = useState<string | null>(null);
  const [linking, setLinking] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const reducedMotion = useReducedMotion();
  const router = useRouter();
  const searchParams = useSearchParams();
  const handledOauthFeedbackRef = useRef(false);
  const oauthToken = searchParams.get('oauthToken');
  const denyLink = searchParams.get('oauthIntent') === 'deny';

  const fetchVerification = useCallback(async () => {
    try {
      const res = await fetch('/api/users/verification', { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json);
      return json as VerificationData;
    } catch {
      toast.error('Failed to load verification data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVerification();
  }, [fetchVerification]);

  useEffect(() => {
    let mounted = true;

    fetch('/api/auth/providers')
      .then((res) => (res.ok ? res.json() : {} as Record<string, unknown>))
      .then((providers: Record<string, unknown>) => {
        if (!mounted) return;
        setAvailableProviders({
          google: Boolean(providers?.google),
          github: Boolean(providers?.github),
          discord: Boolean(providers?.discord),
        });
      })
      .catch(() => {
        if (!mounted) return;
        setAvailableProviders({});
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Handle OAuth error redirects (from proxy.ts intercept) and email-confirmed links
  useEffect(() => {
    if (handledOauthFeedbackRef.current || !data) return;

    const oauthError   = searchParams.get('oauthError');
    const oauthConfirm = searchParams.get('oauthConfirm');

    if (!oauthError && !oauthConfirm) return;
    handledOauthFeedbackRef.current = true;

    if (oauthError) {
      setFeedback(authErrorMessage(oauthError) ?? 'Linking did not finish. Please try again.');
    }

    if (oauthConfirm) {
      setFeedback(isOAuthProvider(oauthConfirm) ? oauthLinkFeedback(oauthConfirm, data)
        : oauthConfirm === 'denied' ? 'Review your connected accounts below.'
        : 'This confirmation link is invalid or expired. Request a new confirmation email.');
    }

    router.replace('/settings?section=verification', { scroll: false });
  }, [data, router, searchParams]);

  // Detect that user just returned from Discord/GitHub/Google OAuth flow
  useEffect(() => {
    if (!data || searchParams.get('oauthError') || searchParams.get('oauthConfirm')) return;
    try {
      const pending = sessionStorage.getItem('pendingOauthLink');
      sessionStorage.removeItem('pendingOauthLink');
      if (isOAuthProvider(pending)) setFeedback(oauthLinkFeedback(pending, data));
    } catch { /* Storage may be disabled; server state still renders correctly. */ }
  }, [data, searchParams]);

  const handleEmailConfirmation = async () => {
    if (!oauthToken || linking) return;
    setLinking('confirmation');
    try {
      const result = await confirmOauthLink({ token: oauthToken, deny: denyLink });
      if (!result.ok) { setFeedback(result.error); return; }
      setFeedback(`${OAUTH_PROVIDERS[result.provider].label} ${denyLink ? 'was disconnected.' : 'is now verified.'}`);
      router.replace('/settings?section=verification', { scroll: false });
      await fetchVerification();
    } catch { setFeedback('The link could not be updated. Please try again.'); }
    finally { setLinking(null); }
  };

  const handleResend = async (provider: OAuthProvider) => {
    if (linking) return;
    setLinking(provider);
    try {
      const result = await resendOauthConfirmation(provider);
      setFeedback(result.ok ? result.verified ? `${OAUTH_PROVIDERS[provider].label} is already verified.`
        : 'Confirmation email requested. Check your inbox and spam folder.' : result.error);
      await fetchVerification();
    } catch { setFeedback('The confirmation email could not be sent. Please try again shortly.'); }
    finally { setLinking(null); }
  };

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try {
      if (await fetchVerification()) toast.success('Verification refreshed');
    } catch {
      toast.error('Recalculation failed');
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleUnlink = async (provider: string) => {
    if (!isOAuthProvider(provider)) return;
    const label = OAUTH_PROVIDERS[provider].label;
    if (!confirm(`Unlink ${label}? This will remove the OAuth connection and lower your verification score.`)) return;
    setUnlinking(provider);
    try {
      const result = await unlinkOauthProvider(provider);
      if (!result.ok) { setFeedback(result.error); return; }
      toast.success(`${label} unlinked successfully`);
      await fetchVerification();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to unlink provider');
    } finally {
      setUnlinking(null);
    }
  };

  const handleAction = async (item: ChecklistItem) => {
    const verificationCallbackUrl = '/settings?section=verification';
    const requireProvider = (provider: 'google' | 'github' | 'discord') => {
      if (!availableProviders[provider]) {
        toast.error(`${provider.charAt(0).toUpperCase() + provider.slice(1)} OAuth is not configured in this environment`);
        return false;
      }
      return true;
    };

    if (isOAuthProvider(item.action)) {
      if (linking || !requireProvider(item.action)) return;
      setLinking(item.action);
      try {
        try { sessionStorage.setItem('pendingOauthLink', item.action); } catch { /* Optional UI hint. */ }
        await signIn(item.action, { callbackUrl: verificationCallbackUrl });
      } catch { setFeedback('Could not start account linking. Please try again.'); setLinking(null); }
      return;
    }
    switch (item.action) {
      case 'wallet':
        router.push('/settings?section=wallet');
        toast.info('Connect and verify your wallet in the Wallet section');
        break;
      case 'purchase':
        router.push('/products');
        break;
      case '2fa':
        router.push('/settings?section=security');
        break;
      case 'phone':
        setExpandedAction(expandedAction === 'phone' ? null : 'phone');
        break;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-32 bg-foreground/[0.05] rounded-xl" />
        <div className="h-48 bg-foreground/[0.05] rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Unable to load verification data.</p>
        <Button variant="outline" size="sm" onClick={fetchVerification} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  const tierInfo = TIER_DISPLAY[data.tier] ?? TIER_DISPLAY.ANONYMOUS;
  const tierIndex = TIER_ORDER.indexOf(data.tier);
  const completedSteps = CHECKLIST.filter(i => isOAuthProvider(i.action) ? oauthLinkState(i.action, data) === 'verified' : data.flags[i.key]).length;
  const totalSteps = CHECKLIST.length;

  return (
    <div className="space-y-6">
      {feedback && <p role="status" aria-live="polite" className="rounded-xl border border-border bg-foreground/[0.05] p-4 text-sm text-foreground">{feedback}</p>}
      {oauthToken && (
        <section aria-label="Review account link" className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h3 className="font-semibold">{denyLink ? 'Remove this account link?' : 'Confirm this account link?'}</h3>
          <p className="text-sm text-muted-foreground">Continue only if you requested this change. Opening the email link does not change your account.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={Boolean(linking)} onClick={handleEmailConfirmation} className="min-h-11">{linking === 'confirmation' ? 'Updating…' : denyLink ? 'Remove account link' : 'Confirm account link'}</Button>
            <Button type="button" variant="outline" disabled={Boolean(linking)} onClick={() => router.replace('/settings?section=verification', { scroll: false })} className="min-h-11">Cancel</Button>
          </div>
        </section>
      )}
      {/* Header */}
      <div className="border-b border-border pb-6">
        <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <FiShield className="text-brand-accent" />
          Verification & Trust
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Increase your verification level to boost your Reach multiplier and unlock more features
        </p>
      </div>

      {/* Tier Card */}
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
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
              <p className="text-sm text-muted-foreground mt-0.5">
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
            title="Refresh verification"
            aria-label="Refresh verification"
          >
            <FiRefreshCw className={`w-4 h-4 ${isRecalculating ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Score progress bar */}
        <div className="mt-5">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-muted-foreground">
              Verification Score
            </span>
            <span className="font-mono font-bold" style={{ color: tierInfo.color }}>
              {data.score}/100
            </span>
          </div>
          <div className="w-full h-2.5 bg-foreground/[0.05] rounded-full overflow-hidden">
            <motion.div
              initial={false}
              animate={{ scaleX: Math.max(0, Math.min(1, data.score / 100)) }}
              transition={{ duration: reducedMotion ? 0 : 0.18 }}
              className="h-full rounded-full"
              style={{ backgroundColor: tierInfo.color, transformOrigin: 'left' }}
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
                  className={`h-1.5 rounded-full transition ${
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
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
          <span>0.1x</span>
          <span>1.2x</span>
        </div>
      </motion.div>

      {/* Verification Checklist */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground mb-3">
          Verification Checklist — {completedSteps}/{totalSteps} complete
        </h3>

        {CHECKLIST.map((item) => {
          const provider = isOAuthProvider(item.action) ? item.action : null;
          const providerState = provider ? oauthLinkState(provider, data) : null;
          const isComplete = provider ? providerState === 'verified' : data.flags[item.key];
          // Yellow/pending: OAuth provider linked but email confirmation not yet clicked
          const isPending = providerState === 'pending' || providerState === 'unconfirmed';
          const isExpanded = expandedAction === item.action;

          return (
            <div key={item.key}>
              <div
                className={`flex flex-wrap items-center gap-3 p-3 rounded-xl border transition-colors ${
                  isComplete
                    ? 'bg-brand-accent/5 border-brand-accent/20'
                    : isPending
                      ? 'bg-yellow-500/5 border-yellow-500/30 dark:border-yellow-500/25'
                      : 'bg-surface-1/50 border-border hover:border-blue-500/30 dark:bg-foreground/[0.05] dark:hover:border-border'
                }`}
              >
                {/* Status icon */}
                <div className="shrink-0">
                  {isComplete ? (
                    <FiCheckCircle className="w-5 h-5 text-brand-accent" />
                  ) : isPending ? (
                    <FiMail className="w-5 h-5 text-yellow-500" />
                  ) : (
                    <FiCircle className="w-5 h-5 text-muted-foreground/40" />
                  )}
                </div>

                {/* Icon */}
                <span className="text-lg shrink-0">{item.icon}</span>

                {/* Label & description */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${
                    isComplete
                      ? 'text-brand-accent-hover dark:text-brand-accent-light line-through'
                      : isPending
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-foreground'
                  }`}>
                    {item.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isPending
                      ? providerState === 'pending' ? 'Email confirmation required' : 'Connected · not yet verified'
                      : isComplete && (item.action === 'google' || item.action === 'github' || item.action === 'discord')
                        ? `Linked and verified ✓`
                        : item.description}
                  </p>
                </div>

                {/* Points badge */}
                <span className={`text-xs font-mono px-2 py-0.5 rounded-full shrink-0 ${
                  isComplete
                    ? 'bg-brand-accent/10 text-brand-accent-hover dark:text-brand-accent-light'
                    : isPending
                      ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                      : 'bg-surface-1/80 text-muted-foreground dark:bg-foreground/[0.05]'
                }`}>
                  +{item.points}
                </span>

                {/* Action button */}
                {!isComplete && !isPending && item.action && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAction(item)}
                    disabled={Boolean(linking)}
                    className="min-h-11 shrink-0 text-blue-700 dark:text-blue-400 hover:bg-blue-500/10"
                  >
                    {linking === item.action
                      ? 'Opening…'
                      : item.action === 'phone'
                        ? (isExpanded ? 'Close' : 'Verify phone')
                        : item.action === 'wallet'
                          ? 'Verify wallet'
                          : item.action === 'purchase'
                            ? 'Shop now'
                            : item.action === '2fa'
                              ? 'Enable 2FA'
                              : `Link ${OAUTH_PROVIDERS[item.action].label}`}
                    <FiArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                )}

                {/* Pending: show "Resend" + "Cancel" buttons */}
                {isPending && item.action && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => provider && handleResend(provider)}
                      disabled={Boolean(linking)}
                      aria-label={`Send ${provider ? OAUTH_PROVIDERS[provider].label : ''} confirmation email`}
                      className="min-h-11 text-amber-800 dark:text-yellow-400 hover:bg-yellow-500/10"
                    >
                      {linking === provider ? 'Sending…' : 'Send email'}
                      <FiMail className="w-3.5 h-3.5 ml-1" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleUnlink(item.action!)}
                      disabled={unlinking === item.action}
                      className="min-h-11 min-w-11 text-red-700 dark:text-red-400 hover:bg-red-500/10"
                      title="Cancel pending link"
                      aria-label={`Disconnect ${provider ? OAUTH_PROVIDERS[provider].label : ''}`}
                    >
                      {unlinking === item.action ? '…' : <FiXCircle className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                )}

                {/* Completed OAuth: show "Unlink" button */}
                {isComplete && (item.action === 'google' || item.action === 'github' || item.action === 'discord') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleUnlink(item.action!)}
                    disabled={unlinking === item.action}
                    aria-label={`Disconnect ${provider ? OAUTH_PROVIDERS[provider].label : ''}`}
                    className="min-h-11 shrink-0 text-red-700 dark:text-red-400 hover:bg-red-500/10 text-xs"
                  >
                    {unlinking === item.action ? '…' : 'Unlink'}
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
                    <div className="ml-11 border-l-2 border-brand-accent/20 pl-4">
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
        <div className="p-4 rounded-xl border border-border bg-surface-1/50 dark:bg-foreground/[0.05]">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Linked Accounts
          </h4>
          <div className="flex flex-wrap gap-2">
            {data.linkedProviders.map((p) => {
              const state = oauthLinkState(p, data);
              const verified = state === 'verified';
              const label = isOAuthProvider(p) ? OAUTH_PROVIDERS[p].label : p;
              const status = verified ? 'Verified' : state === 'pending' ? 'Confirmation required' : 'Connected · not verified';
              return (
                <span
                  key={p}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                    verified
                      ? 'bg-brand-accent/10 text-brand-accent-hover dark:text-brand-accent-light'
                      : 'bg-muted text-foreground'
                  }`}
                  aria-label={`${label}: ${status}`}
                >
                  {!verified ? (
                    <FiMail className="w-3 h-3" aria-hidden="true" />
                  ) : (
                    <FiCheckCircle className="w-3 h-3" aria-hidden="true" />
                  )}
                  {label} · {status}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Reach Impact Explainer */}
      <details className="p-4 rounded-xl border border-border bg-foreground/[0.03]">
        <summary className="cursor-pointer text-sm font-medium text-foreground focus-visible:outline-2 focus-visible:outline-ring">About your Reach score</summary>
        <div className="text-xs text-muted-foreground space-y-1.5">
          <p>
            Your verification tier directly multiplies your <strong>Reach score</strong>. 
            Higher tiers mean your views, engagements, and poll votes carry more weight.
          </p>
          <p>
            Your current <strong>{data.multiplier}x</strong> multiplier means every view 
            you generate is worth <strong>{(data.multiplier * 100).toFixed(0)}%</strong> of 
            its base value. Fully verified users get a <strong>1.2x bonus</strong>.
          </p>
          <p>
            These checks contribute to the experimental Reach score. They are not a guarantee of a person’s identity or trustworthiness.
          </p>
        </div>
      </details>
    </div>
  );
}
