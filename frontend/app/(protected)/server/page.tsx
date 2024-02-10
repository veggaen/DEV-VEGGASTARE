'use client'

import { MyUserInfo } from "@/components/uicustom/user-info";
import { useCurrentUser } from "@/hooks/use-current-user";

const MyProtectedAdminPage = () => {
    const currentUser = useCurrentUser(); // currentUser = Session.data.user
    
    return (
        <MyUserInfo label="admin component" user={currentUser}/>
    )
}
export default MyProtectedAdminPage;