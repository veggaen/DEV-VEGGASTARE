'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from '@/hooks/use-current-user';
import type { OrderDto } from '@/lib/types/orders';

const statusKeys = ['paymentFailed', 'paymentCancelled'];

const OrderConfirmationPage = () => {
  const user = useCurrentUser();
  const router = useRouter();
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      router.push('/auth/login');
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    const orderId = searchParams.get('orderId');

    if (orderId) {
      const statusParams = new URLSearchParams();
      for (const key of statusKeys) {
        const value = searchParams.get(key);
        if (value) statusParams.set(key, value);
      }
      const statusQuery = statusParams.toString();
      router.replace(`/order-confirmation/${encodeURIComponent(orderId)}${statusQuery ? `?${statusQuery}` : ''}`);
      return;
    }

    fetchOrders(user.id);
  }, [router, user]);

  const fetchOrders = async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/orders/user/${userId}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to load your orders.');
      }
      const data = await response.json();
      setOrders(data);
    } catch (fetchError) {
      console.error('Error fetching order details:', fetchError);
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load your orders.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto flex min-h-[60vh] w-full max-w-3xl items-center px-6">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Loading order</p>
          <h1 className="mt-3 text-2xl font-semibold text-foreground">Finding your confirmation...</h1>
        </div>
      </main>
    );
  }

  if (error || orders.length === 0) {
    return (
      <main className="mx-auto flex min-h-[60vh] w-full max-w-3xl items-center px-6">
        <section className="w-full border-y border-border py-10">
          <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">
            {error ? 'Order lookup failed' : 'No recent orders'}
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-foreground">
            {error ?? 'We did not find an order to confirm yet.'}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            If you just finished checkout, the confirmation URL should include an order id. You can still review any
            completed purchases from your order history.
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
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="mb-8 border-b border-border pb-6">
        <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Order confirmation</p>
        <h1 className="mt-3 text-3xl font-semibold text-foreground">Choose an order to inspect</h1>
      </div>
      <div className="divide-y divide-border border-y border-border">
        {orders.map((order) => (
          <Link
            href={`/order-confirmation/${order.id}`}
            key={order.id}
            className="group block py-5 transition-colors hover:bg-white/[0.03]"
          >
            <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-mono text-sm text-foreground">Order {order.id}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {order.payment?.method ?? 'Payment'} - {order.payment?.status ?? order.status}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-lg font-semibold text-foreground">${order.totalAmount.toFixed(2)}</p>
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{order.status}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
};

export default OrderConfirmationPage;
