'use client'
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import MySlate700Image from "../../../public/slate700_1.webp"
import MySlate200Image from "../../../public/slate200_2.webp"
import { useState } from "react";

const LOG_PREFIX = '[[USE CLIENT] login-form.tsx]'
export const MyLoginForm = () => {
    const [errorMessage, setErrorMessage] = useState();

    return (
        <form className="flex flex-col justify-center w-full p-4 sm:p-8 md:p-12 lg:p-24 xl:p-36 lg:py-12 xl:py-12"> {/* action={dispatch} */}
            <div className="flex flex-col md:flex-row w-full justify-center bg-neutral-300 dark:bg-slate-700 max-w-[1440px] rounded-xl overflow-hidden">
              <div className="w-full h-full">
                <div className={`relative flex flex-col items-center justify-center w-full h-72 sm:h-96 md:h-full md:min-h-[720px] transition ease-linear duration-300`}>
                  <Image
                    className={`object-cover hidden dark:block`}
                    src={MySlate700Image} 
                    alt={'LoginAnimationgif'} 
                    fill
                    sizes="100%"
                    priority
                    decoding='async'
                    
                  />
                  <Image
                    className={`object-cover dark:hidden`}
                    src={MySlate200Image} 
                    alt={'LoginAnimationgif'} 
                    fill
                    sizes="100%"
                    priority
                    decoding='async'
                    
                  />
                </div>
              </div>
              <div className="flex flex-col">
                  <div className={` text-white dark:text-white py-1 text-center group w-full bg-green-500/50 dark:bg-emerald-500/50`}>
                <h1 className="font-bold text-xl tracking-[0.03em]">Freedom Store™</h1>
                  </div>
                <div className="p-4 h-full md:min-w-[300px] lg:min-w-[360px] xl:min-w-[420px] lg:min-h-[620px] bg-neutral-400 dark:bg-slate-600">
                  <div className="flex flex-col justify-between p-6 h-full bg-neutral-300 dark:bg-slate-700 w-full rounded-b-lg rounded-t">
                    <div className="UserDataSettingsUserInterface">
                      <div className="flex items-center justify-between">
                        <h1 className="font-bold text-xl sm:text-lg lg:text-xl">Login</h1>
                          <div onClick={() => console.log('clicked...')} className={`hidden bg-white/50 dark:bg-black/50 text-black dark:text-white py-1 text-center transition duration-300 hover:scale-105 rounded group hover:bg-red-300 dark:hover:bg-red-600`}>
                            <div className="px-2 text-sm group-hover:font-semibold group-hover:cursor-pointer">Enable edit</div>
                          </div>
                      </div>
                      <div className='group flex flex-col items-start text'>
                        <label htmlFor="name" className="mb-2 mt-2 block text-xs font-medium text-black/80 dark:text-white/60 group-focus-within:text-black dark:group-focus-within:text-white group-focus-within:scale-110 transition duration-300 ease-in-out">
                          Name
                        </label>
                        <input
                          id="name"
                          name="name"
                          type="text"
                          className="w-full py-1 px-2 pl-4 border disabled:bg-white/60 bg-white dark:disabled:bg-black/50 dark:bg-black/70 border-gray-200 dark:border-gray-500 text-black dark:text-white rounded focus:outline-none  focus:border-blue-400 focus:text-black transform focus:scale-105 duration-300 ease-in-out"
                          placeholder={`Enter a Name`}
                          spellCheck='false'
                        />
                      </div>
                      <div className='group flex flex-col items-start'>
                        <label htmlFor="password" className="mb-2 mt-2 block text-xs font-medium text-black/80 dark:text-white/60 group-focus-within:text-black dark:group-focus-within:text-white group-focus-within:scale-110 transition duration-300 ease-in-out">
                          Password
                        </label>
                        <input
                          id="password"
                          name="password"
                          type="password"
                          className="w-full py-1 px-2 pl-4 border disabled:bg-white/60 bg-white dark:disabled:bg-black/50 dark:bg-black/70 border-gray-200 dark:border-gray-500 placeholder-opacity-100 text-black dark:text-white rounded focus:outline-none  focus:border-blue-400 focus:text-black transform focus:scale-105 duration-300 ease-in-out"
                          placeholder={`Enter a password`}
                          spellCheck='false'
                        />
                      </div>
                    </div>
                    <div className="flex flex-col justify-center items-center text-center gap-3 mt-4">
                    {/* <div className={`${!error ? 'hidden' : 'text-red-600 bg-red-500/10 py-1 px-2 rounded'}`}>{error && error}</div>
                    <div className={`${!validationError ? 'hidden' : 'text-red-600 bg-red-500/10 py-1 px-2 rounded'}`}>{validationError && validationError}</div> */}
                    <div className={`${!errorMessage ? 'hidden' : 'text-red-600 bg-red-500/10 py-1 px-2 rounded'}`}>{errorMessage && errorMessage}</div>
                      <div className={`flex gap-3 justify-between w-full`}>
                        <button type="submit" className={`group transition hover:scale-105 duration-300 ease-linear w-full bg-green-500/50 dark:bg-emerald-500 text-white py-1 text-center rounded hover:bg-green-600/50 dark:hover:bg-emerald-600`}>
                          <div className="transform group-hover:scale-105 group-hover:font-bold font-semibold">{`Login`}</div>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                
              </div>
            </div>
            <div className="text-center text-gray-500 mt-4">- OR -</div>
            <Link
                className="block text-center text-blue-500 hover:underline mt-2"
                href="/register"
            >
                Dont have a account yet? Register
            </Link>
          </form>
    )
}