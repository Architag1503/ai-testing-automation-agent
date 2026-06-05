"use client"
import { UserDetailContext } from '@/context/UserDetailContext'
import Image from 'next/image'
import React, { useContext, useEffect, useState } from 'react'
import { Button } from '../ui/button'
import { Card, CardContent } from '../ui/card'
import EmptyWorkspace from './EmptyWorkspace'
import axios from 'axios'
import { useRouter } from 'next/navigation'
import RepoDialog from './RepoDialog'
import UserRepoList from './UserRepoList'

export type UserRepo = {
    id: number,
    repoId: number,
    name: string,
    full_name: string,
    private: boolean,
    html_url: string,
    description: string,
    userId: string,
    owner: string,
    updatedAt: string,
    language: string,
    defaultBranch: string
    targetDomain?: string,
    globalInstruction?: string,
}

function WorkspaceBody() {

    const { userDetail } = useContext(UserDetailContext);
    const router = useRouter();
    const [token, setToken] = useState('');
    const [userRepoList, setUserRepoList] = useState<UserRepo[]>([]);

    useEffect(() => {
        GetGithubUserToken();
    }, [])

    useEffect(() => {
        userDetail && GetUserAddedRepoList();
    }, [userDetail])

    const GetGithubUserToken = async () => {
        const result = await axios.get('/api/github/token');
        console.log(result.data.token);
        setToken(result.data.token);
    }

    const onAddRepo = async () => {
        router.push('/api/github')
    }

    const GetUserAddedRepoList = async () => {
        const result = await axios.get('/api/user-repo?userId=' + userDetail?.id);
        console.log(result.data);
        setUserRepoList(result.data);
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
                            : <RepoDialog setRefreshPage={(refresh: boolean) => GetUserAddedRepoList()} />
                    }
                </div>
            </Card>

            {!userRepoList ? <Card className='mt-10'>
                <CardContent>
                    <EmptyWorkspace />
                </CardContent>
            </Card> :
                <UserRepoList repoList={userRepoList} setReload={() => GetUserAddedRepoList()} />}
        </div>
    )
}

export default WorkspaceBody