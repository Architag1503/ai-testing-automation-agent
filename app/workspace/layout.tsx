import WorkspaceHeader from '@/components/custom/WorkspaceHeader'
import React from 'react'
import ChatWidgetWrapper from './ChatWidgetWrapper'

function WorkspaceLayout({ children }: {
    children: React.ReactNode
}) {
    return (
        <div>
            <WorkspaceHeader />
            {children}
            <ChatWidgetWrapper />
        </div>
    )
}

export default WorkspaceLayout
