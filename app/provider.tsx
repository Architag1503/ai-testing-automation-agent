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
    const [subscriptions, setSubscriptions] = useState<any[]>([])
    useEffect(() => {
        CreateNewUser();
    }, [])

    const CreateNewUser = async () => {
        const result = await axios.post('/api/users')
        console.log("Result", result);
        setUserDetail(result.data?.user);
        try {
            const subResult = await axios.get('/api/subscriptions')
            setSubscriptions(subResult.data?.subscriptions || [])
        } catch (e) {
            console.log("Error fetching subscriptions:", e)
        }
    }
    return (

        <UserDetailContext.Provider value={{ userDetail, setUserDetail, subscriptions, setSubscriptions }}>
            <div>{children}</div>
        </UserDetailContext.Provider>
    )
}

export default Provider