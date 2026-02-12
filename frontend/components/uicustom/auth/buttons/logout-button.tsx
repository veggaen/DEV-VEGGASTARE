'use client'

import { useCleanLogout } from "@/hooks/use-clean-logout";

interface LoutoutButtonProps {
    children?: React.ReactNode;
};
const LOG_PREFIX = '[frontend/components/uicustom/auth/buttons/logout-button.tsx]'
export const MyLogoutButton = ({children}: LoutoutButtonProps) => {
  const cleanLogout = useCleanLogout();

  const onClick = () => {
    console.log(`${LOG_PREFIX} LOGOUT Client => cleanLogout()`)
    cleanLogout()
  }

  return (
    <div onClick={onClick} className="curson-pointer">
      {children}
    </div>
  )
}

