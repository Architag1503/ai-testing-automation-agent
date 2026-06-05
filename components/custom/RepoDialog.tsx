import React, { useContext, useEffect, useMemo, useState } from 'react'

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from '../ui/button'
import { DialogClose } from '@radix-ui/react-dialog'
import axios from 'axios'
import { Input } from '../ui/input'
import { UserDetailContext } from '@/context/UserDetailContext'

export type Repo = {
    id: string,
    name: string,
    full_name: string,
    private_: boolean,
    html_url: string,
    description: string,
    language: string,
    default_branch: string,
    owner: string
}

function RepoDialog({ setRefreshPage }: { setRefreshPage: (refresh: boolean) => void }) {

    const [repoList, setRepoList] = useState<Repo[]>([])
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedRepo, setSelectedRepo] = useState<Repo | null>();
    const [searchTerm, setSearchTerm] = useState('');
    const { userDetail } = useContext(UserDetailContext);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (isOpen) {
            GetRepoList()
        }
    }, [isOpen])

    const GetRepoList = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await axios.get('/api/github/repos')
            console.log(result.data);
            setRepoList(result.data)
        } catch (err: any) {
            console.error("Failed to fetch repositories:", err);
            const errMsg = err.response?.data?.error || err.message || "Failed to load GitHub repositories.";
            setError(errMsg);
        } finally {
            setLoading(false);
        }
    }

    const filterRepoList = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();

        if (!q) {
            return repoList;
        }

        return repoList.filter(r => r.full_name.toLowerCase().includes(q));
    }, [repoList, searchTerm]);

    const SaveRepoToDB = async () => {

        if (!selectedRepo) {
            return;
        }

        const result = await axios.post('/api/user-repo', {
            repoId: selectedRepo.id,
            name: selectedRepo.name,
            full_name: selectedRepo.full_name,
            private_: selectedRepo.private_,
            html_url: selectedRepo.html_url,
            description: selectedRepo.description,
            userId: userDetail?.id,
            owner: selectedRepo.owner,
            language: selectedRepo.language,
            default_branch: selectedRepo.default_branch,
        })

        console.log("Result", result.data);
        setIsOpen(false);
        setRefreshPage(true);

    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => setIsOpen(open)}>
            <DialogTrigger asChild>
                <Button>
                    + Add Repo
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>Add Repository</DialogTitle>
                    <DialogDescription>
                        Search and select one of your GitHub repositories
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-4 py-2">
                    <Input 
                        placeholder='Search Repo by Name' 
                        onChange={(event) => setSearchTerm(event.target.value)} 
                        disabled={loading}
                    />
                    
                    {loading && (
                        <div className="flex justify-center items-center py-10 text-gray-500 text-sm">
                            <span className="animate-spin mr-2">⏳</span> Loading repositories...
                        </div>
                    )}

                    {error && (
                        <div className="p-4 border border-red-200 bg-red-50 text-red-700 rounded-xl flex flex-col gap-3">
                            <div className="flex flex-col gap-1">
                                <p className="font-semibold text-sm">Error: {error}</p>
                                <p className="text-xs text-red-600">Your GitHub connection might be expired, invalid, or requires re-authentication.</p>
                            </div>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="w-fit text-red-700 border-red-300 bg-white hover:bg-red-50"
                                onClick={() => window.location.href = '/api/github'}
                            >
                                Reconnect GitHub
                            </Button>
                        </div>
                    )}

                    {!loading && !error && (
                        <ul className='max-h-60 overflow-y-auto border rounded-xl'>
                            {filterRepoList.length === 0 ? (
                                <li className="p-8 text-center text-gray-500 text-sm">No repositories found</li>
                            ) : (
                                filterRepoList.map((repo) => (
                                    <li 
                                        key={repo.id}
                                        className={`p-4 border-b hover:bg-gray-100 cursor-pointer last:border-b-0 ${
                                            selectedRepo?.id === repo.id ? 'bg-gray-100 font-medium' : ''
                                        }`}
                                        onClick={() => setSelectedRepo(repo)}
                                    >
                                        {repo.full_name}
                                    </li>
                                ))
                            )}
                        </ul>
                    )}
                </div>
                <DialogFooter className='flex gap-2 sm:gap-0'>
                    <DialogClose asChild>
                        <Button type="button" variant="ghost">Cancel</Button>
                    </DialogClose>
                    <Button onClick={() => SaveRepoToDB()} disabled={loading || !selectedRepo}>Add</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default RepoDialog