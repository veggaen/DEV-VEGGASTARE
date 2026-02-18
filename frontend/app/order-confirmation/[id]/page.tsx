'use client';

/**
 * @fileOverview Order Confirmation detail page — shows order summary,
 *   shipping details, and Bring tracking link (when available).
 * @stability maturing
 */
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useCurrentUser } from '@/hooks/use-current-user';

interface OrderDetails {
  id: string;
  totalAmount: number;
  status: string;
  commentOrder?: string | null;
  createdAt: string;
  // Shipping
  shippingName?: string | null;
  shippingAddress?: string | null;
  shippingCity?: string | null;
  shippingPostalCode?: string | null;
  shippingCountry?: string | null;
  shippingMethod?: string | null;
  shippingCost?: number | null;
  shippingServiceName?: string | null;
  // Tracking
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  estimatedDelivery?: string | null;
  // Payment
  payment?: {
    method: string;
    status: string;
    transactionId?: string | null;
  } | null;
}

const OrderConfirmationPage = () => {
  const user = useCurrentUser();
  const orderId = usePathname();
  const id = orderId.replace('/order-confirmation/', '');
  const router = useRouter();
  const [orderDetails, setOrderDetails] = useState<OrderDetails>();

  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
    } else {
      fetchOrderDetails();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchOrderDetails = async () => {
    try {
      const response = await fetch(`/api/orders/${id}`);
      if (!response.ok) throw new Error('Failed to fetch order details');
      const data = await response.json();
      setOrderDetails(data);
    } catch (error) {
      console.error('Error fetching order details:', error);
    }
  };

  if (!orderDetails || !orderId) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Laster bestilling…</p>
      </div>
    );
  }

  const statusColor: Record<string, string> = {
    COMPLETED: 'text-emerald-600 dark:text-emerald-400',
    CONFIRMING: 'text-blue-600 dark:text-blue-400',
    PENDING: 'text-amber-600 dark:text-amber-400',
    FAILED: 'text-red-600 dark:text-red-400',
    CANCELLED: 'text-red-600 dark:text-red-400',
  };

  return (
    <div className="w-full max-w-3xl mx-auto p-4 lg:p-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white p-6 rounded-xl mb-6">
        <h1 className="text-2xl font-bold">Takk for din bestilling! 🎉</h1>
        <p className="text-emerald-100 mt-1 text-sm">
          Ordre-ID: <span className="font-mono">{orderDetails.id}</span>
        </p>
      </div>

      {/* Order status */}
      <div className="bg-surface-1 dark:bg-white/[0.02] border border-border dark:border-white/10 rounded-xl p-6 mb-4">
        <h2 className="text-lg font-semibold text-foreground mb-4">Ordrestatus</h2>
        <div className="grid grid-cols-2 gap-y-3 text-sm">
          <span className="text-muted-foreground">Status:</span>
          <span className={`font-medium ${statusColor[orderDetails.status] ?? 'text-foreground'}`}>
            {orderDetails.status}
          </span>
          <span className="text-muted-foreground">Totalbeløp:</span>
          <span className="text-foreground font-medium">${orderDetails.totalAmount.toFixed(2)}</span>
          {orderDetails.payment && (
            <>
              <span className="text-muted-foreground">Betalingsmetode:</span>
              <span className="text-foreground">{orderDetails.payment.method}</span>
              <span className="text-muted-foreground">Betalingsstatus:</span>
              <span className={`font-medium ${statusColor[orderDetails.payment.status] ?? 'text-foreground'}`}>
                {orderDetails.payment.status}
              </span>
              {orderDetails.payment.transactionId && (
                <>
                  <span className="text-muted-foreground">Transaksjons-ID:</span>
                  <span className="text-foreground font-mono text-xs truncate">{orderDetails.payment.transactionId}</span>
                </>
              )}
            </>
          )}
          <span className="text-muted-foreground">Bestilt:</span>
          <span className="text-foreground">
            {new Date(orderDetails.createdAt).toLocaleDateString('nb-NO', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      </div>

      {/* Shipping details */}
      {orderDetails.shippingAddress && (
        <div className="bg-surface-1 dark:bg-white/[0.02] border border-border dark:border-white/10 rounded-xl p-6 mb-4">
          <h2 className="text-lg font-semibold text-foreground mb-4">📦 Leveringsinformasjon</h2>
          <div className="grid grid-cols-2 gap-y-3 text-sm">
            {orderDetails.shippingName && (
              <>
                <span className="text-muted-foreground">Mottaker:</span>
                <span className="text-foreground">{orderDetails.shippingName}</span>
              </>
            )}
            <span className="text-muted-foreground">Adresse:</span>
            <span className="text-foreground">
              {orderDetails.shippingAddress}
              <br />
              {orderDetails.shippingPostalCode} {orderDetails.shippingCity}
              <br />
              {orderDetails.shippingCountry}
            </span>
            {(orderDetails.shippingServiceName || orderDetails.shippingMethod) && (
              <>
                <span className="text-muted-foreground">Fraktmetode:</span>
                <span className="text-foreground">
                  {orderDetails.shippingServiceName || orderDetails.shippingMethod}
                </span>
              </>
            )}
            {orderDetails.shippingCost != null && orderDetails.shippingCost > 0 && (
              <>
                <span className="text-muted-foreground">Fraktkostnad:</span>
                <span className="text-foreground">${orderDetails.shippingCost.toFixed(2)}</span>
              </>
            )}
            {orderDetails.estimatedDelivery && (
              <>
                <span className="text-muted-foreground">Estimert levering:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  {new Date(orderDetails.estimatedDelivery).toLocaleDateString('nb-NO', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              </>
            )}
          </div>

          {/* Tracking section */}
          {orderDetails.trackingNumber && (
            <div className="mt-4 pt-4 border-t border-border dark:border-white/10">
              <h3 className="text-sm font-semibold text-foreground mb-2">📍 Sporing</h3>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Sporingsnummer:</span>
                <span className="text-sm font-mono text-foreground">{orderDetails.trackingNumber}</span>
              </div>
              {orderDetails.trackingUrl && (
                <a
                  href={orderDetails.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Spor pakken hos Bring →
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OrderConfirmationPage;