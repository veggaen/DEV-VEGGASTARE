'use client';

import { createContext, useContext, useState } from "react";
import { MySidebarProductsMenu } from "../uicustom/product/sidebar";
import { useCurrentUser } from "@/hooks/use-current-user";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { usePathname } from "next/navigation";

// Define the context props interface
interface SidebarContextProps {
  isSidebarOpen: boolean;
  isSidebarHidden: boolean;
  toggleSidebar: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

// Create the context
const SidebarContext = createContext<SidebarContextProps | undefined>(undefined);

// Create a hook to use the sidebar context
export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a ProductProvider");
  }
  return context;
};

// Define the ProductProvider component
const ProductProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = useCurrentUser();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarHidden, setIsSidebarHidden] = useState(false);
  const pathname = usePathname();

  console.log('ProductProvider pathname:', pathname);

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
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <SidebarContext.Provider value={{ isSidebarOpen, isSidebarHidden, toggleSidebar }}>
      <div className={`productProvider ${isSidebarOpen ? 'flex' : 'flex'} w-full h-full gap-2`}>
        <div className={`${isSidebarOpen ? 'w-full md:w-[360px] md:max-w-[360px]' : 'absolute z-10 top-0 left-1 bottom-0'}`}>
          <div className={`h-full min-h-fit w-full ${isSidebarHidden ? '' : 'hidden'}`}>
            <MySidebarProductsMenu isOpen={isSidebarOpen} />
          </div>
        </div>

        <div className="w-full H-full flex flex-col justify-start items-center overflow-y-auto">
          <div className="w-full min-w-screen max-w-screen min-h-screen flex flex-col justify-start items-center">
            {children}
          </div>
        </div>
      </div>
    </SidebarContext.Provider>
  );
};

export default ProductProvider;