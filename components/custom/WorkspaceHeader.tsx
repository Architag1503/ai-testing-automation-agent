"use client"
import { UserButton } from '@clerk/nextjs'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'
import { motion } from 'framer-motion'

function WorkspaceHeader() {
    const pathname = usePathname();

    const menuItems = [
        { name: 'Workspace', path: '/workspace' },
        { name: 'Pricing', path: '/workspace/pricing' },
        { name: 'Support', path: '/workspace/support' }
    ];

    return (
        <div className='flex w-full justify-between items-center px-8 py-4 border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-50'>
            {/* logo - fixed size container so it always renders on all pages */}
            <Link href="/" className="hover:opacity-90 transition-opacity flex-shrink-0">
                <div className="relative h-10 w-36">
                    <Image
                        src={'/logo.svg'}
                        alt='Testrix Logo'
                        fill
                        className="object-contain object-left"
                        priority
                    />
                </div>
            </Link>

            {/* menu options */}
            <nav>
                <ul className='flex gap-8 text-base font-semibold text-slate-600'>
                    {menuItems.map((item) => {
                        const isActive = pathname === item.path;
                        return (
                            <li key={item.path} className='relative py-1'>
                                <Link 
                                    href={item.path} 
                                    className={`cursor-pointer transition-colors duration-200 ${
                                        isActive ? 'text-emerald-600' : 'hover:text-emerald-500 text-slate-500'
                                    }`}
                                >
                                    {item.name}
                                </Link>
                                {isActive && (
                                    <motion.div 
                                        layoutId="activeWorkspaceTab"
                                        className="absolute -bottom-1 left-0 right-0 h-0.5 bg-emerald-600 rounded-full"
                                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                                    />
                                )}
                            </li>
                        );
                    })}
                </ul>
            </nav>

            {/* user button */}
            <div className="flex items-center gap-4">
                <UserButton />
            </div>
        </div>
    )
}

export default WorkspaceHeader