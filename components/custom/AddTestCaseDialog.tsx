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
import { Plus } from 'lucide-react'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { DialogClose } from '@radix-ui/react-dialog'
import axios from 'axios'

type Props = {
    userId: string
    repoId: number
    repoName: string
    repoOwner: string
    branch?: string
    onCreated: () => void
}

function AddTestCaseDialog({ userId, repoId, repoName, repoOwner, branch, onCreated }: Props) {
    const [form, setForm] = useState({
        title: '',
        description: '',
        targetRoute: '/',
        expectedResult: '',
        type: 'ui',
        priority: 'medium',
    })
    const [saving, setSaving] = useState(false)
    const [open, setOpen] = useState(false)

    const handleChange = (field: string, value: string) => {
        setForm((prev) => ({ ...prev, [field]: value }))
    }

    const handleSave = async () => {
        if (!form.title) return
        setSaving(true)
        try {
            await axios.post('/api/test-cases', {
                userId,
                repoId,
                repoName,
                repoOwner,
                branch: branch || 'main',
                ...form,
            })
            setOpen(false)
            setForm({ title: '', description: '', targetRoute: '/', expectedResult: '', type: 'ui', priority: 'medium' })
            onCreated()
        } catch (e) {
            console.error(e)
        }
        setSaving(false)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size={'sm'} variant={'outline'}>
                    <Plus className='h-3 w-3 mr-1' /> Add Test Case
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Test Case</DialogTitle>
                    <DialogDescription>
                        Create a new test case manually for this repository.
                    </DialogDescription>
                </DialogHeader>
                <div>
                    <div>
                        <label className='text-sm text-gray-500'>TEST TITLE *</label>
                        <Input value={form.title}
                            onChange={(e) => handleChange('title', e.target.value)}
                            placeholder='Test Title' className='mt-1' />
                    </div>
                    <div className='mt-4'>
                        <label className='text-sm text-gray-500'>DESCRIPTION / ACTION</label>
                        <Textarea value={form.description}
                            onChange={(e) => handleChange('description', e.target.value)}
                            placeholder='Description' className='mt-1' />
                    </div>
                    <div className='mt-4'>
                        <label className='text-sm text-gray-500'>TARGET ROUTE / PATH</label>
                        <Input value={form.targetRoute}
                            onChange={(e) => handleChange('targetRoute', e.target.value)}
                            placeholder='/workspace' className='mt-1' />
                    </div>
                    <div className='mt-4'>
                        <label className='text-sm text-gray-500'>EXPECTED RESULT</label>
                        <Textarea value={form.expectedResult}
                            onChange={(e) => handleChange('expectedResult', e.target.value)}
                            placeholder='Text that should appear on the page' className='mt-1' />
                    </div>
                    <div className='mt-4 grid grid-cols-2 gap-4'>
                        <div>
                            <label className='text-sm text-gray-500'>TYPE</label>
                            <select value={form.type}
                                onChange={(e) => handleChange('type', e.target.value)}
                                className='flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-1'>
                                <option value="ui">ui</option>
                                <option value="auth">auth</option>
                                <option value="api">api</option>
                                <option value="form">form</option>
                                <option value="integration">integration</option>
                                <option value="edge-case">edge-case</option>
                            </select>
                        </div>
                        <div>
                            <label className='text-sm text-gray-500'>PRIORITY</label>
                            <select value={form.priority}
                                onChange={(e) => handleChange('priority', e.target.value)}
                                className='flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-1'>
                                <option value="low">low</option>
                                <option value="medium">medium</option>
                                <option value="high">high</option>
                            </select>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant={'outline'}>Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleSave} disabled={saving || !form.title}>
                        {saving ? 'Saving...' : 'Create Case'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default AddTestCaseDialog
