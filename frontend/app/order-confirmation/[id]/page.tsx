'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCurrentUser } from '@/hooks/use-current-user';
import type { OrderDto } from '@/lib/types/orders';

type PaymentNotice = 'failed' | 'cancelled' | null;

const statusColor: Record<string, string> = {
  COMPLETED: 'text-emerald-600 dark:text-emerald-400',
  CONFIRMING: 'text-blue-600 dark:text-blue-400',
  PENDING: 'text-amber-600 dark:text-amber-400',
  FAILED: 'text-red-600 dark:text-red-400',
  CANCELLED: 'text-red-600 dark:text-red-400',
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('nb-NO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const OrderConfirmationPage = () => {
  const user = useCurrentUser();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id ? decodeURIComponent(params.id) : '';
  const [orderDetails, setOrderDetails] = useState<OrderDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentNotice, setPaymentNotice] = useState<PaymentNotice>(null);

  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
      return;
    }

    if (!id) {
      setError('Missing order id.');
      setLoading(false);
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    setPaymentNotice(null);
    if (searchParams.get('paymentFailed') === 'true') setPaymentNotice('failed');
    if (searchParams.get('paymentCancelled') === 'true') setPaymentNotice('cancelled');

    fetchOrderDetails(id);
  }, [id, router, user]);

  const fetchOrderDetails = async (orderId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/orders/${orderId}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to fetch order details');
      }
      const data = await response.json();
      setOrderDetails(data);
    } catch (fetchError) {
      console.error('Error fetching order details:', fetchError);
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to fetch order details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center">
        <p className="text-muted-foreground">Loading order...</p>
      </div>
    );
  }

  if (error || !orderDetails) {
    return (
      <main className="mx-auto flex min-h-[60vh] w-full max-w-3xl items-center px-6">
        <section className="w-full border-y border-border py-10">
          <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Order confirmation</p>
          <h1 className="mt-3 text-3xl font-semibold text-foreground">We could not open this order.</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            {error ?? 'The order could not be loaded.'}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              className="border border-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-300 transition-colors hover:bg-emerald-500 hover:text-black"
              href="/my-orders"
            >
              Open My orders
            </Link>
            <Link
              className="border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-foreground"
              href="/products"
            >
              Back to marketplace
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl p-4 lg:p-8">
      <section className="mb-6 border-y border-emerald-500/50 py-6">
        <p className="text-sm uppercase tracking-[0.18em] text-emerald-300">Order confirmed</p>
        <h1 className="mt-3 text-3xl font-semibold text-foreground">Thank you for your order</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Order ID: <span className="font-mono text-foreground">{orderDetails.id}</span>
        </p>
      </section>

      {paymentNotice && (
        <div className="mb-4 border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
          {paymentNotice === 'cancelled'
            ? 'Payment was cancelled. The order is kept here so you can retry or review it.'
            : 'Payment could not be confirmed. Please retry checkout or contact support if money was withdrawn.'}
        </div>
      )}

      <section className="mb-4 border border-border bg-surface-1 p-6 dark:bg-white/[0.02]">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Order status</h2>
        <div className="grid grid-cols-2 gap-y-3 text-sm">
          <span className="text-muted-foreground">Status:</span>
          <span className={`font-medium ${statusColor[orderDetails.status] ?? 'text-foreground'}`}>
            {orderDetails.status}
          </span>
          <span className="text-muted-foreground">Total amount:</span>
          <span className="font-medium text-foreground">${orderDetails.totalAmount.toFixed(2)}</span>
          {orderDetails.payment && (
            <>
              <span className="text-muted-foreground">Payment method:</span>
              <span className="text-foreground">{orderDetails.payment.method}</span>
              <span className="text-muted-foreground">Payment status:</span>
              <span className={`font-medium ${statusColor[orderDetails.payment.status] ?? 'text-foreground'}`}>
                {orderDetails.payment.status}
              </span>
              {orderDetails.payment.transactionId && (
                <>
                  <span className="text-muted-foreground">Transaction ID:</span>
                  <span className="truncate font-mono text-xs text-foreground">{orderDetails.payment.transactionId}</span>
                </>
              )}
            </>
          )}
          <span className="text-muted-foreground">Ordered:</span>
          <span className="text-foreground">{formatDate(orderDetails.createdAt)}</span>
        </div>
      </section>

      {orderDetails.shippingAddress && (
        <section className="mb-4 border border-border bg-surface-1 p-6 dark:bg-white/[0.02]">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Delivery information</h2>
          <div className="grid grid-cols-2 gap-y-3 text-sm">
            {orderDetails.shippingName && (
              <>
                <span className="text-muted-foreground">Recipient:</span>
                <span className="text-foreground">{orderDetails.shippingName}</span>
              </>
            )}
            <span className="text-muted-foreground">Address:</span>
            <span className="text-foreground">
              {orderDetails.shippingAddress}
              <br />
              {orderDetails.shippingPostalCode} {orderDetails.shippingCity}
              <br />
              {orderDetails.shippingCountry}
            </span>
            {(orderDetails.shippingServiceName || orderDetails.shippingMethod) && (
              <>
                <span className="text-muted-foreground">Shipping method:</span>
                <span className="text-foreground">{orderDetails.shippingServiceName || orderDetails.shippingMethod}</span>
              </>
            )}
            {orderDetails.shippingCost != null && orderDetails.shippingCost > 0 && (
              <>
                <span className="text-muted-foreground">Shipping cost:</span>
                <span className="text-foreground">${orderDetails.shippingCost.toFixed(2)}</span>
              </>
            )}
            {orderDetails.estimatedDelivery && (
              <>
                <span className="text-muted-foreground">Estimated delivery:</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  {new Date(orderDetails.estimatedDelivery).toLocaleDateString('nb-NO', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              </>
            )}
          </div>

          {orderDetails.trackingNumber && (
            <div className="mt-4 border-t border-border pt-4 dark:border-white/10">
              <h3 className="mb-2 text-sm font-semibold text-foreground">Tracking</h3>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Tracking number:</span>
                <span className="font-mono text-sm text-foreground">{orderDetails.trackingNumber}</span>
              </div>
              {orderDetails.trackingUrl && (
                <a
                  href={orderDetails.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex border border-emerald-500 px-4 py-2 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-500 hover:text-black"
                >
                  Track package with Bring
                </a>
              )}
            </div>
          )}
        </section>
      )}
    </main>
  );
};

export default OrderConfirmationPage;
