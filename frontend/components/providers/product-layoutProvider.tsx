'use client'

import { useState } from "react";
import { MyNavbarProducts } from "../uicustom/product/navbar"
import { MySidebarProductsMenu } from "../uicustom/product/sidebar"
import { useCurrentUser } from "@/hooks/use-current-user";
import { PanelLeftClose } from "lucide-react";

// Correctly define the props for ProductProvider
interface ProductProviderProps {
    children: React.ReactNode;
  }
  
const ProductProvider: React.FC<ProductProviderProps> = ({ children }) => {
  const user = useCurrentUser();
  // State to manage sidebar visibility
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarHidden, setIsSidebarHidden] = useState(false);

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
    <div className={`${isSidebarOpen ? 'flex' : 'flex'} w-full `}>
      
      <div className={`${isSidebarOpen ? 'w-full md:w-[360px] md:max-w-[360px]' : 'absolute z-10 border border-slate-500 hover:border-blue-500'}`}>
        <button onClick={toggleSidebar} className={`sidebar-toggle-btn bg-slate-950 w-full ${isSidebarOpen ? 'rounded-tr-lg' : 'rounded-r'}`}>
        {isSidebarOpen ? (
          <div className={`flex justify-start items-center h-[56px]`}>
            {user ? (
                <h1 className="w-full flex justify-between items-center py-2 px-4 font-bold text-center">Welcome, {user.name}!  <div ><PanelLeftClose className="h-6 w-6"/></div>  </h1>   
              ):(
                <h1 className="w-full py-2 px-4 font-bold text-center">Welcome, Sign in here!</h1>   
              )   
            }
          </div>
          ) : (
            <p className="flex text-wrap p-2 leading-tight font-bold hover:scale-y-105 hover:scale-x-110 hover:text-pink-600 transition duration-300 hover:animate-pulse max-w-8">O p e n</p>
          )}
        </button>
        <div className={`h-full w-full ${isSidebarHidden ? '' : 'hidden'}`}>
            <MySidebarProductsMenu isOpen={isSidebarOpen}/>
        </div>
      </div>

      <div className={`w-full h-[90vh] flex flex-col justify-start items-center overflow-y-auto`}>
        <MyNavbarProducts />
        <div className={`w-full h-fit`}>
          {children}
        </div>
      </div>

    </div>
  );
};

export default ProductProvider;

