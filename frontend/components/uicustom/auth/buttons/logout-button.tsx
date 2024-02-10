'use client';

import { LogoutMyAction } from "@/actions/logout";

interface LoutoutButtonProps {
    children?: React.ReactNode;
};
const LOG_PREFIX = '[[USE CLIENT]logout-button.tsx]'
export const MyLogoutButton = ({children}: LoutoutButtonProps) => {
  const onClick = () => {
    console.log(`${LOG_PREFIX} LOGOUT Client => LogoutMyAction()`)
    LogoutMyAction()
  }

  return (
    <div onClick={onClick} className="curson-pointer">
      {children}
    </div>
  )
}