'use client'

import { MyUserInfo } from "@/components/uicustom/user-info";
import { useCurrentUser } from "@/hooks/use-current-user";

const MyProtectedClientPage = () => {
    const currentUser = useCurrentUser(); // currentUser = Session.data.user
    
    if (!currentUser) {
        return <div>Loading... Client component...</div>; // or some loading spinner
    }

    return (
        <MyUserInfo label="Client component" user={currentUser}/>
    )
}
export default MyProtectedClientPage;