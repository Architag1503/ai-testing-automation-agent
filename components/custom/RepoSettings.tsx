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
        testEmail: '',
        testPassword: '',
    })
    const [clearTestCredentials, setClearTestCredentials] = useState(false)
    const [newCiKey, setNewCiKey] = useState('')
    const [isGeneratingCiKey, setIsGeneratingCiKey] = useState(false)

    const handleSaveSettings = async () => {
        const result = await axios.post('/api/user-repo/settings', {
            repoId: repo.repoId,
            targetDomain: repoSettings.targetDomain,
            globalInstruction: repoSettings.globalInstruction,
            testEmail: repoSettings.testEmail,
            testPassword: repoSettings.testPassword,
            clearTestCredentials,
        })

        console.log(result?.data);
        setIsOpen(false);
        setReload();
    }

    const generateCiKey = async () => {
        setIsGeneratingCiKey(true)
        try {
            const response = await axios.post('/api/user-repo/settings', { repoId: repo.repoId, generateCiKey: true })
            setNewCiKey(response.data.ciApiKey)
            setReload()
        } catch (error: any) {
            window.alert(error.response?.data?.error || 'Could not generate CI key')
        } finally { setIsGeneratingCiKey(false) }
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
                        <p className='text-xs text-gray-400 mt-1'>Describe stable setup details and selectors. Keep passwords and API keys in the dedicated credential fields below.</p>
                    </div>
                    <div className='mt-4 pt-4 border-t'>
                        <h4 className='text-sm font-medium text-gray-700 mb-2'>Test Credentials (for auto sign-in)</h4>
                        <div className='grid grid-cols-2 gap-3'>
                            <div>
                                <label className='text-gray-500'>EMAIL</label>
                                <Input value={repoSettings?.testEmail}
                                    onChange={(e) => setRepoSettings({ ...repoSettings, testEmail: e.target.value })}
                                    placeholder={repo.hasTestCredentials ? 'Saved; leave blank to keep' : 'test@example.com'} className='mt-1' type='email' />
                            </div>
                            <div>
                                <label className='text-gray-500'>PASSWORD</label>
                                <Input value={repoSettings?.testPassword}
                                    onChange={(e) => setRepoSettings({ ...repoSettings, testPassword: e.target.value })}
                                    placeholder={repo.hasTestCredentials ? 'Saved; leave blank to keep' : 'Password'} className='mt-1' type='password' />
                            </div>
                        </div>
                        <p className='text-xs text-gray-400 mt-2'>Credentials are stored server-side and are never sent to the AI model. Add them here when tests need to sign in through your app.</p>
                        {repo.hasTestCredentials && <button type='button' onClick={() => setClearTestCredentials(!clearTestCredentials)} className='text-xs text-rose-600 underline mt-2'>{clearTestCredentials ? 'Saved credentials will be removed' : 'Clear saved credentials'}</button>}
                    </div>

                    <div className='mt-4 pt-4 border-t'>
                        <h4 className='text-sm font-medium text-gray-700 mb-2'>CI/CD — GitHub Actions</h4>
                        <p className='text-xs text-gray-400 mb-2'>
                            Add these secrets to your GitHub repository, then create 
                            <code className='bg-gray-100 px-1 rounded mx-1 text-[11px]'>.github/workflows/testrix.yml</code> 
                            (or use the template below).
                        </p>
                        <div className='bg-gray-50 rounded p-3 text-xs font-mono border'>
                            <div className='text-gray-500 mb-1'>Required GitHub Secrets:</div>
                            <div className='text-gray-700'>
                                TESTRIX_API_KEY = {repo.hasCiKey ? "✅ Set (generate or rotate below)" : "⚠️ Generate a key below"}<br/>
                                TESTRIX_REPO_ID = {repo.repoId}<br/>
                                TESTRIX_API_URL = https://app.testrix.ai
                            </div>
                        </div>
                        {newCiKey && <div className='mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs'>Copy this key now; it is shown only once.<Input readOnly value={newCiKey} className='mt-1 font-mono' onFocus={(e) => e.currentTarget.select()} /></div>}
                        <Button type='button' variant='outline' disabled={isGeneratingCiKey} onClick={generateCiKey} className='mt-2'>
                            {isGeneratingCiKey ? 'Generating…' : repo.hasCiKey ? 'Rotate CI API Key' : 'Generate CI API Key'}
                        </Button>
                        <button
                            onClick={() => {
                                const ds = "$";
                                const yml = [
                                    "name: Testrix CI",
                                    "on:",
                                    "  pull_request:",
                                    "    branches: [main]",
                                    "  push:",
                                    "    branches: [main]",
                                    "",
                                    "permissions:",
                                    "  contents: read",
                                    "  statuses: write",
                                    "  pull-requests: write",
                                    "",
                                    "jobs:",
                                    "  test:",
                                    "    runs-on: ubuntu-latest",
                                    "    timeout-minutes: 30",
                                    "    steps:",
                                    "      - uses: actions/checkout@v4",
                                    "      - name: Run Testrix tests",
                                    "        id: testrix",
                                    "        run: |",
                                    "          curl -s -X POST " + ds + "{{ secrets.TESTRIX_API_URL }}/api/github/actions/run \\",
                                    '            -H "Authorization: Bearer ' + ds + '{{ secrets.TESTRIX_API_KEY }}" \\',
                                    '            -H "Content-Type: application/json" \\',
                                    "            -d '{",
                                    '              "repoId": ' + ds + "{{ secrets.TESTRIX_REPO_ID }},",
                                    '              "repoFullName": "' + ds + "{{ github.repository }}\",",
                                    '              "commitSha": "' + ds + "{{ github.event.pull_request.head.sha || github.sha }}\",",
                                    '              "prNumber": ' + ds + "{{ github.event.pull_request.number || 0 }},",
                                    '              "githubToken": "' + ds + '{{ secrets.GITHUB_TOKEN }}"',
                                    "            }'",
                                ].join("\n");
                                navigator.clipboard.writeText(yml);
                                alert("Workflow YAML copied to clipboard!");
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 underline mt-1 inline-block"
                        >
                            Copy workflow YAML
                        </button>
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
