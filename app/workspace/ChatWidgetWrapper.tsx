"use client"
import { useContext } from 'react'
import ChatWidget from '@/components/custom/ChatWidget'
import { UserDetailContext } from '@/context/UserDetailContext'

function ChatWidgetWrapper() {
    return <ChatWidget />
}

export default ChatWidgetWrapper
