'use server';

import { MyUserInfo } from "@/components/uicustom/user-info";

import { MyLibUserAuth } from "@/lib/user-auth";

const MyProtectedAdminPage = async () => {
    const currentUser = await MyLibUserAuth(); // currentUser = Session.data.user

    if (!currentUser) {
        return <div>Loading... Admin component...</div>; // or some loading spinner
    }
    
    return (
        <MyUserInfo label="admin component" user={currentUser}/>
    )
}
export default MyProtectedAdminPage;