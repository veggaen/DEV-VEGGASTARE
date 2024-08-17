'use client'

import { LogoutMyAction } from "@/actions/logout";
import { signOut } from "next-auth/react"

interface LoutoutButtonProps {
    children?: React.ReactNode;
};
const LOG_PREFIX = '[frontend/components/uicustom/auth/buttons/logout-button.tsx]'
export const MyLogoutButton = ({children}: LoutoutButtonProps) => {
  const onClick = () => {
    console.log(`${LOG_PREFIX} LOGOUT Client => LogoutMyAction()`)
    signOut()

  }

  return (
    <div onClick={onClick} className="curson-pointer">
      {children}
    </div>
  )
}

