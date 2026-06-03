"use client"

import { UserDetailContext } from '@/context/UserDetailContext';
import axios from 'axios';
import React, { useEffect, useState } from 'react'

function Provider({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {

    const [userDetail, setUserDetail] = useState<any>()
    useEffect(() => {
        CreateNewUser();
    }, [])

    const CreateNewUser = async () => {
        const result = await axios.post('/api/users')
        console.log("Result", result);
        setUserDetail(result.data?.user);
    }
    return (

        <UserDetailContext.Provider value={{ userDetail, setUserDetail }}>
            <div>{children}</div>
        </UserDetailContext.Provider>
    )
}

export default Provider