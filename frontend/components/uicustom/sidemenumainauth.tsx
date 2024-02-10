'use client'
// make me server later..
import Link from "next/link";
import { MyThemeBtn } from "./themebtn";
import { useEffect, useState } from "react";
import { MySidebarToggleBtn } from "./sidebartogglebtn";
import { authRoutes } from "@/routes";
import { useParams, usePathname } from "next/navigation";
import { LogoutMyAction } from "@/actions/logout";

const LOG_PREFIX = '[[USE CLIENT] sidemenumainauth.tsx.tsx]'
export const MyMenuSide = () => {
  const [isHiddenMainMenuTab, setIsHiddenMainMenuTab] = useState(false);
  const [isHiddenDashboardTab, setIsHiddenDashboardTab] = useState(false);
  const [isHiddenSupportTab, setIsHiddenSupportTab] = useState(false);
  const [isHiddenFooterTab, setIsHiddenfooterTab] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [isAuthRoute, setIsAuthRoute] = useState(false);

  // Toggle functions
  const toggleMainMenu = () => setIsHiddenMainMenuTab(!isHiddenMainMenuTab);
  const toggleDashboardTab = () => setIsHiddenDashboardTab(!isHiddenDashboardTab);
  const toggleSupportTab = () => setIsHiddenSupportTab(!isHiddenSupportTab);
  const toggleFootbar = () => setIsHiddenfooterTab(!isHiddenFooterTab);
  const toggleSidebar = () => setIsSidebarCollapsed(!isSidebarCollapsed);

  const MyauthRoutes = authRoutes;
  const params = usePathname() 
    const useIsAuthRoute = () => {
      const myAuthRouteArray = MyauthRoutes.includes(params);
      setIsAuthRoute(myAuthRouteArray);
    };
    useIsAuthRoute();

  const onClick = () => {
    console.log(`${LOG_PREFIX} LOGOUT Client => LogoutMyAction()`)
    LogoutMyAction()
  }

  return (
    <div className={`MyMenuSideMainRoot ${isSidebarCollapsed ? 'absolute max-w-[64px] max-h-[64px] overflow-hidden' : 'overflow-auto no-scrollbar max-h-screen w-96 max-w-[360px] transition-width duration-300 ease-in-out bg-slate-100 text-black dark:bg-slate-950 dark:text-white'} `}>
      <div className={`MyMenuSideMainHeader flex p-4 ${isSidebarCollapsed ? 'justify-center items-center' : 'justify-between bg-slate-300 dark:bg-slate-900'}`}>
        <h1 className={`MyMenuSideMainHeaderTittle font-bold text-nowrap ${isSidebarCollapsed ? 'hidden' : ''}`}>Auth Sidebar</h1>
        <div className="flex">
          <div onClick={() => toggleSidebar()}>
          <MySidebarToggleBtn />
          </div>
          <div className={`${isSidebarCollapsed ? 'hidden' : ''}`}>
           <MyThemeBtn />
          </div>
        </div>
      </div>
      <div className="MyMenuSideBody LeftSideNav-category flex flex-col justify-between h-max p-4">
        <ul className="space-y-2 text-start">
          <li className={`group w-full px-2 py-1 hover:bg-slate-400/20 hover:dark:bg-slate-600/10 hover:cursor-pointer text-nowrap rounded ${isHiddenMainMenuTab? 'hidden': ''}`}>
            <h1 onClick={toggleMainMenu} className={`bg-red-500/0 font-serif text-start p-4 text-black/40 dark:text-white/40 group-hover:text-black/80 dark:group-hover:text-white/80`}>Main Menu</h1>
            <ul className={`w-full py-1 px-8 pb-8 space-y-1 hover:cursor-pointer text-nowrap rounded ${isHiddenMainMenuTab? 'hidden': ''}`}>
              <Link href='/' className=''><li className={`w-full py-2 px-4 hover:bg-slate-400/20 hover:dark:bg-slate-600/20 hover:font-bold hover:cursor-pointer text-nowrap rounded ${isAuthRoute? '' : ''}`}>Home</li></Link>
              <Link href='/auth/login' className=''><li className={`w-full py-2 px-4 hover:bg-slate-400/20 hover:dark:bg-slate-600/20 hover:font-bold hover:cursor-pointer text-nowrap rounded ${isAuthRoute? '' : 'hidden'}`}>Login</li></Link>
              <Link href='/auth/register' className=''><li className={`w-full py-2 px-4 hover:bg-slate-400/20 hover:dark:bg-slate-600/20 hover:font-bold hover:cursor-pointer text-nowrap rounded ${isAuthRoute? '' : 'hidden'}`}>Register</li></Link>
              <Link href='/dashboard' className=''><li className={`w-full py-2 px-4 hover:bg-slate-400/20 hover:dark:bg-slate-600/20 hover:font-bold hover:cursor-pointer text-nowrap rounded ${isAuthRoute? '' : ''}`}>dashboard</li></Link>
              <Link href='/settings' className=''><li className={`w-full py-2 px-4 hover:bg-slate-400/20 hover:dark:bg-slate-600/20 hover:font-bold hover:cursor-pointer text-nowrap rounded ${isAuthRoute? '' : ''}`}>settings</li></Link>
              { !isAuthRoute && <li onClick={onClick} className={`w-full py-2 px-4 hover:bg-slate-400/20 hover:dark:bg-slate-600/20 hover:font-bold hover:cursor-pointer text-nowrap rounded ${isAuthRoute? '' : ''}`}>Logout</li>}
            </ul>
          </li>
          <li className='group w-full px-2 py-1 hover:bg-slate-400/20 hover:dark:bg-slate-600/10 hover:cursor-pointer text-nowrap rounded'>
            <h1 onClick={toggleDashboardTab} className='bg-red-500/0 font-serif text-start p-4 text-black/40 dark:text-white/40 group-hover:text-black/80 dark:group-hover:text-white/80'>Dashboard</h1>
            <ul className={`w-full py-1 px-8 pb-8  space-y-1 hover:cursor-pointer text-nowrap rounded ${isHiddenDashboardTab? 'hidden': ''}`}>
              <Link href='/' className=''><li className={`w-full py-2 px-4 hover:bg-slate-400/20 hover:dark:bg-slate-600/20 hover:font-bold hover:cursor-pointer text-nowrap rounded ${isAuthRoute? '' : ''}`}>Overview</li></Link>
              <Link href='/' className=''><li className={`w-full py-2 px-4 hover:bg-slate-400/20 hover:dark:bg-slate-600/20 hover:font-bold hover:cursor-pointer text-nowrap rounded ${isAuthRoute? '' : ''}`}>Inventory</li></Link>
              <Link href='/' className=''><li className={`w-full py-2 px-4 hover:bg-slate-400/20 hover:dark:bg-slate-600/20 hover:font-bold hover:cursor-pointer text-nowrap rounded ${isAuthRoute? '' : ''}`}>Stats</li></Link>
              <Link href='/' className=''><li className={`w-full py-2 px-4 hover:bg-slate-400/20 hover:dark:bg-slate-600/20 hover:font-bold hover:cursor-pointer text-nowrap rounded ${isAuthRoute? '' : ''}`}>Profile</li></Link>
              <Link href='/' className=''><li className={`w-full py-2 px-4 hover:bg-slate-400/20 hover:dark:bg-slate-600/20 hover:font-bold hover:cursor-pointer text-nowrap rounded ${isAuthRoute? '' : ''}`}>Users</li></Link>
              <Link href='/' className=''><li className={`w-full py-2 px-4 hover:bg-slate-400/20 hover:dark:bg-slate-600/20 hover:font-bold hover:cursor-pointer text-nowrap rounded ${isAuthRoute? '' : ''}`}>Guilds</li></Link>
              <Link href='/' className=''><li className={`w-full py-2 px-4 hover:bg-slate-400/20 hover:dark:bg-slate-600/20 hover:font-bold hover:cursor-pointer text-nowrap rounded ${isAuthRoute? '' : ''}`}>Settings</li></Link>
            </ul>
          </li>
          <li className='group w-full px-2 py-1 hover:bg-slate-400/20 hover:dark:bg-slate-600/10 hover:cursor-pointer text-nowrap rounded'>
            <h1 onClick={toggleSupportTab} className='bg-red-500/0 font-serif text-start p-4 text-black/40 dark:text-white/40 group-hover:text-black/80 dark:group-hover:text-white/80'>Support</h1>
            <ul className={`w-full py-1 px-8 pb-8  space-y-1 hover:cursor-pointer text-nowrap rounded ${isHiddenSupportTab? 'hidden': ''}`}>
              <Link href='/' className=''><li className={`w-full py-2 px-4 hover:bg-slate-400/20 hover:dark:bg-slate-600/20 hover:font-bold hover:cursor-pointer text-nowrap rounded ${isAuthRoute? '' : ''}`}>Sales and refund</li></Link>
              <Link href='/' className=''><li className={`w-full py-2 px-4 hover:bg-slate-400/20 hover:dark:bg-slate-600/20 hover:font-bold hover:cursor-pointer text-nowrap rounded ${isAuthRoute? '' : ''}`}>Shipping and delivery</li></Link>
              <Link href='/' className=''><li className={`w-full py-2 px-4 hover:bg-slate-400/20 hover:dark:bg-slate-600/20 hover:font-bold hover:cursor-pointer text-nowrap rounded ${isAuthRoute? '' : ''}`}>Technical support</li></Link>
              <Link href='/' className=''><li className={`w-full py-2 px-4 hover:bg-slate-400/20 hover:dark:bg-slate-600/20 hover:font-bold hover:cursor-pointer text-nowrap rounded ${isAuthRoute? '' : ''}`}>Spacial planners</li></Link>
              <Link href='/' className=''><li className={`w-full py-2 px-4 hover:bg-slate-400/20 hover:dark:bg-slate-600/20 hover:font-bold hover:cursor-pointer text-nowrap rounded ${isAuthRoute? '' : ''}`}>Areal arcitecture</li></Link>
            </ul>
          </li>
        </ul>
        <ul className="group space-y-2 text-start">
          <li className='w-full px-2 py-1 hover:bg-slate-400/20 hover:dark:bg-slate-600/10 hover:cursor-pointer text-nowrap rounded'>
            <h1 onClick={toggleFootbar} className='bg-red-500/0 font-serif text-start p-4 text-black/40 dark:text-white/40 group-hover:text-black/80 dark:group-hover:text-white/80'>User</h1>
            <ul className={`w-full py-1 px-8 pb-8  space-y-1 hover:cursor-pointer text-nowrap rounded ${isHiddenFooterTab? 'hidden': ''}`}>
              <Link href='/' className=''><li className={`w-full py-2 px-4 hover:bg-slate-400/20 hover:dark:bg-slate-600/20 hover:font-bold hover:cursor-pointer text-nowrap rounded ${isAuthRoute? '' : ''}`}>Fese</li></Link>
              <Link href='/' className=''><li className={`w-full py-2 px-4 hover:bg-slate-400/20 hover:dark:bg-slate-600/20 hover:font-bold hover:cursor-pointer text-nowrap rounded ${isAuthRoute? '' : ''}`}>Enfis</li></Link>
              <Link href='/' className=''><li className={`w-full py-2 px-4 hover:bg-slate-400/20 hover:dark:bg-slate-600/20 hover:font-bold hover:cursor-pointer text-nowrap rounded ${isAuthRoute? '' : ''}`}>Retail</li></Link>
              <Link href='/' className=''><li className={`w-full py-2 px-4 hover:bg-slate-400/20 hover:dark:bg-slate-600/20 hover:font-bold hover:cursor-pointer text-nowrap rounded ${isAuthRoute? '' : ''}`}>Vintage</li></Link>
              <Link href='/' className=''><li className={`w-full py-2 px-4 hover:bg-slate-400/20 hover:dark:bg-slate-600/20 hover:font-bold hover:cursor-pointer text-nowrap rounded ${isAuthRoute? '' : ''}`}>Artistic</li></Link>
            </ul>
          </li>
        </ul>
      </div>
    </div>
  );
};