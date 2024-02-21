'use client'

import { useState } from "react";
import { MyNavbarProducts } from "../uicustom/product/navbar"
import { MySidebarProductsMenu } from "../uicustom/product/sidebar"
import { useCurrentUser } from "@/hooks/use-current-user";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { motion } from "framer-motion"
import { usePathname } from "next/navigation";

// Correctly define the props for ProductProvider
interface ProductProviderProps {
    children: React.ReactNode;
  }
  
const ProductProvider: React.FC<ProductProviderProps> = ({ children }) => {
  const user = useCurrentUser();
  // State to manage sidebar visibility
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarHidden, setIsSidebarHidden] = useState(false);
  const pathname = usePathname();
  console.log('ProductProvider pathname:', pathname)

  // Function to toggle sidebar visibility
const toggleSidebar = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (isSidebarOpen) { 
        setTimeout(() => {
            console.log("Toggle sidebar visibility");
            setIsSidebarHidden(!isSidebarHidden);
        }, 50);
    } else {
        setIsSidebarHidden(!isSidebarHidden);
    }
    setIsSidebarOpen(isSidebarOpen ? false : true);

};

  return (
    <div className={`productProvider ${isSidebarOpen ? 'flex' : 'flex'} w-screen h-screen`}>
      
      <div className={`${isSidebarOpen ? 'w-full md:w-[360px] md:max-w-[360px]' : 'absolute z-10 top-1 left-1'}`}>
        <div>
          <button onClick={toggleSidebar} className={`sidebar-toggle-btn w-full ${isSidebarOpen ? 'rounded-tr-lg bg-slate-300 dark:bg-slate-950' : 'rounded-r'}`}>
            {isSidebarOpen ? (
              <div className={`flex justify-start items-center h-[56px]`}>
                {user ? (
                    <h1 className="w-full flex justify-between items-center py-2 px-4 font-bold text-center">Welcome, {user.name}! <div className="animate-pulse" ><PanelLeftClose className="h-6 w-6"/></div>  </h1>   
                  ):(
                    <h1 className="w-full py-2 px-4 font-bold text-center">Welcome, Sign in here!</h1>   
                  )   
                }
              </div>
              ) : (
                <div className="animate-pulse"><PanelLeftOpen className="h-8 w-8"/></div>
              )}
          </button>
        </div>
        <div className={`h-fit w-full ${isSidebarHidden ? '' : 'hidden'}`}>
            <MySidebarProductsMenu isOpen={isSidebarOpen}/>
        </div>
      </div>

      <div className={`w-full h-[90vh] flex flex-col justify-start items-center overflow-y-auto`}>
        <div className="hidden md:flex w-full justify-center items-center">
          <MyNavbarProducts />
        </div>
        <div className={`w-full min-w-screen max-w-screen min-h-screen max-h-screen`}>
          {children}
        </div>
      </div>

    </div>
  );
};

export default ProductProvider;

