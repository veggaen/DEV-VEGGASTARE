'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import WalletConnection from '@/components/crypto-related/WalletAdapter';

const SOLANA_NETWORK = 'https://api.devnet.solana.com';
const SOLANA_TOKEN_ADDRESS = '59jss4pubSQQbJQqrAatPCc82f7vjbb41FtFZEZgPKk8'; // Receiver address
const LAMPORTS_PER_SOL = 1000000000;

const CheckoutPage = () => {
  const { data: session } = useSession();
  const router = useRouter();
  const { publicKey, wallet, signTransaction } = useWallet();
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
    if (!session || !publicKey || !signTransaction) {
      router.push('/auth/login');
      return;
    }

    try {
      console.log('PublicKey:', publicKey.toBase58());
      console.log('Total Price in SOL:', totalPrice);

      const connection = new Connection(SOLANA_NETWORK);
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(SOLANA_TOKEN_ADDRESS),
          lamports: Math.floor(totalPrice * LAMPORTS_PER_SOL),
        })
      );

      console.log('Transaction:', transaction);

      transaction.feePayer = publicKey;
      const { blockhash } = await connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;

      const signedTransaction = await signTransaction(transaction);
      console.log('Signed Transaction:', signedTransaction);

      const signature = await connection.sendRawTransaction(signedTransaction.serialize());
      await connection.confirmTransaction(signature);

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
      <WalletConnection />
      <Button onClick={handlePayment} className="mt-4">Pay with Solana Wallet</Button>
      <div>
        <p>Receiver Address: {SOLANA_TOKEN_ADDRESS}</p>
      </div>
    </div>
  );
};

export default CheckoutPage;