import React, { useState } from 'react'
import { TestCase } from './UserRepoList'
import { Checkbox } from '../ui/checkbox'
import { Badge } from '../ui/badge'
import { Play, RefreshCcw, Trash2, Sparkles } from 'lucide-react'
import { Button } from '../ui/button'
import TestCaseSettingDialog from './TestCaseSettingDialog'
import TestExecutionModal from './TextCaseExecution'
import AddTestCaseDialog from './AddTestCaseDialog'
import axios from 'axios'

type Props = {
    testCases: TestCase[]
    onReload: any
    repository?: any
    userId?: string
}

function TestCaseList({ testCases, onReload, repository, userId }: Props) {

    const [selectedTestCases, setSelectedTestCases] = useState<TestCase[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [deleting, setDeleting] = useState<number[]>([]);
    const [generating, setGenerating] = useState(false);

    const handleSelectedTestCase = (checked: boolean | string, testCase: TestCase) => {
        if (checked) {
            setSelectedTestCases((prev: any) => [...prev, testCase])
        } else {
            setSelectedTestCases((prev: any) => prev.filter((item: any) => item.id !== testCase.id))
        }
    }

    const handleSelectAll = (checked: boolean | string) => {
        if (checked) {
            setSelectedTestCases([...testCases])
        } else {
            setSelectedTestCases([])
        }
    }

    const handleRunSelected = () => {
        if (selectedTestCases.length > 0) {
            setIsModalOpen(true);
        }
    }

    const handleModalClose = () => {
        setIsModalOpen(false);
        if (testCases.length > 0) {
            onReload(testCases[0].repoId);
        }
    }

    const handleDelete = async (ids: number[]) => {
        if (!ids.length) return
        setDeleting((prev) => [...prev, ...ids])
        try {
            await axios.delete('/api/test-cases', { data: { ids } })
            setSelectedTestCases((prev) => prev.filter((tc) => !ids.includes(tc.id)))
            onReload(testCases[0]?.repoId)
        } catch (e) {
            console.error(e)
        }
        setDeleting((prev) => prev.filter((id) => !ids.includes(id)))
    }

    const handleRegenerate = async () => {
        if (!repository || !userId) return
        setGenerating(true)
        try {
            await axios.post('/api/generate-test-cases', {
                userId,
                repoId: repository.repoId,
                owner: repository.owner,
                repo: repository.name,
                branch: repository.defaultBranch,
            })
            onReload(testCases[0]?.repoId)
        } catch (e) {
            console.error(e)
        }
        setGenerating(false)
    }

    const allSelected = selectedTestCases.length === testCases.length && testCases.length > 0

    return (
        <div>
            <div className='flex items-center justify-between flex-wrap gap-2'>
                <h2 className='font-medium text-primary'>Generated Test Cases</h2>
                <div className='flex items-center gap-2'>
                    {repository && userId && (
                        <AddTestCaseDialog
                            userId={userId}
                            repoId={repository.repoId}
                            repoName={repository.name}
                            repoOwner={repository.owner}
                            branch={repository.defaultBranch}
                            onCreated={() => onReload(testCases[0]?.repoId)}
                        />
                    )}
                    {repository && userId && testCases.length > 0 && (
                        <Button size={'sm'} variant={'outline'} disabled={generating} onClick={handleRegenerate}>
                            <Sparkles className={`h-3 w-3 mr-1 ${generating ? 'animate-spin' : ''}`} />
                            Regenerate
                        </Button>
                    )}
                    <Button size={'sm'} onClick={() => onReload(testCases[0]?.repoId)}><RefreshCcw className='h-3 w-3 mr-1' /> Refresh</Button>
                </div>
            </div>
            <div className='border rounded-md mt-3'>
                {testCases.map((testCase, index) => {
                    const isDeleting = deleting.includes(testCase.id)
                    return (
                        <div key={index} className={`p-4 border-b flex items-center justify-between ${isDeleting ? 'opacity-40 pointer-events-none' : ''}`}>
                            <div className='flex items-center gap-3'>
                                <Checkbox
                                    checked={selectedTestCases?.some((item: any) => item.id == testCase?.id)}
                                    onCheckedChange={(checked) => handleSelectedTestCase(checked, testCase)} />
                                <div>
                                    <h2>{testCase?.title}</h2>
                                    <p className='text-xs text-gray-500'>{testCase?.description}</p>
                                </div>
                            </div>
                            <div className='gap-4 flex items-center'>
                                <Badge variant={'secondary'}>{testCase?.type}</Badge>
                                {testCase?.status == 'failed' && <Badge variant={'destructive'} className='text-red-200 font-normal'>{testCase?.status}</Badge>}
                                {testCase?.status == 'passed' && <Badge variant={'default'} className='text-green-200 font-normal bg-green-700'>{testCase?.status}</Badge>}
                                {testCase?.status == 'running' && <Badge variant={'default'} className='text-yellow-200 font-normal bg-yellow-700'>{testCase?.status}</Badge>}
                                <TestCaseSettingDialog testCase={testCase} setReload={() => onReload(testCases[0]?.repoId)} />
                                <Button
                                    size={'icon'}
                                    variant={'ghost'}
                                    className='text-red-500 hover:text-red-700 hover:bg-red-50'
                                    onClick={() => handleDelete([testCase.id])}
                                    disabled={isDeleting}
                                >
                                    <Trash2 className='h-4 w-4' />
                                </Button>
                            </div>
                        </div>
                    )
                })}
                <div className='p-4 flex items-center justify-between bg-gray-100 flex-wrap gap-2'>
                    <div className='flex items-center gap-3'>
                        <Checkbox
                            checked={allSelected}
                            onCheckedChange={(checked) => handleSelectAll(checked)}
                        />
                        <h2>{selectedTestCases.length > 0 ? `${selectedTestCases.length} Selected` : 'Run Selected Test Case'}</h2>
                    </div>
                    <div className='flex items-center gap-2'>
                        {selectedTestCases.length > 0 && (
                            <Button
                                variant={'destructive'}
                                size={'sm'}
                                onClick={() => handleDelete(selectedTestCases.map(tc => tc.id))}
                                disabled={deleting.length > 0}
                            >
                                <Trash2 className='h-4 w-4 mr-1' /> Delete Selected
                            </Button>
                        )}
                        <Button
                            disabled={selectedTestCases?.length === 0}
                            onClick={handleRunSelected}
                        >
                            <Play className='h-4 w-4 mr-2' /> Run Selected
                        </Button>
                    </div>
                </div>
            </div>

            {/* Execution Modal */}
            <TestExecutionModal
                isOpen={isModalOpen}
                onClose={handleModalClose}
                testCases={selectedTestCases}
                repository={repository}
            />
        </div>
    )
}

export default TestCaseList
