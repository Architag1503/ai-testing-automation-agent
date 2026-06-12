"use client"

import React, { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from "framer-motion"
import type { Variants } from "framer-motion"
import { 
  Mail, 
  MessageSquare, 
  Calendar, 
  Send, 
  Loader2, 
  CheckCircle, 
  HelpCircle, 
  Sparkles, 
  ArrowRight,
  Bot
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion"

// 3D Card tilt component
function SupportCard3D({ children, className }: { children: React.ReactNode; className?: string }) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  const rotateX = useTransform(y, [-100, 100], [8, -8])
  const rotateY = useTransform(x, [-100, 100], [-8, 8])

  const springRotateX = useSpring(rotateX, { damping: 20, stiffness: 150 })
  const springRotateY = useSpring(rotateY, { damping: 20, stiffness: 150 })

  function handleMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const width = rect.width
    const height = rect.height
    const mouseX = event.clientX - rect.left - width / 2
    const mouseY = event.clientY - rect.top - height / 2
    x.set(mouseX)
    y.set(mouseY)
  }

  function handleMouseLeave() {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.div
      style={{ perspective: 1000 }}
      className="w-full flex h-full"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <motion.div
        style={{
          rotateX: springRotateX,
          rotateY: springRotateY,
          transformStyle: "preserve-3d",
        }}
        className={`w-full flex flex-col ${className}`}
      >
        <div style={{ transform: "translateZ(20px)", transformStyle: "preserve-3d" }} className="flex flex-col flex-1 h-full">
          {children}
        </div>
      </motion.div>
    </motion.div>
  )
}

type ChatMessage = {
  id: string
  sender: "user" | "bot"
  text: string
  timestamp: Date
}

export default function Support() {
  // Contact form states
  const [formName, setFormName] = useState("")
  const [formEmail, setFormEmail] = useState("")
  const [formSubject, setFormSubject] = useState("")
  const [formCategory, setFormCategory] = useState("technical")
  const [formMessage, setFormMessage] = useState("")
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitSuccess, setIsSubmitSuccess] = useState(false)

  // Chatbot states
  const [chatInput, setChatInput] = useState("")
  const [isBotTyping, setIsBotTyping] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "bot",
      text: "Hi there! 👋 I'm Testy, your AI QA assistant. Ask me anything about Testrix, or select a topic below!",
      timestamp: new Date()
    }
  ])
  
  const chatBottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatMessages, isBotTyping])

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName || !formEmail || !formSubject || !formMessage) return

    setIsSubmitting(true)
    
    // Simulate submission delay
    setTimeout(() => {
      setIsSubmitting(false)
      setIsSubmitSuccess(true)
      
      // Reset form fields
      setFormName("")
      setFormEmail("")
      setFormSubject("")
      setFormMessage("")
    }, 2000)
  }

  // Predefined chatbot questions & answers
  const quickQuestions = [
    {
      q: "How to add a repository?",
      a: "To add a repository:\n1. Click the 'Workspace' tab in the navigation header.\n2. Click the '+ Add Repo' button (or Setup if Github isn't connected).\n3. Grant Github authorization.\n4. Select your target repo, specify the testing branch, and input your target local or staging URL.\n5. Click Save!"
    },
    {
      q: "Why are my tests failing?",
      a: "Common test execution failures:\n1. Target URL unreachable: For local dev servers, make sure localtunnel or ngrok is running.\n2. Page selectors changed: If a button ID changed, update your test case global instructions to use the new text.\n3. Session timeouts: Increase test timeout limits in instructions if page load exceeds 15 seconds."
    },
    {
      q: "What are credits used for?",
      a: "Credits power the AI agent runs:\n- Generating a new Playwright test case: 20 credits.\n- Running a cloud test execution: 10 credits.\nIf you run out of credits, navigate to the 'Pricing' tab to simulate a workspace upgrade and instantly add credits."
    }
  ]

  const triggerBotResponse = (userText: string) => {
    setIsBotTyping(true)

    // Calculate response
    setTimeout(() => {
      let botResponse = "That is a great question! For detailed assistance with that specific issue, please submit a ticket using the Support Form on the left. Our engineering team will review it and reply within 2 hours."
      
      const matched = quickQuestions.find(item => userText.toLowerCase().includes(item.q.toLowerCase()) || item.q.toLowerCase().includes(userText.toLowerCase()))
      if (matched) {
        botResponse = matched.a
      } else if (userText.toLowerCase().includes("hello") || userText.toLowerCase().includes("hi")) {
        botResponse = "Hello! Let me know if you have any questions about syncing repositories, writing custom test instructions, or checking out pricing plans."
      } else if (userText.toLowerCase().includes("pricing") || userText.toLowerCase().includes("cost")) {
        botResponse = "We offer a Free Trial, Pro, Business, and Enterprise plan. You can view all pricing details and activate plan upgrades in the Pricing tab above!"
      }

      setChatMessages(prev => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          sender: "bot",
          text: botResponse,
          timestamp: new Date()
        }
      ])
      setIsBotTyping(false)
    }, 1000)
  }

  const handleSendChatMessage = (text: string) => {
    if (!text.trim()) return

    const newMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: text,
      timestamp: new Date()
    }

    setChatMessages(prev => [...prev, newMessage])
    setChatInput("")

    triggerBotResponse(text)
  }

  // Animation configurations — typed as Variants so ease literals pass TS strict checks
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  }

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } }
  }

  return (
    <div className="min-h-screen bg-slate-50/50 relative py-12 px-6 overflow-hidden">
      {/* Decorative Gradient Blobs */}
      <div className="absolute top-[-100px] right-[50%] translate-x-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-emerald-100/40 to-teal-100/30 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-[-150px] left-[5%] w-[400px] h-[400px] bg-emerald-50/30 rounded-full blur-3xl pointer-events-none -z-10" />

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-6xl mx-auto space-y-12"
      >
        
        {/* Support Header */}
        <motion.div variants={itemVariants} className="text-center space-y-4">
          <Badge className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 px-3 py-1 rounded-full text-xs font-semibold">
            <Sparkles className="h-3 w-3 inline mr-1 fill-emerald-600/20 text-emerald-600 animate-pulse" /> HELP CENTER
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            How can we <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">help you today?</span>
          </h1>
          <p className="text-slate-600 text-base max-w-xl mx-auto">
            Submit a support ticket, chat with our interactive QA bot, or explore documentation to get your tests running smoothly.
          </p>
        </motion.div>

        {/* Quick Contact Cards */}
        <motion.div 
          variants={itemVariants} 
          className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4"
        >
          {/* Email Support Card */}
          <SupportCard3D className="bg-white rounded-2xl border border-slate-200/80 hover:border-emerald-300 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/5">
            <CardHeader className="text-left pb-3">
              <div className="h-10 w-10 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-2">
                <Mail className="h-5 w-5" />
              </div>
              <CardTitle className="text-base font-bold text-slate-900">Email Support</CardTitle>
              <CardDescription className="text-xs text-slate-400">Direct query responses</CardDescription>
            </CardHeader>
            <CardContent className="text-left flex-1 pb-4">
              <p className="text-slate-600 text-xs leading-relaxed">
                Send us details regarding account configurations, pricing questions, or custom script integrations.
              </p>
              <p className="text-emerald-600 font-bold text-sm mt-4">support@testrix.ai</p>
            </CardContent>
            <CardFooter className="pt-0 pb-4">
              <span className="text-[10px] text-slate-400 font-semibold bg-slate-50 px-2 py-1 rounded-md">
                Response in &lt; 2 hours
              </span>
            </CardFooter>
          </SupportCard3D>

          {/* Discord Card */}
          <SupportCard3D className="bg-white rounded-2xl border border-slate-200/80 hover:border-emerald-300 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/5">
            <CardHeader className="text-left pb-3">
              <div className="h-10 w-10 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-2">
                <MessageSquare className="h-5 w-5" />
              </div>
              <CardTitle className="text-base font-bold text-slate-900">Community Discord</CardTitle>
              <CardDescription className="text-xs text-slate-400">Join other QA developers</CardDescription>
            </CardHeader>
            <CardContent className="text-left flex-1 pb-4">
              <p className="text-slate-600 text-xs leading-relaxed">
                Discuss Playwright assertions, share selectors configs, and chat with engineers dynamically.
              </p>
              <a href="https://discord.gg" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-bold text-xs mt-4">
                Join Server <ArrowRight className="h-3 w-3" />
              </a>
            </CardContent>
            <CardFooter className="pt-0 pb-4">
              <span className="text-[10px] text-slate-400 font-semibold bg-slate-50 px-2 py-1 rounded-md">
                Active Community Chat
              </span>
            </CardFooter>
          </SupportCard3D>

          {/* Call Demo Card */}
          <SupportCard3D className="bg-white rounded-2xl border border-slate-200/80 hover:border-emerald-300 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/5">
            <CardHeader className="text-left pb-3">
              <div className="h-10 w-10 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-2">
                <Calendar className="h-5 w-5" />
              </div>
              <CardTitle className="text-base font-bold text-slate-900">Book a Demo</CardTitle>
              <CardDescription className="text-xs text-slate-400">1-on-1 walkthrough session</CardDescription>
            </CardHeader>
            <CardContent className="text-left flex-1 pb-4">
              <p className="text-slate-600 text-xs leading-relaxed">
                Connect with an automation engineer to setup complex Clerk logins, cookies, or database states.
              </p>
              <button className="text-emerald-600 hover:text-emerald-700 font-bold text-xs mt-4 flex items-center gap-1">
                Schedule a Call <ArrowRight className="h-3 w-3" />
              </button>
            </CardContent>
            <CardFooter className="pt-0 pb-4">
              <span className="text-[10px] text-slate-400 font-semibold bg-slate-50 px-2 py-1 rounded-md">
                15-Min Meeting
              </span>
            </CardFooter>
          </SupportCard3D>
        </motion.div>

        {/* Middle split: Submit Ticket vs Interactive Chatbot */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch pt-4">
          
          {/* Support Form Column */}
          <motion.div variants={itemVariants} className="lg:col-span-6 flex">
            <Card className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between w-full relative overflow-hidden">
              
              <AnimatePresence mode="wait">
                {!isSubmitSuccess ? (
                  <motion.form 
                    key="form"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    onSubmit={handleFormSubmit} 
                    className="space-y-4 text-left flex-1 flex flex-col justify-between"
                  >
                    <div className="space-y-4">
                      <div>
                        <h2 className="text-lg font-bold text-slate-900">Submit a Support Ticket</h2>
                        <p className="text-xs text-slate-500">We'll review and reply to your ticket immediately.</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Your Name</label>
                          <Input 
                            type="text" 
                            placeholder="John Doe"
                            value={formName}
                            onChange={(e) => setFormName(e.target.value)}
                            required
                            className="rounded-xl border-slate-200 focus-visible:ring-emerald-500/30 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Email Address</label>
                          <Input 
                            type="email" 
                            placeholder="john@company.com"
                            value={formEmail}
                            onChange={(e) => setFormEmail(e.target.value)}
                            required
                            className="rounded-xl border-slate-200 focus-visible:ring-emerald-500/30 text-xs"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Subject</label>
                          <Input 
                            type="text" 
                            placeholder="Failed Playwright assertion"
                            value={formSubject}
                            onChange={(e) => setFormSubject(e.target.value)}
                            required
                            className="rounded-xl border-slate-200 focus-visible:ring-emerald-500/30 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Category</label>
                          <select 
                            value={formCategory} 
                            onChange={(e) => setFormCategory(e.target.value)}
                            className="flex h-9 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-1 text-xs shadow-sm transition-colors placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          >
                            <option value="technical">Technical Support</option>
                            <option value="billing">Billing & Pricing</option>
                            <option value="limits">Custom Limits / API</option>
                            <option value="feature">Feature Request</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Detailed Message</label>
                        <Textarea 
                          placeholder="Describe the issue, include repository links or error statements..."
                          value={formMessage}
                          onChange={(e) => setFormMessage(e.target.value)}
                          required
                          rows={4}
                          className="rounded-xl border-slate-200 focus-visible:ring-emerald-500/30 text-xs leading-relaxed"
                        />
                      </div>
                    </div>

                    <div className="pt-4">
                      <Button 
                        type="submit" 
                        disabled={isSubmitting}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-5 font-semibold text-xs transition-all flex justify-center items-center gap-1.5 active:scale-[0.98]"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" /> Submitting Ticket...
                          </>
                        ) : (
                          "Submit Ticket"
                        )}
                      </Button>
                    </div>
                  </motion.form>
                ) : (
                  <motion.div 
                    key="success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", duration: 0.6 }}
                    className="flex flex-col items-center justify-center text-center py-12 px-6 flex-1 space-y-4"
                  >
                    {/* Mail Flying out Animation Simulation */}
                    <div className="relative h-20 w-20 flex items-center justify-center">
                      <motion.div 
                        initial={{ y: 50, opacity: 0, scale: 0.3 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        transition={{ type: "spring", stiffness: 200, damping: 15 }}
                        className="h-16 w-16 bg-emerald-50 rounded-full flex items-center justify-center border border-emerald-100 text-emerald-600 shadow-sm"
                      >
                        <CheckCircle className="h-8 w-8" />
                      </motion.div>
                      <motion.div
                        initial={{ opacity: 0, x: -30, y: 30 }}
                        animate={{ opacity: [0, 1, 0], x: [0, 40, 80], y: [0, -40, -80] }}
                        transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1 }}
                        className="absolute text-emerald-600"
                      >
                        <Send className="h-5 w-5" />
                      </motion.div>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-lg font-bold text-slate-900">Ticket Submitted Successfully!</h3>
                      <p className="text-xs text-slate-500 max-w-sm">
                        Thank you for reaching out. We have received your query and sent a confirmation log to your developer email address.
                      </p>
                    </div>

                    <Button 
                      onClick={() => setIsSubmitSuccess(false)}
                      variant="outline"
                      className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-xl px-6 text-xs font-semibold"
                    >
                      Submit Another Ticket
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </motion.div>

          {/* AI Chatbot Column */}
          <motion.div variants={itemVariants} className="lg:col-span-6 flex">
            <Card className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between w-full h-[450px] relative overflow-hidden">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 border border-emerald-200/60">
                    <Bot className="h-4.5 w-4.5" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-xs font-bold text-slate-900">Testy</h3>
                    <p className="text-[9px] text-emerald-600 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" /> Live Helper Bot
                    </p>
                  </div>
                </div>
                <Badge className="bg-slate-100 text-slate-500 border border-slate-200/50 hover:bg-slate-100 text-[10px]">
                  FAQ Bot
                </Badge>
              </div>

              {/* Messages Body */}
              <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1 text-left scrollbar-thin scrollbar-thumb-slate-100">
                {chatMessages.map((msg) => {
                  const isBot = msg.sender === "bot"
                  return (
                    <motion.div 
                      key={msg.id}
                      initial={{ opacity: 0, scale: 0.9, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className={`flex ${isBot ? "justify-start" : "justify-end"}`}
                    >
                      <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-line ${
                        isBot 
                          ? "bg-slate-50 text-slate-700 border border-slate-100 rounded-tl-sm" 
                          : "bg-emerald-600 text-white rounded-tr-sm"
                      }`}>
                        {msg.text}
                      </div>
                    </motion.div>
                  )
                })}

                {isBotTyping && (
                  <div className="flex justify-start">
                    <div className="bg-slate-50 text-slate-400 border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-2 text-xs flex gap-1 items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                )}
                
                <div ref={chatBottomRef} />
              </div>

              {/* Bot Quick Buttons */}
              {chatMessages.length === 1 && (
                <div className="pb-3 border-t border-slate-50 pt-2 text-left space-y-1.5">
                  <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold px-1">Quick Topics:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {quickQuestions.map((qObj) => (
                      <button 
                        key={qObj.q}
                        onClick={() => handleSendChatMessage(qObj.q)}
                        className="text-[10px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium px-2.5 py-1 rounded-full border border-emerald-100/50 transition-colors cursor-pointer"
                      >
                        {qObj.q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Message input field */}
              <div className="border-t border-slate-100 pt-3 flex gap-2">
                <Input 
                  placeholder="Ask Testy a question..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendChatMessage(chatInput)}
                  className="rounded-xl border-slate-200 text-xs focus-visible:ring-emerald-500/30 flex-1 h-9.5"
                />
                <Button 
                  onClick={() => handleSendChatMessage(chatInput)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-9.5 w-9.5 p-0 flex items-center justify-center shrink-0 cursor-pointer"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          </motion.div>

        </div>

        {/* Support FAQ */}
        <motion.div variants={itemVariants} className="pt-8 border-t border-slate-200 max-w-3xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-slate-900 flex items-center justify-center gap-2">
              <HelpCircle className="h-5 w-5 text-emerald-600" /> Support FAQ
            </h2>
            <p className="text-slate-500 text-sm">
              Quick answers about developer access, repositories, and custom setups.
            </p>
          </div>

          <Accordion type="single" collapsible className="w-full bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
            <AccordionItem value="support-1" className="border-b border-slate-100">
              <AccordionTrigger className="text-slate-800 font-semibold hover:text-emerald-600 text-sm py-4">
                What is the standard response time for tickets?
              </AccordionTrigger>
              <AccordionContent className="text-slate-500 text-xs leading-relaxed pb-4">
                Our core engineering support desk operates 24/7. Tickets submitted via the workspace contact form are usually routed directly to engineers, resulting in responses under 2 hours.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="support-2" className="border-b border-slate-100">
              <AccordionTrigger className="text-slate-800 font-semibold hover:text-emerald-600 text-sm py-4">
                Can I sync custom local repos that aren't on GitHub?
              </AccordionTrigger>
              <AccordionContent className="text-slate-500 text-xs leading-relaxed pb-4">
                Currently, Testrix utilizes GitHub APIs to sync branches and load component contexts directly. For private local repositories, you can create a private GitHub repository, sync it, and then target your local server using a secure LocalTunnel or Ngrok endpoint.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="support-3" className="border-b border-slate-100">
              <AccordionTrigger className="text-slate-800 font-semibold hover:text-emerald-600 text-sm py-4">
                How do I configure bypass controls for complex auth walls?
              </AccordionTrigger>
              <AccordionContent className="text-slate-500 text-xs leading-relaxed pb-4">
                Testrix features automatic cookie inheritance, meaning our Browserbase cloud browsers automatically ingest auth cookies from your active workspace. For advanced login bypass rules (like MFA/TOTP), you can specify custom instructions in the repository details.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="support-4" className="border-b-0">
              <AccordionTrigger className="text-slate-800 font-semibold hover:text-emerald-600 text-sm py-4">
                Do you provide enterprise SLAs?
              </AccordionTrigger>
              <AccordionContent className="text-slate-500 text-xs leading-relaxed pb-4">
                Yes! We offer customized Service Level Agreements (SLAs) for enterprise companies requesting dedicated cloud browser clusters, private GitHub proxies, and sub-hour response commitments. Please submit a ticket under the 'Custom Limits' category.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </motion.div>
        
      </motion.div>
    </div>
  )
}
