"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform, useSpring, useMotionValue } from "framer-motion";
import { 
  ArrowRight, 
  CheckCircle2, 
  Code2, 
  Cpu, 
  GitBranch, 
  Play, 
  Terminal, 
  Check, 
  ShieldCheck, 
  Layers, 
  Zap, 
  Video, 
  BookOpen, 
  ExternalLink,
  ChevronRight
} from "lucide-react";
import { useUser, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annually">("monthly");
  const { isSignedIn, isLoaded } = useUser();
  
  // Ref for scroll containers
  const featuresRef = useRef<HTMLElement>(null);
  const howItWorksRef = useRef<HTMLElement>(null);
  const docsRef = useRef<HTMLElement>(null);
  const pricingRef = useRef<HTMLElement>(null);

  // Smooth scroll handler
  const scrollToSection = (elementRef: React.RefObject<HTMLElement | null>) => {
    if (elementRef.current) {
      elementRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // 3D Card Hover Effect values
  const cardX = useMotionValue(0);
  const cardY = useMotionValue(0);
  
  const rotateX = useTransform(cardY, [-300, 300], [15, -15]);
  const rotateY = useTransform(cardX, [-300, 300], [-15, 15]);
  
  const springRotateX = useSpring(rotateX, { damping: 20, stiffness: 150 });
  const springRotateY = useSpring(rotateY, { damping: 20, stiffness: 150 });

  function handleMouseMove(event: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = event.clientX - rect.left - width / 2;
    const mouseY = event.clientY - rect.top - height / 2;
    cardX.set(mouseX);
    cardY.set(mouseY);
  }

  function handleMouseLeave() {
    cardX.set(0);
    cardY.set(0);
  }

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 font-sans selection:bg-emerald-100 selection:text-emerald-950 overflow-x-hidden">
      
      {/* 1. Header / Navbar */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/70 border-b border-slate-200/80 transition-colors">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 focus:outline-none">
            <div className="h-10 w-40 relative">
              <Image src="/logo.svg" alt="Testrix Logo" fill className="object-contain" priority />
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-[15px] font-medium text-slate-600">
            <button 
              onClick={() => scrollToSection(featuresRef)} 
              className="hover:text-emerald-600 transition-colors cursor-pointer"
            >
              Features
            </button>
            <button 
              onClick={() => scrollToSection(howItWorksRef)} 
              className="hover:text-emerald-600 transition-colors cursor-pointer"
            >
              How it Works
            </button>
            <button 
              onClick={() => scrollToSection(docsRef)} 
              className="hover:text-emerald-600 transition-colors cursor-pointer"
            >
              Docs
            </button>
            <button 
              onClick={() => scrollToSection(pricingRef)} 
              className="hover:text-emerald-600 transition-colors cursor-pointer"
            >
              Pricing
            </button>
          </nav>

          {/* CTAs */}
          <div className="flex items-center gap-4">
            {isLoaded && isSignedIn ? (
              <>
                <Link href="/workspace">
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl px-5 transition-transform hover:scale-[1.02] active:scale-[0.98]">
                    Go to Workspace
                  </Button>
                </Link>
                <UserButton />
              </>
            ) : (
              <>
                <Link href="/sign-in">
                  <Button variant="ghost" className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium rounded-xl">
                    Sign In
                  </Button>
                </Link>
                <Link href="/sign-up">
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl px-5 transition-transform hover:scale-[1.02]">
                    Start Free Trial
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-12 pb-24 md:pt-20 md:pb-32 max-w-7xl mx-auto px-6 overflow-hidden">
        
        {/* Subtle decorative background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-emerald-200/30 to-teal-200/20 rounded-full blur-3xl -z-10 pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Left Text Column */}
          <div className="lg:col-span-5 flex flex-col items-start text-left">
            
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200/80 px-3 py-1 text-xs font-semibold rounded-full mb-6 gap-1.5">
                <Zap className="h-3 w-3 fill-emerald-600 text-emerald-600" /> Powered by Gemini AI
              </Badge>
            </motion.div>

            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-[54px] font-extrabold tracking-tight text-slate-900 leading-[1.15] mb-6"
            >
              Automate Your Web Testing <br/>
              <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">With AI Agent</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg text-slate-600 leading-relaxed mb-8 max-w-xl"
            >
              Testrix automatically writes, executes, and validates Playwright test cases for your repositories using AI. Stop wasting time debugging scripts manually.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-wrap gap-4 w-full sm:w-auto"
            >
              {isLoaded && isSignedIn ? (
                <Link href="/workspace" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg shadow-emerald-600/10 px-8">
                    Open Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              ) : (
                <Link href="/sign-up" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg shadow-emerald-600/10 px-8">
                    Start Free Trial <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              )}
              
              <Button 
                variant="outline" 
                size="lg" 
                onClick={() => scrollToSection(howItWorksRef)}
                className="w-full sm:w-auto text-slate-700 border-slate-300 hover:bg-slate-100 rounded-xl px-8"
              >
                Learn More
              </Button>
            </motion.div>

            {/* Quick Metrics */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="flex gap-8 mt-12 pt-8 border-t border-slate-200/80 w-full"
            >
              <div>
                <p className="text-3xl font-extrabold text-slate-900">10x</p>
                <p className="text-sm text-slate-500 font-medium mt-0.5">Faster Test Writing</p>
              </div>
              <div className="border-l border-slate-200 pl-8">
                <p className="text-3xl font-extrabold text-slate-900">100%</p>
                <p className="text-sm text-slate-500 font-medium mt-0.5">Headless Execution</p>
              </div>
              <div className="border-l border-slate-200 pl-8">
                <p className="text-3xl font-extrabold text-slate-900">Zero</p>
                <p className="text-sm text-slate-500 font-medium mt-0.5">Coding Required</p>
              </div>
            </motion.div>

          </div>

          {/* Right 3D Mockup Column */}
          <div className="lg:col-span-7 flex justify-center items-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8 }}
              style={{
                perspective: 1000,
              }}
              className="w-full max-w-[620px]"
            >
              <motion.div
                style={{
                  rotateX: springRotateX,
                  rotateY: springRotateY,
                  transformStyle: "preserve-3d",
                }}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                className="relative bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 cursor-grab active:cursor-grabbing hover:shadow-emerald-600/5 transition-shadow duration-500"
              >
                
                {/* Mock Browser Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                  <div className="flex gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-red-400 block" />
                    <span className="w-3 h-3 rounded-full bg-yellow-400 block" />
                    <span className="w-3 h-3 rounded-full bg-green-400 block" />
                  </div>
                  <div className="bg-slate-50 text-[11px] font-medium text-slate-500 px-4 py-1 rounded-lg border border-slate-100 flex items-center gap-1.5 w-7/12 justify-center">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    testrix.ai/workspace
                  </div>
                  <div className="w-8" />
                </div>

                {/* Mock Browser Interface */}
                <div className="space-y-4 text-left">
                  
                  {/* Repo Panel */}
                  <div className="flex items-center justify-between bg-slate-50 border border-slate-100 p-3 rounded-xl">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600">
                        <GitBranch className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-900">github.com/company/e-commerce</p>
                        <p className="text-[10px] text-slate-500 font-medium">Branch: main</p>
                      </div>
                    </div>
                    <Badge className="bg-emerald-600 text-white rounded-md hover:bg-emerald-600 px-2 py-0.5 text-[10px]">+ Add Repo</Badge>
                  </div>

                  {/* Test Runner Simulator */}
                  <div className="border border-slate-100 rounded-xl overflow-hidden bg-slate-900 text-slate-100 p-4 font-mono text-xs space-y-2.5 shadow-inner">
                    <div className="flex justify-between items-center text-slate-500 text-[10px] border-b border-slate-800 pb-2 mb-2 font-sans">
                      <span>CONSOLE RUNNER</span>
                      <span className="bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-mono">LIVE</span>
                    </div>
                    <p className="text-slate-400">[SYSTEM] Connecting to Browserbase cloud browser...</p>
                    <p className="text-emerald-400">[SYSTEM] Injected session cookies for auto-auth.</p>
                    <p className="text-slate-400">[SYSTEM] Navigating to target route: /cart</p>
                    <p className="text-slate-300">[BROWSER] Loaded cart checkout container successfully.</p>
                    <p className="text-emerald-500">[ASSERT] ✓ Checkout button element is visible.</p>
                    <p className="text-emerald-500">[ASSERT] ✓ Total amount correctly matches item sum.</p>
                    <p className="text-slate-400">[SYSTEM] Script completed. Closing browser.</p>
                  </div>

                  {/* Test Cases List */}
                  <div className="space-y-2 pt-2">
                    <p className="text-xs font-semibold text-slate-600">Generated AI Test Cases</p>
                    <div className="flex justify-between items-center bg-emerald-50/50 border border-emerald-100 px-3 py-2.5 rounded-lg">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span className="text-xs font-medium text-slate-800">TC-01: Verify Item Checkout Flow</span>
                      </div>
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200/50 font-medium text-[10px]">Passed</Badge>
                    </div>
                    
                    <div className="flex justify-between items-center bg-emerald-50/50 border border-emerald-100 px-3 py-2.5 rounded-lg">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span className="text-xs font-medium text-slate-800">TC-02: User Login with Invalid Password</span>
                      </div>
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200/50 font-medium text-[10px]">Passed</Badge>
                    </div>
                  </div>

                </div>
              </motion.div>
            </motion.div>
          </div>

        </div>
      </section>

      {/* 2. Features Section */}
      <section 
        id="features" 
        ref={featuresRef} 
        className="py-24 bg-white border-y border-slate-200/50 scroll-mt-20"
      >
        <div className="max-w-7xl mx-auto px-6 text-center">
          
          <div className="max-w-2xl mx-auto mb-16">
            <Badge className="bg-emerald-50 hover:bg-emerald-50 text-emerald-700 border-emerald-200/60 font-semibold px-3 py-1 text-xs mb-4">
              Features
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
              Everything you need for automated QA
            </h2>
            <p className="text-slate-600">
              Testrix does the heavy lifting: analyzing your components, generating playwright assertions, and executing in the cloud.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            
            {/* Feature 1 */}
            <motion.div
              whileHover={{ y: -5 }}
              className="bg-slate-50 border border-slate-200/60 p-6 rounded-2xl text-left transition-shadow duration-300 hover:shadow-xl hover:shadow-emerald-600/5"
            >
              <div className="p-3 bg-emerald-100 text-emerald-700 w-fit rounded-xl mb-5">
                <Cpu className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-950 mb-2.5">AI-Powered Generation</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Gemini parses your GitHub code files to discover element selectors, input placeholders, and routing rules to write highly resilient test cases.
              </p>
            </motion.div>

            {/* Feature 2 */}
            <motion.div
              whileHover={{ y: -5 }}
              className="bg-slate-50 border border-slate-200/60 p-6 rounded-2xl text-left transition-shadow duration-300 hover:shadow-xl hover:shadow-emerald-600/5"
            >
              <div className="p-3 bg-emerald-100 text-emerald-700 w-fit rounded-xl mb-5">
                <Layers className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-950 mb-2.5">Self-Healing Selectors</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Our code execution uses flexible, resilient fallbacks. If an element's selector changes, the test agent auto-scrolls and uses click-dispatch backups.
              </p>
            </motion.div>

            {/* Feature 3 */}
            <motion.div
              whileHover={{ y: -5 }}
              className="bg-slate-50 border border-slate-200/60 p-6 rounded-2xl text-left transition-shadow duration-300 hover:shadow-xl hover:shadow-emerald-600/5"
            >
              <div className="p-3 bg-emerald-100 text-emerald-700 w-fit rounded-xl mb-5">
                <Video className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-950 mb-2.5">Live Session Replays</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Every test is run inside Browserbase cloud containers. Access full execution logs, screenshot captures, and video recordings to debug failure points instantly.
              </p>
            </motion.div>

            {/* Feature 4 */}
            <motion.div
              whileHover={{ y: -5 }}
              className="bg-slate-50 border border-slate-200/60 p-6 rounded-2xl text-left transition-shadow duration-300 hover:shadow-xl hover:shadow-emerald-600/5"
            >
              <div className="p-3 bg-emerald-100 text-emerald-700 w-fit rounded-xl mb-5">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-950 mb-2.5">Auto-Cookie Session Injection</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                No complex login automation needed. Our cloud-browser automatically inherits cookies to bypass Clerk or login walls, letting you test private routes.
              </p>
            </motion.div>

            {/* Feature 5 */}
            <motion.div
              whileHover={{ y: -5 }}
              className="bg-slate-50 border border-slate-200/60 p-6 rounded-2xl text-left transition-shadow duration-300 hover:shadow-xl hover:shadow-emerald-600/5"
            >
              <div className="p-3 bg-emerald-100 text-emerald-700 w-fit rounded-xl mb-5">
                <Terminal className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-950 mb-2.5">Custom Instructions</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Tweak test behavior globally or for individual test cases. Feed natural language instructions to guide the AI script builder.
              </p>
            </motion.div>

            {/* Feature 6 */}
            <motion.div
              whileHover={{ y: -5 }}
              className="bg-slate-50 border border-slate-200/60 p-6 rounded-2xl text-left transition-shadow duration-300 hover:shadow-xl hover:shadow-emerald-600/5"
            >
              <div className="p-3 bg-emerald-100 text-emerald-700 w-fit rounded-xl mb-5">
                <GitBranch className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-950 mb-2.5">GitHub Repositories Sync</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Connect your GitHub account in one click. Search and add repositories to generate testing configurations across branches dynamically.
              </p>
            </motion.div>

          </div>

        </div>
      </section>

      {/* 3. How It Works Section */}
      <section 
        id="how-it-works" 
        ref={howItWorksRef} 
        className="py-24 bg-slate-50/50 scroll-mt-20"
      >
        <div className="max-w-7xl mx-auto px-6">
          
          <div className="max-w-2xl mx-auto text-center mb-20">
            <Badge className="bg-emerald-50 hover:bg-emerald-50 text-emerald-700 border-emerald-200/60 font-semibold px-3 py-1 text-xs mb-4">
              Workflow
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
              Test automated in 4 steps
            </h2>
            <p className="text-slate-600">
              From connecting your source code to running detailed cross-browser assertions.
            </p>
          </div>

          {/* Interactive Steps Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 relative">
            
            {/* Step 1 */}
            <div className="flex flex-col items-start relative">
              <span className="text-6xl font-black text-emerald-100 mb-4 select-none">01</span>
              <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                Connect Repository
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Grant repository access. Testrix imports context so the AI can read your layouts and elements.
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-start relative">
              <span className="text-6xl font-black text-emerald-100 mb-4 select-none">02</span>
              <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                AI Script Generation
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Provide target route & expected result. Gemini automatically generates Playwright script assertions.
              </p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-start relative">
              <span className="text-6xl font-black text-emerald-100 mb-4 select-none">03</span>
              <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                Cloud Execution
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Browserbase spins up a cloud-browser. Testrix injects your auth cookies to test logged-in paths.
              </p>
            </div>

            {/* Step 4 */}
            <div className="flex flex-col items-start relative">
              <span className="text-6xl font-black text-emerald-100 mb-4 select-none">04</span>
              <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                Result & Logs
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Review assertions. Inspect steps, live console outputs, screenshots, or play back the video run.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* 4. Docs Section */}
      <section 
        id="docs" 
        ref={docsRef} 
        className="py-24 bg-white border-y border-slate-200/50 scroll-mt-20"
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Column Text */}
            <div className="lg:col-span-5 text-left">
              <Badge className="bg-emerald-50 hover:bg-emerald-50 text-emerald-700 border-emerald-200/60 font-semibold px-3 py-1 text-xs mb-4">
                Docs & Integration
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-5">
                Integrates seamlessly into your dev workflow
              </h2>
              <p className="text-slate-600 mb-8 leading-relaxed">
                Testrix offers a direct developer quickstart. Read our guides on targeting routes, structuring global prompts, and handling localtunnel endpoints.
              </p>

              <div className="space-y-4">
                <div className="flex gap-3 items-start">
                  <div className="p-1 bg-emerald-100 text-emerald-700 rounded-lg mt-0.5">
                    <Check className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 text-sm">Target Domain Configuration</h4>
                    <p className="text-slate-500 text-xs mt-0.5">Define your local or production URL (e.g. localhost:3000 or ngrok address).</p>
                  </div>
                </div>

                <div className="flex gap-3 items-start">
                  <div className="p-1 bg-emerald-100 text-emerald-700 rounded-lg mt-0.5">
                    <Check className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 text-sm">Global Instructions</h4>
                    <p className="text-slate-500 text-xs mt-0.5">Specify behavior defaults (e.g. wait for dynamic load spinners to dismiss).</p>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <Link href="/workspace">
                  <Button variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl">
                    View Quickstart <BookOpen className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Right Column Code Container */}
            <div className="lg:col-span-7">
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-900 shadow-xl text-left">
                
                {/* Code Window Header */}
                <div className="flex justify-between items-center bg-slate-950/80 px-4 py-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Code2 className="h-4 w-4 text-emerald-400" />
                    <span className="text-[11px] font-mono text-slate-400">test-case-runner.js</span>
                  </div>
                  <div className="h-2 w-2 rounded-full bg-slate-700" />
                </div>

                {/* Code Body */}
                <pre className="p-5 font-mono text-xs text-slate-300 overflow-x-auto leading-relaxed space-y-1">
                  <code>{`// 1. Initializing Playwright CDP connection
const browser = await chromium.connectOverCDP(session.connectUrl);
const page = browser.contexts()[0].pages()[0];

// 2. Auto-inject session state cookies
await context.addCookies(playwrightCookies);

// 3. Navigate & Wait for cart items to load
await page.goto('https://twenty-islands-smile.loca.lt/workspace', {
  waitUntil: 'load',
  timeout: 15000
});
await page.waitForTimeout(1000);

// 4. Robust assertion
const listText = await page.innerText('.repository-list');
assert(listText.includes('e-commerce'), 'Repo failed to appear');`}</code>
                </pre>
                
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 5. Pricing Section */}
      <section 
        id="pricing" 
        ref={pricingRef} 
        className="py-24 bg-slate-50/50 scroll-mt-20"
      >
        <div className="max-w-7xl mx-auto px-6">
          
          <div className="max-w-2xl mx-auto text-center mb-16">
            <Badge className="bg-emerald-50 hover:bg-emerald-50 text-emerald-700 border-emerald-200/60 font-semibold px-3 py-1 text-xs mb-4">
              Pricing Plans
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
              Choose the plan that fits you
            </h2>
            <p className="text-slate-600 mb-8">
              No hidden fees. Scale up as your repository count and testing demands grow.
            </p>

            {/* Toggle Billing Period */}
            <div className="inline-flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-xl shadow-sm">
              <button 
                onClick={() => setBillingPeriod("monthly")}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  billingPeriod === "monthly" 
                    ? "bg-emerald-600 text-white shadow-sm" 
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Monthly
              </button>
              <button 
                onClick={() => setBillingPeriod("annually")}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  billingPeriod === "annually" 
                    ? "bg-emerald-600 text-white shadow-sm" 
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Annually <span className="text-[10px] text-emerald-300 font-bold ml-0.5">Save 20%</span>
              </button>
            </div>

          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            
            {/* Plan 1: Free Trial */}
            <Card className="flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-emerald-500 hover:shadow-xl transition-all duration-300 hover:scale-[1.01]">
              <CardHeader className="text-left pb-4">
                <Badge variant="secondary" className="w-fit bg-slate-100 text-slate-700 mb-3">
                  Trial
                </Badge>
                <CardTitle className="text-2xl font-bold text-slate-950">Free Trial</CardTitle>
                <CardDescription className="text-slate-500 text-xs mt-1">Get started with Testrix</CardDescription>
              </CardHeader>
              
              <CardContent className="text-left flex-1 pb-6">
                <div className="mb-6">
                  <span className="text-4xl font-extrabold text-slate-900">$0</span>
                  <span className="text-slate-500 text-sm font-medium">/ 10 days</span>
                </div>
                
                <ul className="space-y-3.5 text-xs text-slate-600 font-medium">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    1,000 starter credits
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    1 Repository sync limit
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    20 test cases generated
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    20 test runs executed
                  </li>
                  <li className="flex items-center gap-2 text-slate-400 line-through">
                    Voice Agent access
                  </li>
                  <li className="flex items-center gap-2 text-slate-400 line-through">
                    Browserbase session video replays
                  </li>
                </ul>
              </CardContent>

              <CardFooter className="pt-0 pb-6 px-6">
                {isLoaded && isSignedIn ? (
                  <Link href="/workspace" className="w-full">
                    <Button variant="outline" className="w-full border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl">
                      Go to Workspace
                    </Button>
                  </Link>
                ) : (
                  <Link href="/sign-up" className="w-full">
                    <Button variant="outline" className="w-full border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl">
                      Start Trial
                    </Button>
                  </Link>
                )}
              </CardFooter>
            </Card>

            {/* Plan 2: 3-Month Plan */}
            <Card className="flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-emerald-500 hover:shadow-xl transition-all duration-300 hover:scale-[1.01]">
              <CardHeader className="text-left pb-4">
                <Badge variant="secondary" className="w-fit bg-emerald-50 text-emerald-700 border-emerald-100 mb-3">
                  Quarterly
                </Badge>
                <CardTitle className="text-2xl font-bold text-slate-950">Pro 3-Month</CardTitle>
                <CardDescription className="text-slate-500 text-xs mt-1">Perfect for growing startups</CardDescription>
              </CardHeader>
              
              <CardContent className="text-left flex-1 pb-6">
                <div className="mb-6">
                  <span className="text-4xl font-extrabold text-slate-900">
                    {billingPeriod === "monthly" ? "$29" : "$23"}
                  </span>
                  <span className="text-slate-500 text-sm font-medium">/ month</span>
                  <p className="text-[10px] text-slate-400 font-semibold mt-1">
                    Billed every 3 months
                  </p>
                </div>
                
                <ul className="space-y-3.5 text-xs text-slate-600 font-medium">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    35,000 credits / 3 months
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    5 Repositories limit
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    500 test cases / month
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    500 test runs / month
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    Voice Agent (10 conversations)
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    Browserbase session video replays
                  </li>
                </ul>
              </CardContent>

              <CardFooter className="pt-0 pb-6 px-6">
                {isLoaded && isSignedIn ? (
                  <Link href="/workspace" className="w-full">
                    <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl">
                      Upgrade Now
                    </Button>
                  </Link>
                ) : (
                  <Link href="/sign-up" className="w-full">
                    <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl">
                      Get Started
                    </Button>
                  </Link>
                )}
              </CardFooter>
            </Card>

            {/* Plan 3: 6-Month Plan */}
            <Card className="flex flex-col bg-white border-2 border-emerald-500 rounded-2xl overflow-hidden shadow-lg shadow-emerald-500/5 hover:shadow-xl transition-all duration-300 hover:scale-[1.01] relative">
              <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">
                Popular
              </div>
              <CardHeader className="text-left pb-4">
                <Badge variant="secondary" className="w-fit bg-emerald-100 text-emerald-800 mb-3">
                  Semi-Annually
                </Badge>
                <CardTitle className="text-2xl font-bold text-slate-950">Business 6-Month</CardTitle>
                <CardDescription className="text-slate-500 text-xs mt-1">Scale up your product team</CardDescription>
              </CardHeader>
              
              <CardContent className="text-left flex-1 pb-6">
                <div className="mb-6">
                  <span className="text-4xl font-extrabold text-slate-900">
                    {billingPeriod === "monthly" ? "$49" : "$39"}
                  </span>
                  <span className="text-slate-500 text-sm font-medium">/ month</span>
                  <p className="text-[10px] text-slate-400 font-semibold mt-1">
                    Billed every 6 months
                  </p>
                </div>
                
                <ul className="space-y-3.5 text-xs text-slate-600 font-medium">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    120,000 credits / 6 months
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    15 Repositories limit
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    2,000 test cases / month
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    2,000 test runs / month
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    Voice Agent (30 conversations)
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    Browserbase session video replays
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    Prioritized AI generation queues
                  </li>
                </ul>
              </CardContent>

              <CardFooter className="pt-0 pb-6 px-6">
                {isLoaded && isSignedIn ? (
                  <Link href="/workspace" className="w-full">
                    <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl">
                      Upgrade Now
                    </Button>
                  </Link>
                ) : (
                  <Link href="/sign-up" className="w-full">
                    <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl">
                      Get Started
                    </Button>
                  </Link>
                )}
              </CardFooter>
            </Card>

            {/* Plan 4: 1-Year Plan */}
            <Card className="flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-emerald-500 hover:shadow-xl transition-all duration-300 hover:scale-[1.01]">
              <CardHeader className="text-left pb-4">
                <Badge variant="secondary" className="w-fit bg-emerald-950 text-emerald-300 mb-3">
                  Annually
                </Badge>
                <CardTitle className="text-2xl font-bold text-slate-950">Enterprise 1-Year</CardTitle>
                <CardDescription className="text-slate-500 text-xs mt-1">Unlimited scale for companies</CardDescription>
              </CardHeader>
              
              <CardContent className="text-left flex-1 pb-6">
                <div className="mb-6">
                  <span className="text-4xl font-extrabold text-slate-900">
                    {billingPeriod === "monthly" ? "$79" : "$63"}
                  </span>
                  <span className="text-slate-500 text-sm font-medium">/ month</span>
                  <p className="text-[10px] text-slate-400 font-semibold mt-1">
                    Billed annually
                  </p>
                </div>
                
                <ul className="space-y-3.5 text-xs text-slate-600 font-medium">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    600,000 credits / year
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    <strong>Unlimited</strong> repositories sync
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    10,000 test cases / month
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    10,000 test runs / month
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    Unlimited Voice Agent Support
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    Browserbase session video replays
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    Prioritized AI generation queues
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    Dedicated premium support
                  </li>
                </ul>
              </CardContent>

              <CardFooter className="pt-0 pb-6 px-6">
                {isLoaded && isSignedIn ? (
                  <Link href="/workspace" className="w-full">
                    <Button className="w-full bg-emerald-900 hover:bg-emerald-950 text-white rounded-xl">
                      Upgrade Now
                    </Button>
                  </Link>
                ) : (
                  <Link href="/sign-up" className="w-full">
                    <Button className="w-full bg-emerald-900 hover:bg-emerald-950 text-white rounded-xl">
                      Get Started
                    </Button>
                  </Link>
                )}
              </CardFooter>
            </Card>

          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-16">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-12 gap-10">
          
          <div className="md:col-span-4 space-y-4">
            <div className="h-9 w-36 relative grayscale brightness-200">
              <Image src="/logo.svg" alt="Testrix Logo" fill className="object-contain" />
            </div>
            <p className="text-xs text-slate-500 leading-relaxed max-w-sm">
              Next-generation AI agent that creates, compiles, and self-heals Playwright test case suites for React & NextJS applications.
            </p>
          </div>

          <div className="md:col-span-2 space-y-3">
            <h4 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Product</h4>
            <ul className="space-y-2 text-xs">
              <li><button onClick={() => scrollToSection(featuresRef)} className="hover:text-emerald-400 transition-colors">Features</button></li>
              <li><button onClick={() => scrollToSection(pricingRef)} className="hover:text-emerald-400 transition-colors">Pricing</button></li>
              <li><Link href="/workspace" className="hover:text-emerald-400 transition-colors">Dashboard</Link></li>
            </ul>
          </div>

          <div className="md:col-span-2 space-y-3">
            <h4 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Resources</h4>
            <ul className="space-y-2 text-xs">
              <li><button onClick={() => scrollToSection(docsRef)} className="hover:text-emerald-400 transition-colors">Documentation</button></li>
              <li><Link href="/workspace" className="hover:text-emerald-400 transition-colors">API References</Link></li>
              <li><a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition-colors">GitHub OAuth</a></li>
            </ul>
          </div>

          <div className="md:col-span-4 space-y-3">
            <h4 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Contact & Support</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Have questions or need custom limits for your organization? Reach out to support.
            </p>
            <p className="text-xs text-slate-300 font-medium">support@testrix.ai</p>
          </div>

        </div>

        <div className="max-w-7xl mx-auto px-6 mt-16 pt-8 border-t border-slate-800 text-center text-[11px] text-slate-600">
          <p>© {new Date().getFullYear()} Testrix Inc. All rights reserved.</p>
        </div>
      </footer>

    </div>
  );
}
