"use client"
import { UserDetailContext } from '@/context/UserDetailContext'
import Image from 'next/image'
import React, { useContext, useEffect, useState } from 'react'
import { Button } from '../ui/button'
import { Card, CardContent } from '../ui/card'
import EmptyWorkspace from './EmptyWorkspace'
import axios from 'axios'
import RepoDialog from './RepoDialog'
import UserRepoList from './UserRepoList'
import { useSearchParams } from 'next/navigation'

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
    testEmail?: string,
    testPassword?: string,
    clerkSecretKey?: string,
}

function WorkspaceBody() {

    const { userDetail } = useContext(UserDetailContext);
    const [installationId, setInstallationId] = useState<string | null>(null);
    const [userRepoList, setUserRepoList] = useState<UserRepo[]>([]);
    const searchParams = useSearchParams();

    useEffect(() => {
        const queryInstId = searchParams?.get('installation_id');
        if (queryInstId) {
            setInstallationId(queryInstId);
            // Save query installation_id to localStorage as backup
            try { localStorage.setItem('gh_installation_id', queryInstId); } catch (e) {}
        }
        CheckGitHubAppInstallation(queryInstId || undefined);
    }, [searchParams])

    useEffect(() => {
        userDetail && GetUserAddedRepoList();
    }, [userDetail])

    const CheckGitHubAppInstallation = async (paramId?: string) => {
        try {
            const savedLocalId = typeof window !== 'undefined' ? localStorage.getItem('gh_installation_id') : null;
            const targetId = paramId || savedLocalId || '';
            const url = targetId ? `/api/github/app/token?installation_id=${targetId}` : '/api/github/app/token';
            const result = await axios.get(url);
            if (result.data.token) {
                setInstallationId('installed');
            }
        } catch (err) {
            console.log("No GitHub App installation found");
            setInstallationId(null);
        }
    }

    const onInstallApp = async () => {
        window.location.href = '/api/github/app'
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

            <Card className={'mt-5 flex justify-between p-4 border rounded-lg items-center flex-wrap gap-4'}>
                <div className='flex items-center gap-5'>
                    <Image src={'/github.png'} alt={'github'} width={40} height={40} />
                    <div>
                        <h2 className='text-lg font-semibold'>Connect GitHub & Add Repository</h2>
                        <p className='text-xs text-gray-500'>Add any repository from your GitHub App installation or import public repos directly</p>
                    </div>
                </div>
                <div className='flex items-center gap-3'>
                    <RepoDialog setRefreshPage={(refresh: boolean) => GetUserAddedRepoList()} />
                    <Button variant="outline" onClick={onInstallApp}>
                        {installationId ? 'Manage GitHub App' : 'Install GitHub App'}
                    </Button>
                </div>
            </Card>

            {!userRepoList || userRepoList.length === 0 ? <Card className='mt-10'>
                <CardContent>
                    <EmptyWorkspace />
                </CardContent>
            </Card> :
                <UserRepoList repoList={userRepoList} setReload={() => GetUserAddedRepoList()} />}
        </div>
    )
}

export default WorkspaceBody