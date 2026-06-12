"use client"
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '../ui/button'
import {
    MessageCircle, X, Send, Trash2, Plus, Bot, User,
    Loader2, Sparkles, ChevronDown
} from 'lucide-react'
import axios from 'axios'

type Chat = {
    id: number
    title: string
    repoId: string
    repoName: string
    repoOwner: string
    updatedAt: string
}

type Message = {
    id: number
    chatId: number
    role: string
    content: string
    createdAt: string
}

type Props = {
    repoId?: number
    repoName?: string
    repoOwner?: string
    branch?: string
}

function ChatWidget({ repoId, repoName, repoOwner, branch }: Props) {
    const [open, setOpen] = useState(false)
    const [chats, setChats] = useState<Chat[]>([])
    const [activeChatId, setActiveChatId] = useState<number | null>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [sending, setSending] = useState(false)
    const [loadingChats, setLoadingChats] = useState(false)
    const [showHistory, setShowHistory] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const loadChats = useCallback(async () => {
        setLoadingChats(true)
        try {
            const url = repoId ? `/api/chat?repoId=${repoId}` : '/api/chat'
            const res = await axios.get(url)
            setChats(res.data || [])
        } catch { }
        setLoadingChats(false)
    }, [repoId])

    const loadMessages = useCallback(async (chatId: number) => {
        try {
            const res = await axios.get(`/api/chat?chatId=${chatId}`)
            setMessages(res.data || [])
        } catch { }
    }, [])

    useEffect(() => {
        if (open) loadChats()
    }, [open, loadChats])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const handleSelectChat = (chatId: number) => {
        setActiveChatId(chatId)
        setShowHistory(false)
        loadMessages(chatId)
    }

    const handleDeleteChat = async (chatId: number, e: React.MouseEvent) => {
        e.stopPropagation()
        try {
            await axios.delete(`/api/chat/${chatId}`)
            setChats(prev => prev.filter(c => c.id !== chatId))
            if (activeChatId === chatId) {
                setActiveChatId(null)
                setMessages([])
            }
        } catch { }
    }

    const handleNewChat = () => {
        setActiveChatId(null)
        setMessages([])
        setInput('')
        setShowHistory(false)
    }

    // Extract actionable block from AI message
    const getPendingAction = (msg: string): { action: string; params: any } | null => {
        const updateMatch = msg.match(/\[ACTION:\s*update-test-case\s+id=(\d+)\s+title="([^"]*)"\s+description="([^"]*)"\s+targetRoute="([^"]*)"\s+expectedResult="([^"]*)"\]/);
        if (updateMatch) return { action: 'update-test-case', params: { id: updateMatch[1], title: updateMatch[2], description: updateMatch[3], targetRoute: updateMatch[4], expectedResult: updateMatch[5] } };
        const deleteMatch = msg.match(/\[ACTION:\s*delete-test-case\s+id=(\d+)\]/);
        if (deleteMatch) return { action: 'delete-test-case', params: { id: deleteMatch[1] } };
        const githubEditMatch = msg.match(/\[ACTION:\s*github-edit\s+file="([^"]+)"\s+message="([^"]*)"\s+content="([\s\S]*?)"\]/);
        if (githubEditMatch) return { action: 'github-edit', params: { file: githubEditMatch[1], message: githubEditMatch[2], content: githubEditMatch[3], owner: repoOwner, repo: repoName, branch } };
        return null;
    }

    const handleSend = async () => {
        const text = input.trim()
        if (!text || sending) return
        setInput('')
        setSending(true)

        setMessages(prev => [...prev, {
            id: Date.now(), chatId: activeChatId || 0, role: 'user',
            content: text, createdAt: new Date().toISOString(),
        }])

        // Check if user is confirming an action
        const isConfirm = /^(yes|y|proceed|confirm|apply|do it|go ahead|sure|ok)\b/i.test(text);
        const lastAssistantMsg = messages.filter(m => m.role === 'assistant').slice(-1)[0];
        const pendingAction = lastAssistantMsg ? getPendingAction(lastAssistantMsg.content) : null;

        if (isConfirm && pendingAction && activeChatId) {
            try {
                const res = await axios.patch('/api/chat', {
                    action: pendingAction.action,
                    chatId: activeChatId,
                    params: pendingAction.params,
                })
                setMessages(prev => [...prev, {
                    id: Date.now() + 1, chatId: activeChatId, role: 'assistant',
                    content: res.data.message,
                    createdAt: new Date().toISOString(),
                }])
                setSending(false)
                return
            } catch (e: any) {
                setMessages(prev => [...prev, {
                    id: Date.now() + 1, chatId: activeChatId, role: 'assistant',
                    content: 'Error executing action: ' + (e?.response?.data?.error || e.message),
                    createdAt: new Date().toISOString(),
                }])
                setSending(false)
                return
            }
        }

        try {
            const res = await axios.post('/api/chat', {
                chatId: activeChatId, message: text, repoId, repoName, repoOwner, branch,
            })
            setMessages(prev => [...prev, {
                id: Date.now() + 1, chatId: res.data.chatId, role: 'assistant',
                content: res.data.message, createdAt: new Date().toISOString(),
            }])
            if (!activeChatId) {
                setActiveChatId(res.data.chatId)
                loadChats()
            }
        } catch (e: any) {
            setMessages(prev => [...prev, {
                id: Date.now() + 2, chatId: activeChatId || 0, role: 'assistant',
                content: 'Error: ' + (e?.response?.data?.error || e.message || 'Failed to get response'),
                createdAt: new Date().toISOString(),
            }])
        }
        setSending(false)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
    }

    return (
        <>
            {/* Floating Chat Button */}
            <motion.button
                onClick={() => setOpen(true)}
                className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/30 cursor-pointer"
                whileHover={{
                    scale: 1.1,
                    boxShadow: '0 20px 40px rgba(16, 185, 129, 0.4)',
                }}
                whileTap={{ scale: 0.95 }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.5 }}
            >
                <MessageCircle className="h-6 w-6" />
            </motion.button>

            {/* Chat Panel */}
            <AnimatePresence>
                {open && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
                            onClick={() => setOpen(false)}
                        />

                        {/* Panel */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.85, y: 40, rotateX: -8 }}
                            animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
                            exit={{ opacity: 0, scale: 0.85, y: 40, rotateX: -8 }}
                            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                            style={{ perspective: 1000 }}
                            className="fixed bottom-24 right-6 z-50 w-full max-w-lg h-[600px] max-h-[calc(100vh-10rem)] bg-white rounded-2xl shadow-2xl border border-emerald-100 flex flex-col overflow-hidden"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between px-4 py-3 border-b bg-white shrink-0">
                                <div className="flex items-center gap-2">
                                    <motion.div
                                        animate={{ rotate: [0, 10, -10, 0] }}
                                        transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                                    >
                                        <Bot className="h-5 w-5 text-emerald-600" />
                                    </motion.div>
                                    <div>
                                        <h3 className="font-semibold text-sm text-gray-900">AI Assistant</h3>
                                        {repoName && (
                                            <p className="text-xs text-gray-500">{repoOwner}/{repoName}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-gray-500 hover:text-emerald-600"
                                        onClick={() => setShowHistory(!showHistory)} title="Chat History">
                                        <ChevronDown className={`h-4 w-4 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-gray-500 hover:text-emerald-600"
                                        onClick={handleNewChat} title="New Chat">
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-gray-500 hover:text-red-500"
                                        onClick={() => setOpen(false)}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            {/* Chat History */}
                            <AnimatePresence>
                                {showHistory && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="border-b overflow-hidden bg-gray-50"
                                    >
                                        <div className="px-3 py-2 max-h-48 overflow-y-auto space-y-1">
                                            {loadingChats ? (
                                                <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                                                    <Loader2 className="h-3 w-3 animate-spin" /> Loading...
                                                </div>
                                            ) : chats.length === 0 ? (
                                                <p className="text-sm text-gray-400 py-2 text-center">No previous chats</p>
                                            ) : (
                                                chats.map(chat => (
                                                    <div key={chat.id}
                                                        onClick={() => handleSelectChat(chat.id)}
                                                        className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${activeChatId === chat.id
                                                                ? 'bg-emerald-100 text-emerald-900'
                                                                : 'hover:bg-gray-200 text-gray-700'
                                                            }`}
                                                    >
                                                        <span className="truncate flex-1">{chat.title}</span>
                                                        <button onClick={(e) => handleDeleteChat(chat.id, e)}
                                                            className="text-gray-400 hover:text-red-500 ml-2 shrink-0">
                                                            <Trash2 className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-white">
                                {messages.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-center py-10">
                                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                                            transition={{ type: 'spring', stiffness: 300, damping: 15 }}>
                                            <Sparkles className="h-10 w-10 text-emerald-400 mb-3" />
                                        </motion.div>
                                        <h4 className="text-lg font-semibold text-gray-800 mb-1">How can I help?</h4>
                                        <p className="text-sm text-gray-500 max-w-xs">
                                            Ask about test failures, code improvements, debugging, or anything about this repository.
                                        </p>
                                    </div>
                                ) : (
                                    messages.map((msg, i) => (
                                        <motion.div key={msg.id || i}
                                            initial={{ opacity: 0, y: 10, rotateX: 5 }}
                                            animate={{ opacity: 1, y: 0, rotateX: 0 }}
                                            transition={{ duration: 0.3, ease: 'easeOut' }}
                                            style={{ perspective: 800 }}
                                            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                        >
                                            {msg.role === 'assistant' && (
                                                <div className="shrink-0 mt-1">
                                                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center">
                                                        <Bot className="h-4 w-4 text-white" />
                                                    </div>
                                                </div>
                                            )}
                                            <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-1' : ''}`}>
                                                <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'user'
                                                        ? 'bg-emerald-600 text-white rounded-tr-md'
                                                        : 'bg-gray-100 text-gray-800 rounded-tl-md'
                                                    }`}>
                                                    {msg.content}
                                                </div>
                                            </div>
                                            {msg.role === 'user' && (
                                                <div className="shrink-0 mt-1">
                                                    <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                                                        <User className="h-4 w-4 text-gray-600" />
                                                    </div>
                                                </div>
                                            )}
                                        </motion.div>
                                    ))
                                )}
                                {sending && (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                                        <div className="shrink-0 mt-1">
                                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center">
                                                <Bot className="h-4 w-4 text-white" />
                                            </div>
                                        </div>
                                        <div className="bg-gray-100 rounded-2xl rounded-tl-md px-4 py-3">
                                            <motion.div animate={{ opacity: [0.3, 1, 0.3] }}
                                                transition={{ repeat: Infinity, duration: 1.5 }} className="flex gap-1">
                                                <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                                                <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                                                <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                                            </motion.div>
                                        </div>
                                    </motion.div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input */}
                            <div className="border-t bg-white px-4 py-3 shrink-0">
                                <div className="flex items-end gap-2 bg-gray-50 rounded-2xl border border-gray-200 px-4 py-2 focus-within:border-emerald-400 focus-within:ring-1 focus-within:ring-emerald-400 transition-all">
                                    <textarea
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Ask anything..."
                                        rows={1}
                                        className="flex-1 bg-transparent border-none outline-none text-sm resize-none py-1 max-h-32 text-gray-800 placeholder:text-gray-400"
                                        disabled={sending}
                                    />
                                    <motion.button
                                        onClick={handleSend}
                                        disabled={!input.trim() || sending}
                                        className="shrink-0 h-9 w-9 rounded-full bg-emerald-600 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                    >
                                        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                    </motion.button>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    )
}

export default ChatWidget
