import React from 'react'
import { UserRepo } from './WorkspaceBody'
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import Image from 'next/image'
import { Button } from '../ui/button'
import { CheckCircle2, ListChecks, Sparkles, TrendingUp, XCircle } from 'lucide-react'

type props = {
    repoList: UserRepo[]
}

function UserRepoList({ repoList }: props) {

    const totalTests = 0
    const passedTests = 0
    const failedTests = 0
    const passRate = totalTests > 0 ? (passedTests / totalTests * 100).toFixed(2) : 0;

    return (
        <div className='mt-10'>
            <h2 className='my-3 font-medium'>REPOSITORIES</h2>
            {repoList.map((repo, index) => (
                <Accordion type="single" collapsible defaultValue="item-1" key={index}>
                    <AccordionItem value="item-1" className='border px-5 rounded-xl'>
                        <AccordionTrigger>
                            <div className='flex items-center gap-5'>
                                <Image src={'/github.png'} alt='github' width={30} height={30} />
                                <div className='flex flex-col items-start gap-1 cursor-pointer'>
                                    <h2 className='cursor-pointer'>{repo.full_name}</h2>
                                    <p className='text-xs text-gray-500 cursor-pointer'>
                                        {repo.defaultBranch} • {repo.language}
                                    </p>
                                </div>
                            </div>
                        </AccordionTrigger>

                        <AccordionContent>
                            <div className='pt-4 space-y-5'>
                                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>

                                    <StatusCard
                                        title="Total Tests"
                                        value={totalTests}
                                        icon={<ListChecks className='h-5 w-5 text-blue-600' />}
                                        bgColor="bg-blue-50"
                                    />

                                    <StatusCard
                                        title="Passed"
                                        value={passedTests}
                                        icon={<CheckCircle2 className='h-5 w-5 text-green-600' />}
                                        bgColor="bg-green-50"
                                    />

                                    <StatusCard
                                        title="Failed"
                                        value={failedTests}
                                        icon={<XCircle className='h-5 w-5 text-red-600' />}
                                        bgColor="bg-red-50"
                                    />

                                    <StatusCard
                                        title="Pass Rate"
                                        value={`${passRate}%`}
                                        icon={<TrendingUp className='h-5 w-5 text-purple-600' />}
                                        bgColor="bg-purple-50"
                                    />
                                </div>

                                <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 border rounded-xl p-4 bg-gray-50'>
                                    <div>
                                        <h3 className='font-medium'>Generate AI Test Cases</h3>
                                        <p className='text-sm text-gray-500 mt-1'>
                                            Analyze this repository and generate automated test cases using AI.
                                        </p>
                                    </div>

                                    <Button className='gap-2'>
                                        <Sparkles className='h-4 w-4' />
                                        Generate Test Cases
                                    </Button>
                                </div>
                            </div>
                        </AccordionContent>

                    </AccordionItem>
                </Accordion>
            ))}
        </div>
    )
}

export default UserRepoList

function StatusCard({
    title,
    value,
    icon,
    bgColor
}: {
    title: string
    value: string | number
    icon: React.ReactNode
    bgColor: string
}) {
    return (
        <div className='border rounded-xl p-4 flex items-center justify-between bg-white'>
            <div>
                <p className='text-sm text-gray-500'>{title}</p>
                <h3 className='text-2xl font-semibold mt-1'>{value}</h3>
            </div>

            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${bgColor}`}>
                {icon}
            </div>
        </div>
    )
}
