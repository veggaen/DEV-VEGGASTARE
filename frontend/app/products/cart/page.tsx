'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import Image from 'next/image';

interface CartItem {
  id: string;
  product: {
    id: string;
    title: string;
    price: number;
    image: string[];
  };
  quantity: number;
}

const CartPage = () => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [totalQuantity, setTotalQuantity] = useState<number>(0);
  const [totalPrice, setTotalPrice] = useState<number>(0);
  const { data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) {
      fetchCartItems();
    } else {
      router.push('/auth/login');
    }
  }, [session]);

  const fetchCartItems = async () => {
    try {
      const response = await fetch(`/api/cart/${session?.user?.id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch cart items');
      }
      const data = await response.json();
      setCartItems(data.items);
      const totalQuantity = data.items.reduce((sum: number, item: any) => sum + item.quantity, 0);
      const totalPrice = data.items.reduce((sum: number, item: any) => sum + item.quantity * item.product.price, 0);
      setTotalQuantity(totalQuantity);
      setTotalPrice(totalPrice);
    } catch (error) {
      console.error('Error fetching cart items:', error);
    }
  };

  const handleQuantityChange = async (itemId: string, changeType: 'increment' | 'decrement') => {
    try {
      const response = await fetch(`/api/cart/${session?.user?.id}/items/${itemId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ changeType }),
      });

      if (!response.ok) {
        throw new Error('Failed to update item quantity');
      }
      console.log(`Item quantity ${changeType}d successfully!`);
      fetchCartItems();
    } catch (error) {
      console.error('Error updating item quantity:', error);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    try {
      console.log(`Removing item ${itemId} from cart`);
      const response = await fetch(`/api/cart/${session?.user?.id}/items/${itemId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to remove item from cart');
      }
      console.log('Item removed from cart successfully');
      fetchCartItems();
    } catch (error) {
      console.error('Error removing item from cart:', error);
    }
  };

  const handleCheckout = () => {
    router.push('/checkout');
  };

  if (!session) {
    return <p>Loading...</p>;
  }

  return (
    <div className="w-full p-8">
      <h1 className="text-2xl font-bold mb-4">Shopping Cart</h1>
      {cartItems.length === 0 ? (
        <p>Your cart is empty.</p>
      ) : (
        <div>
          {cartItems.map((item) => (
            <div key={item.id} className="flex flex-col sm:flex-row items-start gap-4 max-w-[1440px] w-full bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
              <div className='w-full h-full sm:w-36 sm:h-36'>
                <AspectRatio ratio={1 / 1} className="">
                  <Image src={item.product.image[0]} alt={item.product.title} fill className="object-cover rounded-lg" />
                </AspectRatio>
              </div>
              <div className="flex-1 w-full flex-col justify-start items-end">
                <div>
                  <h2 className="text-lg font-semibold dark:text-white">{item.product.title}</h2>
                  <p className="text-gray-500 dark:text-gray-300">${item.product.price}</p>
                </div>
                <div className='flex flex-col items-end w-full gap-2'>
                  <div className="flex justify-between items-center w-full md:w-1/2">
                    <Button onClick={() => handleQuantityChange(item.id, 'decrement')} disabled={item.quantity <= 1}>-</Button>
                    <span className="text-lg text-gray-800 dark:text-gray-200">{`${item.quantity <= 1 ? `${item.quantity} Item` : `${item.quantity} Items` }`}</span>
                    <Button onClick={() => handleQuantityChange(item.id, 'increment')}>+</Button>
                  </div>
                  <Button variant="destructive" onClick={() => handleRemoveItem(item.id)} className="w-full">Remove</Button>
                </div>
              </div>
            </div>
          ))}
          <div className="mt-8 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold dark:text-white">Order Summary</h2>
            <p className="text-gray-500 dark:text-gray-300">Total Items: {totalQuantity}</p>
            <p className="text-gray-500 dark:text-gray-300">Total Price: ${totalPrice.toFixed(2)}</p>
            <Button onClick={handleCheckout} className="mt-4">Proceed to Checkout</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CartPage;