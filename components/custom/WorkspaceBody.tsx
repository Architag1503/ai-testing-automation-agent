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

export type UserRepo = {
    id: number,
    repoId: number,
    name: string,
    full_name: string,
    private: boolean,
    html_url: string,
    description: string,
    userId: number,
    owner: string,
    updatedAt: string,
    language: string,
    defaultBranch: string
    targetDomain?: string,
    globalInstruction?: string,
    hasTestCredentials?: boolean,
    hasClerkAuth?: boolean,
    hasCiKey?: boolean,
}

function WorkspaceBody() {

    const { userDetail } = useContext(UserDetailContext);
    const [installationId, setInstallationId] = useState<string | null>(null);
    const [userRepoList, setUserRepoList] = useState<UserRepo[]>([]);
    const [githubError, setGithubError] = useState<string | null>(null);

    const CheckGitHubAppInstallation = async () => {
        try {
            await axios.get('/api/github/app/token');
            setInstallationId('installed');
        } catch (err) {
            console.log("No GitHub App installation found");
            setInstallationId(null);
        }
    }

    const onInstallApp = async () => {
        window.location.href = '/api/github/app'
    }

    const GetUserAddedRepoList = async () => {
        const result = await axios.get('/api/user-repo');
        setUserRepoList(result.data);
    }

    useEffect(() => {
        CheckGitHubAppInstallation();
        const reason = new URLSearchParams(window.location.search).get('githubError');
        const messages: Record<string, string> = {
            not_configured: 'GitHub App setup is incomplete. Set GITHUB_APP_NAME to the app slug, and configure GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY in Render and Vercel.',
            credentials_invalid: 'The GitHub App credentials are invalid. Verify GITHUB_APP_ID and upload the matching RSA private key in Render and Vercel.',
            setup_url_invalid: 'GITHUB_APP_SETUP_URL is not a valid URL. Set it to your production domain followed by /api/github/app/callback.',
            app_url_invalid: 'NEXT_PUBLIC_APP_URL is invalid. Set it to this deployment’s public HTTPS URL.',
            setup_url_mismatch: 'GitHub App setup URLs do not match. Set GITHUB_APP_SETUP_URL and the GitHub App Setup URL to this domain’s /api/github/app/callback, and turn off “Request user authorization (OAuth) during installation”.',
            invalid_callback: 'GitHub did not return a valid installation. Retry the install and approve repository access.',
            installation_failed: 'GitHub installation could not be verified. Check GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY, then try again.',
        };
        if (reason && messages[reason]) {
            setGithubError(messages[reason]);
            const cleanUrl = new URL(window.location.href);
            cleanUrl.searchParams.delete('githubError');
            window.history.replaceState({}, '', cleanUrl);
        }
    }, [])
    useEffect(() => { if (userDetail) GetUserAddedRepoList(); }, [userDetail])

    return (
        <div>
            {githubError && <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{githubError}</div>}
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
