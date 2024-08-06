'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from '@/hooks/use-current-user';
import Link from 'next/link';

const OrderConfirmationPage = () => {
  const user = useCurrentUser();
  const router = useRouter();
  const [orderDetails, setOrderDetails] = useState<any[]>([]);

  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
    } else {
      fetchOrderDetails();
    }
  }, [user]);

  const fetchOrderDetails = async () => {
    try {
      const response = await fetch(`/api/orders/user/${user?.id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch order details');
      }
      const data = await response.json();
      console.log('Response data:', data);
      setOrderDetails(data);
    } catch (error) {
      console.error('Error fetching order details:', error);
    }
  };

  if (!orderDetails.length) {
    return <p>Loading order...</p>;
  }

  return (
    <div className="w-full p-8">
      {orderDetails.map((order: any) => (
        <Link href={`/order-confirmation/${order.id}`} key={order.id} className="flex flex-col">
          <div key={order.id} className="group flex flex-col hover:shadow-lg dark:hover:shadow-lg rounded overflow-hidden transition-shadow duration-100 p-2 hover:bg-blue-400/30 dark:hover:bg-blue-600/30">
            <h2 className="text-lg md:text-xl font-bold dark:text-indigo-400 text-indigo-600 text-pretty whitespace-break-spaces truncate">Order ID: {order.id}</h2>
            <p className=''>Total Amount: {order.totalAmount}</p>
            <p>Status: {order.status}</p>
            <p>Payment Method: {order.payment.method}</p>
            <p>Payment Status: {order.payment.status}</p>
            <p>Payment Transaction ID: {order.payment.transactionId}</p>
          </div>
        </Link>
      ))}
    </div>
  );
};

export default OrderConfirmationPage;