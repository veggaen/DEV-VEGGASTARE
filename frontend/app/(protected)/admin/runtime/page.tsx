'use client'

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { FiToggleLeft, FiToggleRight, FiLoader, FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';

type RuntimeConfig = {
  paymentsLiveEnabled: boolean;
  bringLiveEnabled: boolean;
  updatedBy: string | null;
  updatedAt: string | Date;
};

type WebhookEvent = {
  id: string;
  provider: string;
  eventType: string | null;
  deliveryId: string | null;
  signatureVerified: boolean;
  sessionId: string | null;
  paymentId: string | null;
  orderId: string | null;
  orderStatus: string | null;
  paymentStatus: string | null;
  httpStatus: number | null;
  processingError: string | null;
  updatedAt: string;
  createdAt: string;
};

export default function AdminRuntimePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [runtime, setRuntime] = useState<RuntimeConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [availableMethods, setAvailableMethods] = useState<string[]>([]);
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>([]);

  const isOwner = session?.user?.role === 'OWNER';
  const isAdmin = session?.user?.role === 'ADMIN' || isOwner;

  useEffect(() => {
    if (status === 'loading') return;
    if (!isAdmin) {
      router.push('/');
      return;
    }

    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/admin/runtime-config', { cache: 'no-store' });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || 'Failed to load runtime config');
        }
        setRuntime(payload.runtime as RuntimeConfig);

        const methodsResponse = await fetch('/api/payments', { cache: 'no-store' });
        const methodsPayload = await methodsResponse.json().catch(() => ({ methods: [] }));
        const labels = Array.isArray(methodsPayload?.methods)
          ? methodsPayload.methods.map((entry: { displayName?: string }) => entry.displayName).filter(Boolean)
          : [];
        setAvailableMethods(labels as string[]);

        const webhooksResponse = await fetch('/api/admin/payments/webhook-events', { cache: 'no-store' });
        const webhooksPayload = await webhooksResponse.json().catch(() => ({ events: [] }));
        setWebhookEvents(Array.isArray(webhooksPayload?.events) ? webhooksPayload.events : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load runtime config');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [status, isAdmin, router]);

  const patchRuntime = async (patch: Partial<RuntimeConfig>) => {
    if (!isOwner) {
      setError('Only OWNER can change runtime toggles.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch('/api/admin/runtime-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...patch,
          reason: 'Owner runtime switch update from admin runtime page',
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to update runtime config');
      }
      setRuntime(payload.runtime as RuntimeConfig);
      setSuccess('Runtime toggle updated successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update runtime config');
    } finally {
      setIsSaving(false);
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <FiLoader className="h-7 w-7 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!runtime) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-lg w-full rounded-xl border border-red-300/40 bg-red-500/10 p-4 text-red-700 dark:text-red-300">
          <div className="flex items-center gap-2 font-medium">
            <FiAlertTriangle />
            Runtime config unavailable
          </div>
          <p className="mt-2 text-sm">{error || 'Could not load runtime switches.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Runtime Controls</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            This is the live/test flip for payment providers and Bring shipping behavior.
          </p>
        </div>

        <div className="rounded-xl border border-amber-300/40 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
          <div className="font-medium">Go-live note</div>
          <p className="mt-1">
            Keep toggles OFF while validating sandbox/test keys. Switch ON only after production keys and webhooks are configured.
          </p>
          <p className="mt-2">
            You do not need every provider. Running with only PayPal + crypto is valid; Vipps/Klarna can be added later.
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 text-sm text-zinc-600 dark:text-zinc-300">
          <div className="font-medium text-zinc-900 dark:text-zinc-100">Currently available checkout methods</div>
          <div className="mt-1 text-zinc-500 dark:text-zinc-400">
            {availableMethods.length > 0 ? availableMethods.join(', ') : 'No methods currently detected.'}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
          <RuntimeToggleRow
            title="Payments Live"
            description="Enables live fiat provider sessions when provider-gating requirements are met."
            enabled={runtime.paymentsLiveEnabled}
            disabled={!isOwner || isSaving}
            onToggle={() => patchRuntime({ paymentsLiveEnabled: !runtime.paymentsLiveEnabled })}
          />

          <RuntimeToggleRow
            title="Bring Live"
            description="Enables live Bring behavior instead of test/mock mode where applicable."
            enabled={runtime.bringLiveEnabled}
            disabled={!isOwner || isSaving}
            onToggle={() => patchRuntime({ bringLiveEnabled: !runtime.bringLiveEnabled })}
          />
        </div>

        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 text-sm text-zinc-600 dark:text-zinc-300">
          <div><span className="font-medium">Changed by:</span> {runtime.updatedBy ?? 'system default'}</div>
          <div><span className="font-medium">Changed at:</span> {new Date(runtime.updatedAt).toLocaleString()}</div>
          <div className="mt-2 text-zinc-500 dark:text-zinc-400">
            API endpoint: <span className="font-medium">/api/admin/runtime-config</span>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Recent PayPal webhook events</h2>
          {webhookEvents.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No recent PayPal payment updates found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                    <th className="py-2 pr-4 font-medium">Time</th>
                    <th className="py-2 pr-4 font-medium">Event</th>
                    <th className="py-2 pr-4 font-medium">Delivery</th>
                    <th className="py-2 pr-4 font-medium">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {webhookEvents.map((event) => (
                    <tr key={event.id} className="border-b border-zinc-100 dark:border-zinc-800/60">
                      <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-300">{new Date(event.createdAt).toLocaleString()}</td>
                      <td className="py-2 pr-4 text-zinc-700 dark:text-zinc-200">{event.eventType ?? 'UNKNOWN_EVENT'}</td>
                      <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-300">
                        {event.deliveryId ?? 'no-delivery-id'}
                        {event.orderId ? ` • order:${event.orderId.slice(0, 12)}…` : ''}
                      </td>
                      <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-300">
                        {event.signatureVerified ? 'verified' : 'unverified'}
                        {event.paymentStatus ? ` • payment:${event.paymentStatus}` : ''}
                        {event.orderStatus ? ` • order:${event.orderStatus}` : ''}
                        {event.httpStatus ? ` • http:${event.httpStatus}` : ''}
                        {event.processingError ? ` • error:${event.processingError}` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!isOwner && (
          <div className="rounded-xl border border-zinc-300/40 bg-zinc-500/10 p-3 text-sm text-zinc-700 dark:text-zinc-300">
            You can view runtime status as ADMIN, but only OWNER can flip live switches.
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-300/40 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-emerald-300/40 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <FiCheckCircle />
            {success}
          </div>
        )}
      </div>
    </div>
  );
}

function RuntimeToggleRow({
  title,
  description,
  enabled,
  disabled,
  onToggle,
}: {
  title: string;
  description: string;
  enabled: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
      <div>
        <div className="font-medium text-zinc-900 dark:text-zinc-100">{title}</div>
        <div className="text-sm text-zinc-500 dark:text-zinc-400">{description}</div>
      </div>

      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm disabled:opacity-50"
        title={enabled ? 'Currently ON (live)' : 'Currently OFF (test/sandbox)'}
      >
        {enabled ? <FiToggleRight className="h-5 w-5 text-emerald-500" /> : <FiToggleLeft className="h-5 w-5 text-zinc-400" />}
        {enabled ? 'Live ON' : 'Live OFF'}
      </button>
    </div>
  );
}
