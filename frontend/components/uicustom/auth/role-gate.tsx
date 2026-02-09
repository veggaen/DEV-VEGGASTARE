'use client';

import { UseCurrentRole } from "@/hooks/use-current-role";
import { UserRole } from "@/generated/prisma/browser";
import { MyFormError } from "@/components/uicustom/forms/form-error";

interface RoleGateProps {
    children: React.ReactNode;
    allowedRole: UserRole;
};

export const RoleGate = ({children, allowedRole}: RoleGateProps) => {
    const role = UseCurrentRole();

    if (role !== allowedRole){
      return <MyFormError message="You are not authorized with permissions to view this page."/>;
    }  

    return (
      <>
        {children}
      </>
    );
};