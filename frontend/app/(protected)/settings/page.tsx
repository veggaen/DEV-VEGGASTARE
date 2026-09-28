'use client';

/**
 * @fileOverview  Settings — one page, twelve sections, one visual language.
 *                The rail (or phone drawer) picks a section; the content card
 *                renders it. Account and Security share the auth form (keyed by
 *                the signed-in user, so a different account gets a clean form);
 *                every other section is its own component under
 *                components/uicustom/settings/sections.
 * @stability     evolving
 */

import * as z from 'zod';
import Link from 'next/link';
import { useCallback, useState, useTransition } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FiBell, FiChevronRight, FiCreditCard, FiDollarSign, FiEdit2, FiImage, FiKey, FiLock, FiMapPin, FiShield, FiSliders, FiTrendingUp, FiUser, FiX } from 'react-icons/fi';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MyAuthSettingsSchema } from '@/schemas';
import { settings } from '@/actions/settings';
import { MyFormError } from '@/components/uicustom/forms/form-error';
import { MyFormSuccess } from '@/components/uicustom/forms/form-sucess';
import { FancyBackground } from '@/components/uicustom/fancy-background';
import { PageHeader } from '@/components/uicustom/chrome/page-header';
import { VerificationDashboard } from '@/components/uicustom/verification-dashboard';
import { SellerPaymentSettings } from '@/components/uicustom/settings/seller-payment-settings';
import { SettingsNavigation } from '@/components/uicustom/settings/settings-navigation';
import { SectionHeader, SettingsRow, StickyActions, fieldClass, settingsCard } from '@/components/uicustom/settings/settings-primitives';
import { ProfileSettings } from '@/components/uicustom/settings/sections/profile-settings';
import { AiKeysSettings } from '@/components/uicustom/settings/sections/ai-keys-settings';
import { PrivacySettings } from '@/components/uicustom/settings/sections/privacy-settings';
import { AppearanceSettings } from '@/components/uicustom/settings/sections/appearance-settings';
import { Web3WalletSettings } from '@/components/uicustom/settings/sections/wallet-settings';
import { NotificationSettingsSection } from '@/components/uicustom/settings/sections/notification-settings-section';
import { CurrencySettings } from '@/components/uicustom/settings/sections/currency-settings';
import { AddressesSettings } from '@/components/uicustom/settings/sections/addresses-settings';
import { cn } from '@/lib/utils';

const SECTION_IDS = ['profile', 'account', 'security', 'wallet', 'payments', 'notifications', 'privacy', 'appearance', 'currency', 'verification', 'ai', 'addresses'] as const;
type SectionId = typeof SECTION_IDS[number];
const isSectionId = (value: string | null): value is SectionId => SECTION_IDS.includes(value as SectionId);

const SECTIONS = [
  { id: 'profile', label: 'Profile', icon: FiImage, description: 'Avatar, banner & bio' },
  { id: 'account', label: 'Account', icon: FiUser, description: 'Manage your account details' },
  { id: 'appearance', label: 'Appearance', icon: FiSliders, description: 'Theme, effects & animations' },
  { id: 'currency', label: 'Currency', icon: FiDollarSign, description: 'Display currency & crypto' },
  { id: 'security', label: 'Security', icon: FiShield, description: 'Password and authentication' },
  { id: 'wallet', label: 'Web3 & Wallet', icon: FiKey, description: 'Connect wallets & crypto' },
  { id: 'payments', label: 'Payments', icon: FiCreditCard, description: 'PayPal & receiving wallet' },
  { id: 'verification', label: 'Verification', icon: FiTrendingUp, description: 'Trust level & Reach multiplier' },
  { id: 'ai', label: 'AI Keys', icon: FiKey, description: 'Bring your own AI key' },
  { id: 'addresses', label: 'Addresses', icon: FiMapPin, description: 'Saved shipping addresses' },
  { id: 'notifications', label: 'Notifications', icon: FiBell, description: 'Email and push notifications' },
  { id: 'privacy', label: 'Privacy', icon: FiLock, description: 'Control your data and visibility' },
] as const;

export default function SettingsPage() {
  const { data: accountSession, status: accountStatus, update } = useSession();
  // A session refresh temporarily has loading status but retains the same user.
  // Keep the sections mounted instead of erasing drafts and save confirmations.
  const user = accountStatus === 'unauthenticated' ? null : accountSession?.user ?? null;
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlSection = searchParams.get('section');
  const [activeSection, setActiveSection] = useState<SectionId>(() => (isSectionId(urlSection) ? urlSection : 'profile'));
  // /settings?section=notifications and friends: follow the URL when it changes (derived state, no effect).
  const [seenUrlSection, setSeenUrlSection] = useState(urlSection);
  if (urlSection !== seenUrlSection) {
    setSeenUrlSection(urlSection);
    if (isSectionId(urlSection)) setActiveSection(urlSection);
  }

  const handleSectionChange = useCallback((section: SectionId) => {
    setActiveSection(section);
    document.querySelector('[data-site-scroll]')?.scrollTo({ top: 0, behavior: 'instant' });
    const next = `/settings?section=${section}`;
    if (window.location.pathname + window.location.search !== next) router.replace(next, { scroll: false });
  }, [router]);

  if (!user?.id) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }
  const userId = user.id;
  const narrow = activeSection === 'account' || activeSection === 'security';

  return (
    <div className="relative flex flex-1 flex-col overflow-x-clip">
      <FancyBackground gradient gradientVariant="default" spheres={[{ position: 'top-right', color: 'blue', size: 'lg' }]} />

      <div className="relative mx-auto w-full min-w-0 max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <PageHeader eyebrow="Account" title="Settings" description="Manage your account, how Veggat looks, and how it reaches you." className="mb-6" />

        <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-6">
          <SettingsNavigation sections={SECTIONS} active={activeSection} onSelect={handleSectionChange} />

          <div data-settings-content className={cn(settingsCard, 'min-w-0 p-4 sm:p-6', narrow && 'w-full max-w-[38rem]')}>
            {activeSection === 'profile' && <ProfileSettings userId={userId} onSaved={(changes) => { if (changes.image !== undefined) void update(); }} />}
            {(activeSection === 'account' || activeSection === 'security') && (
              <AuthSettings key={userId} user={user} section={activeSection} onSessionChanged={() => update()} />
            )}
            {activeSection === 'notifications' && <NotificationSettingsSection />}
            {activeSection === 'wallet' && <Web3WalletSettings />}
            {activeSection === 'payments' && <SellerPaymentSettings />}
            {activeSection === 'verification' && <VerificationDashboard />}
            {activeSection === 'ai' && <AiKeysSettings />}
            {activeSection === 'addresses' && <AddressesSettings />}
            {activeSection === 'privacy' && <PrivacySettings />}
            {activeSection === 'appearance' && <AppearanceSettings />}
            {activeSection === 'currency' && <CurrencySettings />}
          </div>
        </div>
      </div>
    </div>
  );
}

type AuthValues = z.infer<typeof MyAuthSettingsSchema>;
type SessionUser = NonNullable<ReturnType<typeof useSession>['data']>['user'];

/** Account (identity) and Security (password, 2FA) share one validated form. */
function AuthSettings({ user, section, onSessionChanged }: { user: SessionUser; section: 'account' | 'security'; onSessionChanged: () => Promise<unknown> }) {
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [needsSecurityCode, setNeedsSecurityCode] = useState(false);

  const defaults = useCallback((): AuthValues => ({
    name: user?.name || undefined,
    email: user?.email || undefined,
    password: '',
    newPassword: '',
    securityCode: '',
    role: user?.role || undefined,
    isTwoFactorEnabled: user?.isTwoFactorEnabled ?? false,
    expectedTwoFactorEnabled: user?.isTwoFactorEnabled ?? false,
    identityNameSource: user?.identityNameSource || 'AUTO',
    identityImageSource: user?.identityImageSource || 'AUTO',
    emailDisplayMode: user?.emailDisplayMode || 'PRIMARY',
  }), [user]);

  const form = useForm<AuthValues>({ resolver: zodResolver(MyAuthSettingsSchema), defaultValues: defaults() });

  const onSubmit = (values: AuthValues) => {
    setError(''); setSuccess('');
    // Account and Security are separate changes; never submit an old security
    // toggle or a hidden password with a display-name edit.
    const input = section === 'security' ? {
      password: values.password, newPassword: values.newPassword,
      isTwoFactorEnabled: values.isTwoFactorEnabled ?? false,
      expectedTwoFactorEnabled: values.expectedTwoFactorEnabled,
      securityCode: values.securityCode,
    } : {
      name: values.name, email: values.email, identityNameSource: values.identityNameSource,
      identityImageSource: values.identityImageSource, emailDisplayMode: values.emailDisplayMode,
    };
    startTransition(async () => {
      try {
        const data = await settings(input);
        if ('error' in data) setError(data.error);
        if ('twoFactor' in data) {
          setNeedsSecurityCode(true);
          setSuccess('Enter the code sent to your account email. Nothing has changed yet.');
          requestAnimationFrame(() => form.setFocus('securityCode'));
        }
        if ('success' in data) {
          form.setValue('password', ''); form.setValue('newPassword', ''); form.setValue('securityCode', '');
          setNeedsSecurityCode(false);
          setSuccess(data.success);
          setIsEditing(false);
          if (data.signInRequired) await signOut({ callbackUrl: '/auth/login?callbackUrl=%2Fsettings%3Fsection%3Dsecurity' });
          else await onSessionChanged();
        }
      } catch {
        setError('The save could not be confirmed. Reload Settings before trying again.');
      }
    });
  };

  const handleStartEdit = () => {
    if (!isEditing) form.reset(defaults());
    setIsEditing(!isEditing);
    setError(''); setSuccess('');
  };
  const handleCancelEdit = () => {
    form.reset(defaults());
    setIsEditing(false);
    setError(''); setSuccess('');
  };

  const selectClass = cn(fieldClass, 'w-full');

  if (section === 'account') {
    return (
      <div className="space-y-6">
        <SectionHeader
          icon={FiUser}
          title="Account"
          description="Your name, sign-in email and which linked identity is shown."
          actions={
            <Button type="button" variant="vegaNormalBtn" onClick={handleStartEdit} className="min-h-11 gap-1.5">
              {isEditing ? <FiX className="size-4" aria-hidden="true" /> : <FiEdit2 className="size-4" aria-hidden="true" />}{isEditing ? 'Cancel' : 'Edit'}
            </Button>
          }
        />
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} aria-label="Account details" className="space-y-5 [&_input]:min-h-11 [&_button:not([role=switch])]:min-h-11">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Display name</FormLabel>
                <FormControl><Input {...field} disabled={isPending || !isEditing} placeholder={user?.name || 'Enter your name'} className={fieldClass} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>Email address</FormLabel>
                <FormControl><Input {...field} type="email" readOnly autoComplete="email" spellCheck={false} placeholder={user?.email || 'Enter your email'} className={fieldClass} /></FormControl>
                <FormDescription>Your sign-in email. Verified email changes are not yet available here.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid gap-4 md:grid-cols-2">
              <FormField control={form.control} name="identityNameSource" render={({ field }) => (
                <FormItem>
                  <FormLabel>Name source</FormLabel>
                  <Select disabled={isPending || !isEditing} onValueChange={field.onChange} value={field.value ?? 'AUTO'}>
                    <FormControl><SelectTrigger className={selectClass}><SelectValue placeholder="Choose name source" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="AUTO">Auto (active login provider)</SelectItem>
                      <SelectItem value="MANUAL">Manual (profile name)</SelectItem>
                      <SelectItem value="GOOGLE">Google</SelectItem>
                      <SelectItem value="GITHUB">GitHub</SelectItem>
                      <SelectItem value="DISCORD">Discord</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>Which linked identity name is used by default.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="identityImageSource" render={({ field }) => (
                <FormItem>
                  <FormLabel>Profile picture</FormLabel>
                  <Select disabled={isPending || !isEditing} onValueChange={field.onChange} value={field.value ?? 'AUTO'}>
                    <FormControl><SelectTrigger className={selectClass}><SelectValue placeholder="Choose avatar source" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="AUTO">Auto (active login provider)</SelectItem>
                      <SelectItem value="MANUAL">Manual (profile avatar)</SelectItem>
                      <SelectItem value="GOOGLE">Google</SelectItem>
                      <SelectItem value="GITHUB">GitHub</SelectItem>
                      <SelectItem value="DISCORD">Discord</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>Which linked identity avatar is shown by default.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="emailDisplayMode" render={({ field }) => (
              <FormItem>
                <FormLabel>Email visibility</FormLabel>
                <Select disabled={isPending || !isEditing} onValueChange={field.onChange} value={field.value ?? 'PRIMARY'}>
                  <FormControl><SelectTrigger className={selectClass}><SelectValue placeholder="Choose email visibility" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="PRIMARY">Show primary email</SelectItem>
                    <SelectItem value="HIDE">Hide email publicly</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>Public email visibility on your profile and linked identity surfaces.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />

            <div className="border-t border-border/60 pt-4">
              <Link href={`/profile/${user?.id}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-brand-accent-hover transition-colors hover:text-brand-accent dark:text-brand-accent-light">
                <FiUser className="size-4" aria-hidden="true" />View your public profile<FiChevronRight className="size-4" aria-hidden="true" />
              </Link>
            </div>

            {isEditing && (
              <StickyActions>
                <Button type="submit" disabled={isPending} variant="vegaEmeraldBtn">{isPending ? 'Saving...' : 'Save Changes'}</Button>
                <Button type="button" variant="vegaNormalBtn" onClick={handleCancelEdit}>Cancel</Button>
              </StickyActions>
            )}
            <MyFormError message={error} />
            <MyFormSuccess message={success} />
          </form>
        </Form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader icon={FiShield} title="Security" description="Password and the email code that guards sign-in." />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} aria-label="Account security" className="space-y-5 [&_input]:min-h-11 [&_button:not([role=switch])]:min-h-11">
          <FormField control={form.control} name="password" render={({ field }) => (
            <FormItem>
              <FormLabel>Current password</FormLabel>
              <FormControl><Input {...field} type="password" autoComplete="current-password" disabled={isPending} placeholder="Enter current password" className={fieldClass} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="newPassword" render={({ field }) => (
            <FormItem>
              <FormLabel>New password</FormLabel>
              <FormControl><Input {...field} type="password" autoComplete="new-password" disabled={isPending} placeholder="Enter new password" className={fieldClass} /></FormControl>
              <FormDescription>At least 8 characters.</FormDescription>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="isTwoFactorEnabled" render={({ field }) => (
            <FormItem className={cn(settingsCard, 'p-1')}>
              <SettingsRow icon={<FiShield />} title={<FormLabel className="cursor-pointer">Two-Factor Authentication</FormLabel>} description="Email code for password sign-in. Security changes require confirmation.">
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={isPending} className="relative after:absolute after:inset-x-0 after:-inset-y-2.5" /></FormControl>
              </SettingsRow>
            </FormItem>
          )} />
          {needsSecurityCode && (
            <FormField control={form.control} name="securityCode" render={({ field }) => (
              <FormItem>
                <FormLabel>Security code</FormLabel>
                <FormControl><Input {...field} value={field.value ?? ''} inputMode="numeric" autoComplete="one-time-code" maxLength={6} disabled={isPending} className={cn(fieldClass, 'tracking-widest')} /></FormControl>
                <FormDescription>Six digits from your account email. Expires in 5 minutes.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />
          )}
          <p className="text-sm text-muted-foreground">Changing security settings signs out existing sessions. Enter your current password if this account has one.</p>
          <StickyActions>
            <Button type="submit" disabled={isPending} variant="vegaEmeraldBtn">{isPending ? 'Updating…' : needsSecurityCode ? 'Confirm Security Change' : 'Update Security Settings'}</Button>
            {needsSecurityCode && <Button type="button" variant="vegaNormalBtn" disabled={isPending} onClick={() => { form.setValue('securityCode', ''); void form.handleSubmit(onSubmit)(); }}>Resend Code</Button>}
          </StickyActions>
          <MyFormError message={error} />
          <MyFormSuccess message={success} />
        </form>
      </Form>
    </div>
  );
}
