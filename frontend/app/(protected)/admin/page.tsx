'use client'

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ShieldCheckIcon } from "lucide-react";
import { UserRole } from "@prisma/client";

import { RoleGate } from "@/components/uicustom/auth/role-gate";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { admin } from "@/actions/admin";

const MyPageAdmin = () => {
  const onServerActionClick = () => {
    admin()
      .then((data) => {
        if (data.error) {
            toast.error(data.error)
        }
        if (data.success) {
          toast.success(data?.success);
        }

      })
      
  }
  const onApiAdminRouteClick = () => {
    fetch('/api/admin')
      .then((response) => {
        if (response.ok) {
          toast.success('Admin API route Accessed Successfully.')
        } else {
          toast.error('Admin API route Access Forbidden.');
        }
      })
  };
    return (
      <Card className="w-full max-w-600">
        <CardHeader className="flex items-start justify-center">
            <div className="relative flex w-fit">
              <ShieldCheckIcon className="relative top-1 h-10 w-10" />
              <h1 className="text-xl">Admin</h1>
              <span className="absolute top-5 left-10">Administrator</span>
            </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center space-y-8">
          <RoleGate allowedRole={UserRole.ADMIN}>
            <div className="flex flex-col items-center justify-center">
              <h2 className="text-2xl">Admin Page</h2>
              <p className="text-center">
              You are an admin. You have access to everything.
              </p>
            </div>
          </RoleGate>
          <div className="flex w-1/3 flex-col items-center justify-start rounded-lg border p-6 shadow-md">
            <p className="text-sm font-medium py-4 px-2">
                Admin-only API route
            </p>
            <Button onClick={onApiAdminRouteClick}>
                click to test
            </Button>
          </div>
          <div className="flex w-1/3 flex-col items-center justify-start rounded-lg border p-6 shadow-md">
            <p className="text-sm font-medium py-4 px-2">
              Admin-only Server Action
            </p>
            <Button onClick={onServerActionClick}>
              click to test
            </Button>
          </div>
        </CardContent>
      </Card>
    )
}
export default MyPageAdmin;