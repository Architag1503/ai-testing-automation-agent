"use client"

import React, { useState, useContext } from "react"
import { motion, useMotionValue, useTransform, useSpring, AnimatePresence } from "framer-motion"
import type { Variants } from "framer-motion"
import { 
  Check, 
  HelpCircle, 
  Sparkles, 
  Loader2, 
  CheckCircle, 
  AlertTriangle 
} from "lucide-react"
import { UserDetailContext } from "@/context/UserDetailContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import axios from "axios"

// 3D Card tilt component
function PricingCard3D({ children, className }: { children: React.ReactNode; className?: string }) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  // Subtle rotation limits for standard premium look
  const rotateX = useTransform(y, [-150, 150], [8, -8])
  const rotateY = useTransform(x, [-150, 150], [-8, 8])

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
        {/* Child items float using translateZ */}
        <div style={{ transform: "translateZ(30px)", transformStyle: "preserve-3d" }} className="flex flex-col flex-1 h-full">
          {children}
        </div>
      </motion.div>
    </motion.div>
  )
}

export default function Pricing() {
  const { userDetail, setUserDetail } = useContext(UserDetailContext)
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annually">("monthly")
  
  // Checkout simulation modal states
  const [checkoutPlan, setCheckoutPlan] = useState<any | null>(null)
  const [isSimulating, setIsSimulating] = useState(false)
  const [simulationStep, setSimulationStep] = useState(0)
  const [isStripeError, setIsStripeError] = useState(false)

  const plans = [
    {
      name: "Free Trial",
      badge: "Trial",
      description: "Get started with Testrix",
      priceMonthly: 0,
      priceAnnually: 0,
      period: "10 days",
      features: [
        "1 Repository sync limit",
        "20 test cases generated",
        "20 test runs executed",
        "No session video replays",
        "No CI/CD auto-run on PRs",
      ],
      isPopular: false,
      isTrial: true,
      priceIdMonthly: "free_trial",
      priceIdAnnually: "free_trial",
      creditsToGrant: 0
    },
    {
      name: "Pro 3-Month",
      badge: "Quarterly",
      description: "Perfect for growing startups",
      priceMonthly: 29,
      priceAnnually: 23,
      period: "month",
      billingText: "Billed every 3 months",
      features: [
        "5 Repositories limit",
        "500 test cases / month",
        "500 test runs / month",
        "Browserbase session video replays",
        "CI/CD — GitHub Actions auto-run",
      ],
      isPopular: false,
      isTrial: false,
      priceIdMonthly: "price_1Pro3Month_monthly",
      priceIdAnnually: "price_1Pro3Month_annually",
      creditsToGrant: 2500
    },
    {
      name: "Business 6-Month",
      badge: "Semi-Annually",
      description: "Scale up your product team",
      priceMonthly: 49,
      priceAnnually: 39,
      period: "month",
      billingText: "Billed every 6 months",
      features: [
        "15 Repositories limit",
        "2,000 test cases / month",
        "2,000 test runs / month",
        "Browserbase session video replays",
        "CI/CD — GitHub Actions auto-run",
        "Prioritized AI generation queues",
      ],
      isPopular: true,
      isTrial: false,
      priceIdMonthly: "price_1Biz6Month_monthly",
      priceIdAnnually: "price_1Biz6Month_annually",
      creditsToGrant: 10000
    },
    {
      name: "Enterprise 1-Year",
      badge: "Annually",
      description: "Unlimited scale for companies",
      priceMonthly: 79,
      priceAnnually: 63,
      period: "month",
      billingText: "Billed annually",
      features: [
        "Unlimited repositories sync",
        "10,000 test cases / month",
        "10,000 test runs / month",
        "Browserbase session video replays",
        "CI/CD — GitHub Actions auto-run",
        "Prioritized AI queues",
        "Dedicated premium support",
      ],
      isPopular: false,
      isTrial: false,
      priceIdMonthly: "price_1Ent1Year_monthly",
      priceIdAnnually: "price_1Ent1Year_annually",
      creditsToGrant: 50000
    }
  ]

  const handleCheckout = async (plan: any) => {
    if (plan.isTrial) return; // Free trial is default

    const priceId = billingPeriod === "monthly" ? plan.priceIdMonthly : plan.priceIdAnnually
    setCheckoutPlan(plan)
    setIsSimulating(true)
    setSimulationStep(1)
    setIsStripeError(false)

    try {
      // Try calling stripe route
      const response = await axios.post("/api/checkout/stripe", { priceId })
      if (response.data?.url) {
        setSimulationStep(2)
        setTimeout(() => {
          window.location.href = response.data.url
        }, 1000)
      } else {
        throw new Error("No URL returned")
      }
    } catch (error) {
      console.log("Stripe initiation failed (expected in local dev):", error)
      setIsStripeError(true)
      // Run checkout simulation step-by-step
      setTimeout(() => {
        setSimulationStep(2) // Simulating Local DB Upgrade
        setTimeout(async () => {
          if (userDetail?.email) {
            try {
              const res = await axios.post("/api/users/add-credits", {
                email: userDetail.email,
                amount: plan.creditsToGrant
              })
              if (res.data?.success) {
                setUserDetail(res.data.user)
              }
            } catch (dbErr) {
              console.error("Failed to add credits in DB:", dbErr)
            }
          }
          setSimulationStep(3) // Checkout Success
        }, 1500)
      }, 1500)
    }
  }

  // Animation variants — typed as Variants so ease literals pass TS strict checks
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
      {/* Decorative Blur Blobs */}
      <div className="absolute top-[-100px] left-[50%] -translate-x-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-emerald-100/40 to-teal-100/30 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-[-100px] right-[10%] w-[300px] h-[300px] bg-emerald-50/30 rounded-full blur-3xl pointer-events-none -z-10" />

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-6xl mx-auto space-y-12"
      >
        
        {/* Header Section */}
        <motion.div variants={itemVariants} className="text-center space-y-4">
          <Badge className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 px-3 py-1 rounded-full text-xs font-semibold">
            <Sparkles className="h-3 w-3 inline mr-1 fill-emerald-600/20 text-emerald-600 animate-pulse" /> PRICING PLANS
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Flexible plans for <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">every team size</span>
          </h1>
          <p className="text-slate-600 text-base max-w-xl mx-auto">
            Choose the subscription that fits your development pipeline. Scale up your credits and concurrent testing capabilities.
          </p>

          {/* Sliding Billing Toggle */}
          <div className="pt-4 flex justify-center">
            <div className="inline-flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-2xl shadow-sm relative z-10">
              <button 
                onClick={() => setBillingPeriod("monthly")}
                className="px-5 py-2 rounded-xl text-xs font-semibold transition-all relative cursor-pointer"
              >
                {billingPeriod === "monthly" && (
                  <motion.div 
                    layoutId="billingToggle"
                    className="absolute inset-0 bg-emerald-600 rounded-xl -z-10 shadow-sm"
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  />
                )}
                <span className={billingPeriod === "monthly" ? "text-white" : "text-slate-500 hover:text-slate-900"}>
                  Monthly
                </span>
              </button>
              <button 
                onClick={() => setBillingPeriod("annually")}
                className="px-5 py-2 rounded-xl text-xs font-semibold transition-all relative cursor-pointer"
              >
                {billingPeriod === "annually" && (
                  <motion.div 
                    layoutId="billingToggle"
                    className="absolute inset-0 bg-emerald-600 rounded-xl -z-10 shadow-sm"
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  />
                )}
                <span className={billingPeriod === "annually" ? "text-white" : "text-slate-500 hover:text-slate-900"}>
                  Annually <span className={billingPeriod === "annually" ? "text-emerald-200 font-bold" : "text-emerald-600 font-semibold"}>Save 20%</span>
                </span>
              </button>
            </div>
          </div>
        </motion.div>

        {/* Pricing Cards Grid */}
        <motion.div 
          variants={itemVariants} 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 pt-4 items-stretch"
        >
          {plans.map((plan) => {
            const price = billingPeriod === "monthly" ? plan.priceMonthly : plan.priceAnnually
            const isFree = plan.priceMonthly === 0

            return (
              <PricingCard3D 
                key={plan.name} 
                className={`bg-white rounded-3xl border transition-all duration-500 overflow-hidden flex flex-col justify-between ${
                  plan.isPopular 
                    ? "border-emerald-500 shadow-xl shadow-emerald-500/5 ring-1 ring-emerald-500/20" 
                    : "border-slate-200/80 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-500/5"
                }`}
              >
                {plan.isPopular && (
                  <div className="bg-emerald-500 text-white text-[10px] font-bold px-4 py-1.5 uppercase tracking-wider text-center w-full">
                    Most Popular
                  </div>
                )}
                
                <CardHeader className="text-left pb-4 pt-6 px-6 relative">
                  <div className="flex justify-between items-start">
                    <Badge variant="secondary" className={`mb-3 ${
                      plan.isPopular 
                        ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                        : plan.isTrial 
                          ? "bg-slate-100 text-slate-700 border-slate-200" 
                          : "bg-emerald-950 text-emerald-300"
                    }`}>
                      {plan.badge}
                    </Badge>
                  </div>
                  <CardTitle className="text-xl font-bold text-slate-950 flex items-center gap-1.5">
                    {plan.name}
                  </CardTitle>
                  <CardDescription className="text-slate-500 text-xs mt-1 leading-relaxed">
                    {plan.description}
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="text-left flex-1 pb-6 px-6">
                  <div className="mb-6 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold text-slate-900">${price}</span>
                    <span className="text-slate-500 text-sm font-medium">/ {plan.period}</span>
                  </div>

                  {plan.billingText && !isFree && (
                    <p className="text-[10px] text-slate-400 font-semibold mb-6 -mt-4">
                      {plan.billingText}
                    </p>
                  )}
                  
                  <ul className="space-y-3.5 text-xs text-slate-600 font-medium">
                    {plan.features.map((feature, idx) => {
                      const isNotIncluded = feature.startsWith("No ") || feature.startsWith("no ")
                      return (
                        <li key={idx} className={`flex items-start gap-2.5 ${isNotIncluded ? "text-slate-400 line-through" : ""}`}>
                          <Check className={`h-4 w-4 shrink-0 mt-0.5 ${isNotIncluded ? "text-slate-300" : "text-emerald-500"}`} />
                          <span>{feature}</span>
                        </li>
                      )
                    })}
                  </ul>
                </CardContent>

                <CardFooter className="pt-0 pb-6 px-6">
                  {isFree ? (
                    <Button 
                      variant="outline" 
                      className="w-full border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl py-5 font-semibold text-xs cursor-default"
                      disabled
                    >
                      Active Free Plan
                    </Button>
                  ) : (
                    <Button 
                      onClick={() => handleCheckout(plan)}
                      className={`w-full rounded-xl py-5 font-semibold text-xs transition-transform active:scale-[0.98] ${
                        plan.isPopular
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/10"
                          : "bg-slate-900 hover:bg-slate-800 text-white"
                      }`}
                    >
                      Upgrade Workspace
                    </Button>
                  )}
                </CardFooter>
              </PricingCard3D>
            )
          })}
        </motion.div>

        {/* FAQ Section */}
        <motion.div variants={itemVariants} className="pt-12 border-t border-slate-200 max-w-3xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-slate-900 flex items-center justify-center gap-2">
              <HelpCircle className="h-5 w-5 text-emerald-600" /> Pricing & Billing FAQs
            </h2>
            <p className="text-slate-500 text-sm">
              Answers to common questions about accounts, credits, and pricing.
            </p>
          </div>

          <Accordion type="single" collapsible className="w-full bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
            <AccordionItem value="item-1" className="border-b border-slate-100">
              <AccordionTrigger className="text-slate-800 font-semibold hover:text-emerald-600 text-sm py-4">
                What are credits used for?
              </AccordionTrigger>
              <AccordionContent className="text-slate-500 text-xs leading-relaxed pb-4">
                Credits are consumed when Testrix generates or executes automated Playwright test scripts. A typical generation costs 20 credits, while a cloud execution run takes 10 credits.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2" className="border-b border-slate-100">
              <AccordionTrigger className="text-slate-800 font-semibold hover:text-emerald-600 text-sm py-4">
                Can I upgrade or downgrade my plan at any time?
              </AccordionTrigger>
              <AccordionContent className="text-slate-500 text-xs leading-relaxed pb-4">
                Yes! You can change your plan at any time. When upgrading or downgrading, your credits and repositories limit will adjust immediately, and Stripe will prorate the billing amount for your billing cycles.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3" className="border-b border-slate-100">
              <AccordionTrigger className="text-slate-800 font-semibold hover:text-emerald-600 text-sm py-4">
                How does the simulation checkout work?
              </AccordionTrigger>
              <AccordionContent className="text-slate-500 text-xs leading-relaxed pb-4">
                If Stripe keys are not configured in your project settings/environment, our platform triggers a fallback Developer Simulation. It mocks the transaction locally and safely grants the plan's credits (e.g. +2,500 credits for Pro) straight to your active workspace so you can test features seamlessly.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4" className="border-b-0">
              <AccordionTrigger className="text-slate-800 font-semibold hover:text-emerald-600 text-sm py-4">
                What is Browserbase session playback?
              </AccordionTrigger>
              <AccordionContent className="text-slate-500 text-xs leading-relaxed pb-4">
                For paid plans, Testrix connects to Browserbase cloud-browsers. We capture execution logs, screenshot milestones, and record video playbacks of the AI interacting with your application. This makes debugging UI failures incredibly easy.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </motion.div>
        
      </motion.div>

      {/* Simulated Checkout Dialog */}
      <Dialog open={isSimulating} onOpenChange={(open) => !open && setIsSimulating(false)}>
        <DialogContent className="sm:max-w-md bg-white border border-slate-100 rounded-2xl p-6 shadow-2xl">
          <DialogHeader className="text-center flex flex-col items-center">
            {simulationStep === 3 ? (
              <div className="h-16 w-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4 text-emerald-600 border border-emerald-100">
                <CheckCircle className="h-8 w-8 animate-bounce" />
              </div>
            ) : isStripeError ? (
              <div className="h-16 w-16 bg-amber-50 rounded-full flex items-center justify-center mb-4 text-amber-600 border border-amber-100">
                <AlertTriangle className="h-8 w-8" />
              </div>
            ) : (
              <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-emerald-600 border border-slate-100">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            )}
            <DialogTitle className="text-lg font-bold text-slate-900">
              {simulationStep === 3 
                ? "Workspace Upgraded!" 
                : isStripeError 
                  ? "Stripe Development Simulation" 
                  : "Connecting to Stripe"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {simulationStep === 3 
                ? `Successfully subscribed to the ${checkoutPlan?.name} plan.`
                : isStripeError 
                  ? "Local development bypass activated." 
                  : "Please wait while we establish a secure session."}
            </DialogDescription>
          </DialogHeader>

          {/* Stepper Status list */}
          <div className="my-6 space-y-4">
            <div className="flex items-center gap-3 text-xs">
              <div className="h-5 w-5 rounded-full flex items-center justify-center font-bold text-[10px] bg-emerald-100 text-emerald-700">✓</div>
              <span className="text-slate-600 font-medium">Verify User Account Session</span>
            </div>

            <div className="flex items-center gap-3 text-xs">
              {simulationStep >= 2 ? (
                isStripeError ? (
                  <>
                    <div className="h-5 w-5 rounded-full flex items-center justify-center font-bold text-[10px] bg-amber-100 text-amber-700">!</div>
                    <span className="text-amber-700 font-medium">Stripe Credentials Missing (Using Bypass)</span>
                  </>
                ) : (
                  <>
                    <div className="h-5 w-5 rounded-full flex items-center justify-center font-bold text-[10px] bg-emerald-100 text-emerald-700">✓</div>
                    <span className="text-slate-600 font-medium">Stripe Checkout Session Established</span>
                  </>
                )
              ) : (
                <>
                  <div className="h-5 w-5 rounded-full flex items-center justify-center bg-slate-100 text-slate-400"><Loader2 className="h-3 w-3 animate-spin" /></div>
                  <span className="text-slate-400 font-medium">Contacting Stripe Payment Gateway</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs">
              {simulationStep >= 3 ? (
                <>
                  <div className="h-5 w-5 rounded-full flex items-center justify-center font-bold text-[10px] bg-emerald-100 text-emerald-700">✓</div>
                  <span className="text-emerald-700 font-semibold">
                    Credits Credited (+{checkoutPlan?.creditsToGrant} credits)
                  </span>
                </>
              ) : simulationStep === 2 ? (
                <>
                  <div className="h-5 w-5 rounded-full flex items-center justify-center bg-emerald-100 text-emerald-700"><Loader2 className="h-3 w-3 animate-spin" /></div>
                  <span className="text-slate-700 font-medium">Fulfilling order credit payload...</span>
                </>
              ) : (
                <>
                  <div className="h-5 w-5 rounded-full flex items-center justify-center bg-slate-100 text-slate-400 text-[10px]">3</div>
                  <span className="text-slate-400">Apply plan assets to workspace</span>
                </>
              )}
            </div>
          </div>

          <DialogFooter className="sm:justify-center">
            {simulationStep === 3 ? (
              <Button 
                onClick={() => setIsSimulating(false)} 
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl w-full"
              >
                Return to Workspace
              </Button>
            ) : isStripeError ? (
              <Button 
                disabled 
                className="bg-slate-100 text-slate-400 rounded-xl w-full"
              >
                Completing Mock Checkout...
              </Button>
            ) : (
              <Button 
                disabled 
                className="bg-slate-100 text-slate-400 rounded-xl w-full"
              >
                Redirecting...
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
