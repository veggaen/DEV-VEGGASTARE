'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import CoinbaseWalletSDK from '@coinbase/wallet-sdk';
import { Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';

const APP_NAME = 'VEGA COIN';
const APP_LOGO_URL = 'https://plus.unsplash.com/premium_photo-1672660509844-449cb70bfcbe?q=80&w=1430&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D';
const SOLANA_NETWORK = 'ams62.nodes.rpcpool.com';
const SOLANA_TOKEN_ADDRESS = '59jss4pubSQQbJQqrAatPCc82f7vjbb41FtFZEZgPKk8'; // New Address: 59jss4pubSQQbJQqrAatPCc82f7vjbb41FtFZEZgPKk8 or my old address: Bmm2RU2g6LGd4UFmYDp8YvUwonhkvz44D3EMkccq3FZs
const LAMPORTS_PER_SOL = 1000000000;

const CheckoutPage = () => {
  const { data: session } = useSession();
  const router = useRouter();
  const [totalPrice, setTotalPrice] = useState<number>(0);

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

    const coinbaseWallet = new CoinbaseWalletSDK({
      appName: APP_NAME,
      appLogoUrl: APP_LOGO_URL,
      darkMode: false,
    });

    const provider = coinbaseWallet.makeWeb3Provider(SOLANA_NETWORK, 1);
    await provider.enable();

    const connection = new Connection(SOLANA_NETWORK);
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    const fromAddress = accounts[0];

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: new PublicKey(fromAddress),
        toPubkey: new PublicKey(SOLANA_TOKEN_ADDRESS),
        lamports: totalPrice * LAMPORTS_PER_SOL,
      })
    );

    const { signature } = await provider.signTransaction(transaction);

    await connection.confirmTransaction(signature);

    console.log('Transaction successful with signature:', signature);
  };

  return (
    <div className="w-full p-8">
      <h1 className="text-2xl font-bold mb-4">Checkout</h1>
      <p>Total Price: ${totalPrice.toFixed(2)}</p>
      <Button onClick={handlePayment} className="mt-4">Pay with Coinbase Wallet</Button>
    </div>
  );
};

export default CheckoutPage;