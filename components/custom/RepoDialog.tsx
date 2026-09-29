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
    id: string | number,
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
    const [importLoading, setImportLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [importError, setImportError] = useState<string | null>(null);
    const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [directRepoInput, setDirectRepoInput] = useState('');
    const [mode, setMode] = useState<'list' | 'direct'>('list');
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
            const url = userDetail?.id ? `/api/github/repos?userId=${userDetail.id}` : '/api/github/repos';
            const result = await axios.get(url);
            console.log("Fetched repos:", result.data);
            setRepoList(result.data)
        } catch (err: any) {
            console.error("Failed to fetch repositories:", err);
            if (err.response?.status === 401) {
                setError("GitHub App connection needs refresh.");
            } else {
                const errMsg = err.response?.data?.error || err.message || "Failed to load GitHub repositories.";
                setError(errMsg);
            }
        } finally {
            setLoading(false);
        }
    }

    const HandleDirectImport = async () => {
        if (!directRepoInput.trim()) return;
        setImportLoading(true);
        setImportError(null);
        try {
            const result = await axios.post('/api/github/import-repo', { repoInput: directRepoInput });
            const imported: Repo = result.data;
            
            // Add to list if not present and select it
            setRepoList(prev => {
                const exists = prev.some(r => r.full_name.toLowerCase() === imported.full_name.toLowerCase());
                return exists ? prev : [imported, ...prev];
            });
            setSelectedRepo(imported);
            setMode('list');
            setSearchTerm(imported.full_name);
        } catch (err: any) {
            console.error("Failed to import repository:", err);
            const errMsg = err.response?.data?.error || err.message || "Failed to find repository on GitHub.";
            setImportError(errMsg);
        } finally {
            setImportLoading(false);
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

        console.log("Saved repo result:", result.data);
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
            <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                    <DialogTitle>Add Repository</DialogTitle>
                    <DialogDescription>
                        Select a repository from your GitHub App installation or import by repository name
                    </DialogDescription>
                </DialogHeader>

                {/* Mode Selector Tabs */}
                <div className="flex border-b text-sm font-medium gap-4">
                    <button 
                        className={`pb-2 border-b-2 ${mode === 'list' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setMode('list')}
                    >
                        Installed Repositories ({repoList.length})
                    </button>
                    <button 
                        className={`pb-2 border-b-2 ${mode === 'direct' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setMode('direct')}
                    >
                        Import by Name / URL
                    </button>
                </div>

                <div className="flex flex-col gap-4 py-2">
                    {mode === 'direct' ? (
                        <div className="flex flex-col gap-3 p-3 bg-gray-50 border rounded-xl">
                            <p className="text-xs text-gray-600 font-medium">
                                Enter any repository name (e.g. <span className="font-mono text-blue-600">username/repo-name</span>) or full GitHub URL:
                            </p>
                            <div className="flex gap-2">
                                <Input 
                                    placeholder="e.g. Hardik180704/my-awesome-project"
                                    value={directRepoInput}
                                    onChange={(e) => setDirectRepoInput(e.target.value)}
                                    disabled={importLoading}
                                    onKeyDown={(e) => e.key === 'Enter' && HandleDirectImport()}
                                />
                                <Button 
                                    onClick={HandleDirectImport} 
                                    disabled={importLoading || !directRepoInput.trim()}
                                >
                                    {importLoading ? 'Searching...' : 'Find'}
                                </Button>
                            </div>

                            {importError && (
                                <p className="text-xs text-red-600 bg-red-50 p-2 border border-red-200 rounded-lg">
                                    ❌ {importError}
                                </p>
                            )}
                        </div>
                    ) : (
                        <>
                            <Input 
                                placeholder='Filter by Name (e.g. my-app)' 
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
                                        <p className="text-xs text-red-600">
                                            Re-install the GitHub App or import your repository directly by name.
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className="text-blue-700 border-blue-300 bg-white hover:bg-blue-50"
                                            onClick={() => window.location.href = '/api/github/app'}
                                        >
                                            Reinstall GitHub App
                                        </Button>
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className="text-gray-700 border-gray-300 bg-white hover:bg-gray-50"
                                            onClick={() => setMode('direct')}
                                        >
                                            Import by Name
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {!loading && !error && (
                                <ul className='max-h-60 overflow-y-auto border rounded-xl'>
                                    {filterRepoList.length === 0 ? (
                                        <li className="p-6 text-center text-gray-500 text-sm flex flex-col gap-3">
                                            <span>No repositories found in your installation.</span>
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="w-fit mx-auto text-blue-600 border-blue-200"
                                                onClick={() => setMode('direct')}
                                            >
                                                Import Repository by Name (e.g. owner/repo)
                                            </Button>
                                        </li>
                                    ) : (
                                        filterRepoList.map((repo) => (
                                            <li 
                                                key={repo.id}
                                                className={`p-4 border-b hover:bg-gray-100 cursor-pointer last:border-b-0 flex justify-between items-center ${
                                                    selectedRepo?.id === repo.id ? 'bg-blue-50 border-l-4 border-l-blue-600 font-medium' : ''
                                                }`}
                                                onClick={() => setSelectedRepo(repo)}
                                            >
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-semibold">{repo.full_name}</span>
                                                    {repo.description && (
                                                        <span className="text-xs text-gray-500 truncate max-w-[320px]">{repo.description}</span>
                                                    )}
                                                </div>
                                                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                                                    {repo.language || 'Code'}
                                                </span>
                                            </li>
                                        ))
                                    )}
                                </ul>
                            )}
                        </>
                    )}
                </div>

                <DialogFooter className='flex gap-2 sm:gap-0'>
                    <DialogClose asChild>
                        <Button type="button" variant="ghost">Cancel</Button>
                    </DialogClose>
                    <Button onClick={() => SaveRepoToDB()} disabled={loading || !selectedRepo}>
                        {selectedRepo ? `Add ${selectedRepo.name}` : 'Add Repo'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default RepoDialog