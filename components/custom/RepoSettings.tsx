import React, { useState } from 'react'
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
import { Settings2 } from 'lucide-react'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { DialogClose } from '@radix-ui/react-dialog'
import { UserRepo } from './WorkspaceBody'
import axios from 'axios'

type props = {
    repo: UserRepo,
    setReload: () => void;
}
function RepoSettings({ repo, setReload }: props) {

    const [isOpen, setIsOpen] = useState(false);
    const [repoSettings, setRepoSettings] = useState({
        targetDomain: repo?.targetDomain || '',
        globalInstruction: repo?.globalInstruction || '',
        testEmail: repo?.testEmail || '',
        testPassword: repo?.testPassword || '',
        clerkSecretKey: repo?.clerkSecretKey || '',
    })

    const handleSaveSettings = async () => {
        const result = await axios.post('/api/user-repo/settings', {
            repoId: repo.repoId,
            targetDomain: repoSettings.targetDomain,
            globalInstruction: repoSettings.globalInstruction,
            testEmail: repoSettings.testEmail,
            testPassword: repoSettings.testPassword,
            clerkSecretKey: repoSettings.clerkSecretKey,
        })

        console.log(result?.data);
        setIsOpen(false);
        setReload();
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => setIsOpen(open)}>
            <DialogTrigger>
                <Button><Settings2 className='h-4 w-4 mr-1' /> Project Config</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className='flex gap-2 items-center'><Settings2 className='text-primary' /> Project/Repo Settings</DialogTitle>
                    <DialogDescription>
                        Configuration project-level defaults used during script generation & execution.
                    </DialogDescription>
                </DialogHeader>
                <div>
                    <div>
                        <label className='text-gray-500'>APP URL / DEFAULT WEBSITE</label>
                        <Input value={repoSettings?.targetDomain}
                            onChange={(e) => setRepoSettings({ ...repoSettings, targetDomain: e.target.value })}
                            placeholder='App url/Domain' className='mt-1' />
                        <p className='text-xs text-gray-400 mt-1'>The target address where automated headless browsers will connect and run test cases.</p>
                    </div>
                    <div className='mt-4'>
                        <label className='text-gray-500'>GLOBAL TEST INSTRUCTION</label>
                        <Textarea value={repoSettings?.globalInstruction}
                            onChange={(e) => setRepoSettings({ ...repoSettings, globalInstruction: e.target.value })}
                            placeholder='Instructions' className='mt-1' />
                        <p className='text-xs text-gray-400 mt-1'>Include any authentication credentials, cookies, setup or teardown instructions. These are automatically appended to Gemini's Prompt</p>
                    </div>
                    <div className='mt-4 pt-4 border-t'>
                        <h4 className='text-sm font-medium text-gray-700 mb-2'>Test Credentials (for auto sign-in)</h4>
                        <div className='grid grid-cols-2 gap-3'>
                            <div>
                                <label className='text-gray-500'>EMAIL</label>
                                <Input value={repoSettings?.testEmail}
                                    onChange={(e) => setRepoSettings({ ...repoSettings, testEmail: e.target.value })}
                                    placeholder='test@example.com' className='mt-1' type='email' />
                            </div>
                            <div>
                                <label className='text-gray-500'>PASSWORD</label>
                                <Input value={repoSettings?.testPassword}
                                    onChange={(e) => setRepoSettings({ ...repoSettings, testPassword: e.target.value })}
                                    placeholder='Password' className='mt-1' type='password' />
                            </div>
                        </div>
                        <p className='text-xs text-gray-400 mt-2'>If provided, the test script will automatically sign in before testing protected routes.</p>
                    </div>
                    <div className='mt-4 pt-4 border-t'>
                        <h4 className='text-sm font-medium text-gray-700 mb-2'>Clerk Secret Key (optional)</h4>
                        <div>
                            <label className='text-gray-500'>CLERK SECRET KEY</label>
                            <Input value={repoSettings?.clerkSecretKey}
                                onChange={(e) => setRepoSettings({ ...repoSettings, clerkSecretKey: e.target.value })}
                                placeholder='sk_test_... or sk_live_...' className='mt-1' type='password' />
                            <p className='text-xs text-gray-400 mt-2'>
                                If provided, the test runner will attempt server-side session injection (fast-path auth). 
                                Otherwise, email/password sign-in through the UI form is used. Get this from 
                                <code className='bg-gray-100 px-1 rounded mx-1 text-[11px]'> Clerk Dashboard → API Keys</code>
                            </p>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose>
                        <Button variant={'outline'}>Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleSaveSettings}>Save Config</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default RepoSettings
