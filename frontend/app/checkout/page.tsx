"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import WalletConnection from '@/components/crypto-related/WalletAdapter';
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useCurrentUser } from '@/hooks/use-current-user';

const SOLANA_NETWORK = 'https://api.devnet.solana.com';
const SOLANA_TOKEN_RECEIVER_ADDRESS = '59jss4pubSQQbJQqrAatPCc82f7vjbb41FtFZEZgPKk8'; // Receiver address

const CheckoutPage = () => {
  const user = useCurrentUser();
  const router = useRouter();
  const { publicKey, signTransaction } = useWallet();
  const [totalPrice, setTotalPrice] = useState<number>(0);
  const [solToUsdcRate, setSolToUsdcRate] = useState<number | null>(null);
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
      const total = data.items.reduce((sum: number, item: any) => sum + item.quantity * item.product.price, 0);
      setTotalPrice(total);

      // Fetch SOL/USDC rate
      fetchSolToUsdcRate();
    } catch (error) {
      console.error('Error fetching cart items:', error);
    }
  };

  const fetchSolToUsdcRate = async () => {
    try {
      const [coingeckoResponse, cryptocompareResponse] = await Promise.all([
        fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"),
        fetch("https://min-api.cryptocompare.com/data/price?fsym=SOL&tsyms=USD"),
      ]);

      const coingeckoData = await coingeckoResponse.json();
      const cryptocompareData = await cryptocompareResponse.json();

      const coingeckoPrice = coingeckoData.solana.usd;
      const cryptocomparePrice = cryptocompareData.USD;

      // Compare the prices and select the most accurate one
      const mostAccuratePrice = Math.abs(coingeckoPrice - cryptocomparePrice) < 0.5
        ? (coingeckoPrice + cryptocomparePrice) / 2
        : coingeckoPrice;

      setSolToUsdcRate(mostAccuratePrice);
    } catch (error) {
      console.error("Error fetching SOL price:", error);
    }
  };

  const handlePayment = async () => {
    if (!user || !publicKey || !signTransaction) {
      router.push('/auth/login');
      return;
    }

    try {
      const connection = new Connection(SOLANA_NETWORK);
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(SOLANA_TOKEN_RECEIVER_ADDRESS),
          lamports: Math.floor((totalPrice / solToUsdcRate!) * LAMPORTS_PER_SOL),
        })
      );

      transaction.feePayer = publicKey;
      const { blockhash } = await connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;

      const signedTransaction = await signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());
      await connection.confirmTransaction(signature);

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
          commentOrder: `${foundData.items.map((item: any) => item.product.title).join(', ')}`,
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

  function formatWalletAddress(address: string): string {
    if (address.length <= 6) return address; // In case the address is very short
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  }

  return (
    <div className="w-full p-8">
      <h1 className="text-2xl font-bold mb-4">Checkout</h1>
      <p className='w-full'>Total Price: ${totalPrice.toFixed(2)}</p>
      {solToUsdcRate !== null && (
        <p>{`Total Price in SOL: ${(totalPrice / solToUsdcRate).toFixed(4)} SOL`}</p>
      )}
      <WalletConnection />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button onClick={() => setOpen(true)} className="mt-4">Pay now</Button>
        </DialogTrigger>
        <DialogContent className="flex flex-col justify-start items-center md:min-w-fit w-full h-fit bg-black" style={{ borderRadius: '30px' }}>
          <div className="flex justify-center items-center w-full">
            <div className="flex flex-col justify-center items-center w-full">
              <div className='flex flex-col justify-start items-center w-full'>
                <div className='flex flex-col md:flex-row justify-between items-start w-full p-4 md:gap-2'>
                  <p className='whitespace-nowrap'>Send to Address:</p>
                  <p className='hidden md:block'>{SOLANA_TOKEN_RECEIVER_ADDRESS}</p>
                  {publicKey !== null && <p className="md:hidden"> {formatWalletAddress(publicKey && publicKey.toBase58())}</p>}
                </div>
                <div className='flex flex-col md:flex-row justify-between items-start w-full p-4'>
                  <p className='whitespace-nowrap'>Total Price: </p>
                  <p>{totalPrice.toFixed(2)}$</p>
                </div>
                <div className='flex flex-col md:flex-row justify-between items-start w-full p-4'>
                  <p className='whitespace-nowrap'>Total Price in SOL: </p>
                  {solToUsdcRate !== null && ( <p>{`${(totalPrice / solToUsdcRate).toFixed(4)} SOL`}</p> )}
                </div>
              </div>
              <Button onClick={handlePayment} className="mt-4">Confirm Payment</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CheckoutPage;