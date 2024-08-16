"use client";
import React, { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
const web3 = require("@solana/web3.js");
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import Image from "next/image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "../ui/button";

// Handle wallet balance fixed to 2 decimal numbers without rounding
export function toFixed(num: number, fixed: number): string {
  const re = new RegExp(`^-?\\d+(?:\\.\\d{0,${fixed || -1}})?`);
  return num.toString().match(re)![0];
}

const WalletConnection = () => {
  const { connection } = useConnection();
  const { select, wallets, publicKey, disconnect, connecting } = useWallet();

  const [open, setOpen] = useState<boolean>(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [solToUsdcRate, setSolToUsdcRate] = useState<number | null>(null);
  const [userWalletAddress, setUserWalletAddress] = useState<string>("");

  useEffect(() => {
    if (!connection || !publicKey) {
      return;
    }

    connection.onAccountChange(
      publicKey,
      (updatedAccountInfo) => {
        setBalance(updatedAccountInfo.lamports / web3.LAMPORTS_PER_SOL);
      },
      "confirmed"
    );

    // Fetch SOL/USDC price from CoinGecko and CryptoCompare
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

        // Compare the prices and select the most accurate one (you can adjust this logic)
        const mostAccuratePrice = Math.abs(coingeckoPrice - cryptocomparePrice) < 0.5
          ? (coingeckoPrice + cryptocomparePrice) / 2
          : coingeckoPrice;

        setSolToUsdcRate(mostAccuratePrice);
      } catch (error) {
        console.error("Error fetching SOL price:", error);
      }
    };

    fetchSolToUsdcRate();

    connection.getAccountInfo(publicKey).then((info) => {
      if (info) {
        setBalance(info?.lamports / web3.LAMPORTS_PER_SOL);
      }
    });
  }, [publicKey, connection]);

  useEffect(() => {
    setUserWalletAddress(publicKey?.toBase58()!);
  }, [publicKey]);

  const handleWalletSelect = async (walletName: any) => {
    if (walletName) {
      try {
        select(walletName);
        setOpen(false);
      } catch (error) {
        console.log("wallet connection err:", error);
      }
    }
  };

  const handleDisconnect = async () => {
    disconnect();
  };

  const [isCopied, setIsCopied] = useState(false);
  const copyToClipboard = async (content: any) => {
    try {
      await navigator.clipboard.writeText(content);
      setIsCopied(true);
      console.log("Copied to clipboard:", content);
    } catch (error) {
      setIsCopied(false);
      console.error("Unable to copy to clipboard:", error);
    }
  };

  return (
    <div className="text-white">
      <Dialog open={open} onOpenChange={setOpen}>
        <div className="flex gap-2 items-center">
          {!publicKey ? (
            <DialogTrigger asChild>
              <Button variant="vegaNormalBtnBlank" className="">
                {connecting ? "connecting..." : "Connect Wallet"}
              </Button>
            </DialogTrigger>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="vegaNormalBtnBlank" className="bg-black flex justify-start items-center text-clip m-0 p-2 overflow-hidden">
                  <div className="hidden md:block">{`${publicKey.toBase58()}`}</div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[fit] bg-black hover:bg-black">
                <DropdownMenuItem className="flex justify-center">
                  <div className="flex flex-col justify-start items-start w-full">
                    <p>Network: </p>
                    <Button variant="vegaNormalBtnBlank" className="">
                      {`Solana Devnet`}
                    </Button>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem className="flex justify-center">
                  <div className="flex flex-col justify-start items-start group">
                    <div className="flex gap-4">
                      {" "}
                      <p>Address:</p>{" "}
                      <p className="text-[8px] group-active:text-sky-500">(Click to copy)</p>
                    </div>
                    <Button variant="vegaNormalBtnBlank" className="" onClick={() => copyToClipboard(userWalletAddress)}>
                      {userWalletAddress ? userWalletAddress : "Copy Address"}
                    </Button>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem className="">
                  <div className="flex flex-col justify-start items-start">
                    <p>Native Balance:</p>
                    <div className="px-4 py-2">
                      {balance ? (
                        <div className="flex gap-2">
                          <div>{toFixed(balance, 2)} SOL</div>
                          {solToUsdcRate !== null && <div> | {toFixed(balance * solToUsdcRate, 2)} $ USD</div>}
                        </div>
                      ) : (
                        <div>0 SOL</div>
                      )}
                    </div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem className="">
                  <div className="flex flex-col justify-start items-start">
                    <p>Token Balance:</p>
                    <div className="px-4 py-2">
                      {balance ? (
                        <div className="flex gap-2">
                          <div>{toFixed(balance, 2)} SOL</div>
                          {solToUsdcRate !== null && <div> | {toFixed(balance * solToUsdcRate, 2)} $ USD</div>}
                        </div>
                      ) : (
                        <div>0 SOL</div>
                      )}
                    </div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem className="flex justify-center">
                  <Button variant="vegaNormalBtnRed" className="w-full" onClick={handleDisconnect}>
                    Disconnect
                  </Button>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <DialogContent
            className="max-w-[450px] bg-black "
            style={{
              borderRadius: "30px",
            }}
          >
            <div className="flex w-full justify-center items-center ">
              <div className="flex flex-col justify-start items-center space-y-5  w-[300px] md:w-[400px] overflow-y-auto ">
                {wallets.map((wallet) => (
                  <Button
                    key={wallet.adapter.name}
                    onClick={() => handleWalletSelect(wallet.adapter.name)}
                    variant={"ghost"}
                    className=" h-[40px] hover:bg-transparent hover:text-white text-[20px] text-white font-slackey flex w-full justify-center items-center "
                  >
                    <div className="flex">
                      <Image src={wallet.adapter.icon} alt={wallet.adapter.name} height={30} width={30} className="mr-5 " />
                    </div>
                    <div className="font-slackey text-white wallet-name text-[20px]">{wallet.adapter.name}</div>
                  </Button>
                ))}
              </div>
            </div>
          </DialogContent>
        </div>
      </Dialog>
    </div>
  );
};

export default WalletConnection;