'use client';

import { useEffect, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useCurrentUser } from '@/hooks/use-current-user';
import { Order } from '@/generated/prisma/browser';

interface extendeedOrderDetails extends Order {
  payment: {
    method: string;
    status: string;
    transactionId: string;
  };
}

const OrderConfirmationPage = () => {
  const user = useCurrentUser();
  const orderId = usePathname();
  const id = orderId.replace('/order-confirmation/', '');
  
  const router = useRouter();
  const [orderDetails, setOrderDetails] = useState<extendeedOrderDetails>();

  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
    } else {
      fetchOrderDetails();
    }
  }, [user]);

  const fetchOrderDetails = async () => {
    try {
      const response = await fetch(`/api/orders/${id}`);
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

  if (!orderDetails || !orderId) {
    return <p>Loading order...</p>;
  }

  return (
    <div className="w-full p-8">
          <div className="group flex flex-col hover:shadow-lg dark:hover:shadow-lg rounded overflow-hidden transition-shadow duration-100 p-2 hover:bg-blue-400/30 dark:hover:bg-blue-600/30">
            <h2 className="text-lg md:text-xl font-bold dark:text-indigo-400 text-indigo-600 text-pretty whitespace-break-spaces truncate">Order ID: {orderDetails.id}</h2>
            <p className=''>Total Amount: {orderDetails.totalAmount}</p>
            <p>Status: {orderDetails.status}</p>
            <p>Payment Method: {orderDetails.payment.method}</p>
            <p>Payment Status: {orderDetails.payment.status}</p>
            <p>Payment Transaction ID: {orderDetails.payment.transactionId}</p>
          </div>
    </div>
  );
};

export default OrderConfirmationPage;