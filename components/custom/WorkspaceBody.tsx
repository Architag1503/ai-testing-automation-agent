"use client"
import { UserDetailContext } from '@/context/UserDetailContext'
import Image from 'next/image'
import React, { useContext, useEffect, useState } from 'react'
import { Button } from '../ui/button'
import { Card, CardContent } from '../ui/card'
import EmptyWorkspace from './EmptyWorkspace'
import axios from 'axios'
import { useRouter } from 'next/navigation'

function WorkspaceBody() {

    const { userDetail } = useContext(UserDetailContext);
    const router = useRouter();
    const [token, setToken] = useState('');

    useEffect(() => {
        GetGithubUserToken();
    }, [])

    const GetGithubUserToken = async () => {
        const result = await axios.get('/api/github/token');
        console.log(result.data.token);
        setToken(result.data.token);
    }

    const onAddRepo = async () => {
        router.push('/api/github')
    }

    return (
        <div>
            <div className='flex justify-between items-center'>
                <h2 className='text-4xl font-medium'>Workspace</h2>
                <h2 className='text-blue-800 bg-blue-100 px-2 rounded-lg'>Remaining Credits: {userDetail?.credits}</h2>
            </div>

            <Card className={'mt-5 flex justify-between p-4 border rounded-lg'}>
                <div className='flex items-center gap-5'>
                    <Image src={'/github.png'} alt={'github'} width={40} height={40} />
                    <h2 className='text-lg'>Connect Github & Add Repository</h2>
                </div>
                <div>
                    {
                        !token ? <Button onClick={onAddRepo}>Setup</Button>
                            : <Button>+ Add Repo</Button>
                    }
                </div>
            </Card>

            <Card className='mt-10'>
                <CardContent>
                    <EmptyWorkspace />
                </CardContent>
            </Card>
        </div>
    )
}

export default WorkspaceBody