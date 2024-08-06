'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';

const APP_NAME = 'VEGA COIN';
const APP_LOGO_URL = 'https://plus.unsplash.com/premium_photo-1672660509844-449cb70bfcbe?q=80&w=1430&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D';
const SOLANA_NETWORK = 'https://api.devnet.solana.com'; // Use Solana devnet endpoint
const SOLANA_TOKEN_ADDRESS = '59jss4pubSQQbJQqrAatPCc82f7vjbb41FtFZEZgPKk8'; // Receiver address
const LAMPORTS_PER_SOL = 1000000000;

const CheckoutPage = () => {
  const { data: session } = useSession();
  const router = useRouter();
  const [totalPrice, setTotalPrice] = useState<number>(0);
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  useEffect(() => {
    if (!session) {
      router.push('/auth/login');
    } else {
      fetchCartItems();
    }
  }, [session]);

  const fetchCartItems = async () => {
    try {
      const response = await fetch(`/api/cart/${session?.user?.id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch cart items');
      }
      const data = await response.json();
      const total = data.items.reduce((sum: number, item: any) => sum + item.quantity * item.product.price, 0);
      setTotalPrice(total);
    } catch (error) {
      console.error('Error fetching cart items:', error);
    }
  };

  const handlePayment = async () => {
    if (!session) {
      router.push('/auth/login');
      return;
    }

    if (!publicKey) {
      alert('Please connect your wallet first.');
      return;
    }

    try {
      console.log('From Address:', publicKey.toBase58());
      console.log('Total Price in SOL:', totalPrice);

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(SOLANA_TOKEN_ADDRESS),
          lamports: Math.floor(totalPrice * LAMPORTS_PER_SOL),
        })
      );

      transaction.feePayer = publicKey;
      transaction.recentBlockhash = (await connection.getRecentBlockhash()).blockhash;

      console.log('Transaction:', transaction);

      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature, 'processed');

      console.log('Transaction successful with signature:', signature);
      alert('Payment successful!');
    } catch (error) {
      console.error('Error during payment:', error);
      alert('Payment failed.');
    }
  };

  return (
    <div className="w-full p-8">
      <h1 className="text-2xl font-bold mb-4">Checkout</h1>
      <p>Total Price: ${totalPrice.toFixed(2)}</p>
      <p>{`Total Price in SOL: ${totalPrice}`}</p>
      <Button onClick={handlePayment} className="mt-4">Pay with Solana Wallet</Button>
      <div>
        <p>Receiver Address: {SOLANA_TOKEN_ADDRESS}</p>
      </div>
    </div>
  );
};

export default CheckoutPage;