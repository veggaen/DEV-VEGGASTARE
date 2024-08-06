'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import WalletConnection from '@/components/crypto-related/WalletAdapter';
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useCurrentUser } from '@/hooks/use-current-user';

const SOLANA_NETWORK = 'https://api.devnet.solana.com';
const SOLANA_TOKEN_ADDRESS = '59jss4pubSQQbJQqrAatPCc82f7vjbb41FtFZEZgPKk8'; // Receiver address
const LAMPORTS_PER_SOL = 1000000000;

const CheckoutPage = () => {
  const user = useCurrentUser();
  const router = useRouter();
  const { publicKey, signTransaction } = useWallet();
  const [totalPrice, setTotalPrice] = useState<number>(0);
  const [foundData, setFoundData] = useState<any>();
  const [open, setOpen] = useState<boolean>(false);

  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
    } else {
      fetchCartItems();
    }
  }, [user]);

  const fetchCartItems = async () => {
    try {
      const response = await fetch(`/api/cart/${user?.id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch cart items');
      }
      const data = await response.json();
      setFoundData(data);
      console.log('foundData: ',foundData);
      if (data.items) {
        console.log('foundDataMap:', data.items.map(item => item.product.title).join(', '));
      }
      const total = data.items.reduce((sum: number, item: any) => sum + item.quantity * item.product.price, 0);
      setTotalPrice(total);
    } catch (error) {
      console.error('Error fetching cart items:', error);
    }
  };

  const handlePayment = async () => {
    if (!user || !publicKey || !signTransaction) {
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

      // Create order in the database
      await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          totalAmount: totalPrice,
          transactionId: signature,
          method: 'COINBASE',
          commentOrder: `${foundData.items.map(item => item.product.title).join(', ')}`,
          commentPay: 'Payment was smooth',
        }),
      });

      // Clear the cart and redirect to order confirmation
      await fetch(`/api/cart/${user.id}`, { method: 'DELETE' });
      router.push('/order-confirmation');
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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button onClick={() => setOpen(true)} className="mt-4">Pay now</Button>
        </DialogTrigger>
        <DialogContent className="w-full h-fit bg-black" style={{ borderRadius: '30px' }}>
          <div className="flex justify-center items-center">
            <div className="flex flex-col justify-start items-center space-y-5">
              <p>Total Price: ${totalPrice.toFixed(2)}</p>
              <p>{`Total Price in SOL: ${totalPrice}`}</p>
              <p>Receiver Address: {SOLANA_TOKEN_ADDRESS}</p>
              <Button onClick={handlePayment} className="mt-4">Confirm Payment</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CheckoutPage;