import { UserButton } from '@clerk/nextjs'
import Image from 'next/image'
import React from 'react'

function WorkspaceHeader() {
    return (
        <div className='flex w-full justify-between p-4'>
            {/* logo */}
            <Image src={'/logo.svg'} alt='logo' width={200} height={200} />

            {/* menu options */}

            <ul className='flex gap-8 text-xl'>
                <li className='hover:text-blue-600 cursor-pointer'>Workspace</li>
                <li className='hover:text-blue-600 cursor-pointer'>Pricing</li>
                <li className='hover:text-blue-600 cursor-pointer'>Support</li>
            </ul>

            {/* user button */}
            <UserButton />
        </div>
    )
}

export default WorkspaceHeader