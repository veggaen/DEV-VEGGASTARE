import { ExtendedUser } from "@/next-auth";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Badge } from "../ui/badge";

interface UserInfoProps {
    user?: ExtendedUser;
    label: string;
}

export const MyUserInfo = ({user, label}: UserInfoProps) => {

    return(
      <Card className="max-w-[800px] w-full shadow-md">
        <CardHeader>
          <p className="text-2xl font-semibold text-center">
            {label}
          </p>
        </CardHeader>
        <CardContent className="flex flex-col w-full space-y-4">
          <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
            <p className="text-sm font-medium">ID</p>
            <p className="truncate text-md max-w-3/4 p-1 bg-slate-100 dark:bg-slate-900 rounded-sm inline-flex items-center border px-4 py-1 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">{user?.id}</p>
          </div>
          <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
            <p className="text-sm font-medium">Name</p>
            <p className="truncate text-md max-w-[180px] p-1 bg-slate-100 dark:bg-slate-900 rounded-sm inline-flex items-center border px-4 py-1 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">{user?.name}</p>
          </div>
          <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
            <p className="text-sm font-medium">Email</p>
            <p className="truncate text-md max-w-[180px] p-1 bg-slate-100 dark:bg-slate-900 rounded-sm inline-flex items-center border px-4 py-1 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">{user?.email}</p>
          </div>
          <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
            <p className="text-sm font-medium">Image</p>
            <p className="truncate text-md max-w-[180px] p-1 bg-slate-100 dark:bg-slate-900 rounded-sm inline-flex items-center border px-4 py-1 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">{user?.image ? user?.image : 'Empty'}</p>
          </div>
          <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
            <p className="text-sm font-medium">Role</p>
            <p className="truncate text-md max-w-[180px] p-1 bg-slate-100 dark:bg-slate-900 rounded-sm inline-flex items-center border px-4 py-1 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">{user?.role}</p>
          </div>
          <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
            <p className="text-sm font-medium">Refferal</p>
            <p className="truncate text-md max-w-[180px] p-1 bg-slate-100 dark:bg-slate-900 rounded-sm inline-flex items-center border px-4 py-1 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">{user?.referredby ? user?.referredby : 'Empty'}</p>
          </div>
          <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
            <p className="text-sm font-medium">Two Factor Authentication</p>
            <Badge variant={user?.isTwoFactorEnabled ? 'success' : 'destructive'}>{user?.isTwoFactorEnabled ? 'Enabled' : 'Disabled'}</Badge>
          </div>
          
          
        </CardContent>
      </Card>
    )
    
}