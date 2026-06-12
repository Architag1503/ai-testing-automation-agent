import React, { useState } from 'react'
import { TestCase } from './UserRepoList'
import { Checkbox } from '../ui/checkbox'
import { Badge } from '../ui/badge'
import { Play, RefreshCcw } from 'lucide-react'
import { Button } from '../ui/button'
import TestCaseSettingDialog from './TestCaseSettingDialog'
import TestExecutionModal from './TextCaseExecution'

type Props = {
    testCases: TestCase[]
    onReload: any
    repository?: any
}

function TestCaseList({ testCases, onReload, repository }: Props) {

    const [selectedTestCases, setSelectedTestCases] = useState<TestCase[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleSelectedTestCase = (checked: boolean | string, testCase: TestCase) => {
        if (checked) {
            setSelectedTestCases((prev: any) => [...prev, testCase])
        } else {
            setSelectedTestCases((prev: any) => prev.filter((item: any) => item.id !== testCase.id))
        }
    }

    const handleRunSelected = () => {
        if (selectedTestCases.length > 0) {
            setIsModalOpen(true);
        }
    }

    const handleModalClose = () => {
        setIsModalOpen(false);
        // Refresh the list after execution so statuses update
        if (testCases.length > 0) {
            onReload(testCases[0].repoId);
        }
    }

    return (
        <div>
            <div className='flex items-center justify-between'>
                <h2 className='font-medium text-primary'>Generated Test Cases</h2>
                <Button size={'sm'} onClick={() => onReload(testCases[0].repoId)}><RefreshCcw className='h-3 w-3 mr-1' /> Refresh</Button>
            </div>
            <div className='border rounded-md mt-3'>
                {testCases.map((testCase, index) => (
                    <div key={index} className='p-4 border-b flex items-center justify-between'>
                        <div className='flex items-center gap-3'>
                            <Checkbox
                                checked={selectedTestCases?.some((item: any) => item.id == testCase?.id)}
                                onCheckedChange={(checked) => handleSelectedTestCase(checked, testCase)} />
                            <div>
                                <h2>{testCase?.title}</h2>
                                <p className='test-xs text-gray-500'>{testCase?.description}</p>
                            </div>
                        </div>
                        <div className='gap-4 flex items-center'>
                            <Badge variant={'secondary'}>{testCase?.type}</Badge>
                            {testCase?.status == 'failed' && <Badge variant={'destructive'} className='text-red-200 font-normal'>{testCase?.status}</Badge>}
                            {testCase?.status == 'passed' && <Badge variant={'default'} className='text-green-200 font-normal bg-green-700'>{testCase?.status}</Badge>}
                            {testCase?.status == 'running' && <Badge variant={'default'} className='text-yellow-200 font-normal bg-yellow-700'>{testCase?.status}</Badge>}
                            <TestCaseSettingDialog testCase={testCase} setReload={onReload} />
                        </div>
                    </div>
                ))}
                <div className='p-4 flex items-center justify-between bg-gray-100'>
                    <h2>Run Selected Test Case</h2>
                    <Button
                        disabled={selectedTestCases?.length === 0}
                        onClick={handleRunSelected}
                    >
                        <Play className='h-4 w-4 mr-2' /> Run Selected
                    </Button>
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