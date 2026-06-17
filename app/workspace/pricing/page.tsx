"use client"

import React, { useState, useContext, useRef } from "react"
import { motion, useMotionValue, useTransform, useSpring, AnimatePresence } from "framer-motion"
import type { Variants } from "framer-motion"
import {
  Check,
  HelpCircle,
  Sparkles,
  Loader2,
  CheckCircle,
  CreditCard,
  Lock,
  Zap,
  Shield,
} from "lucide-react"
import { UserDetailContext } from "@/context/UserDetailContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import axios from "axios"

function PricingCard3D({ children, className }: { children: React.ReactNode; className?: string }) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
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
        style={{ rotateX: springRotateX, rotateY: springRotateY, transformStyle: "preserve-3d" }}
        className={`w-full flex flex-col ${className}`}
      >
        <div style={{ transform: "translateZ(30px)", transformStyle: "preserve-3d" }} className="flex flex-col flex-1 h-full">
          {children}
        </div>
      </motion.div>
    </motion.div>
  )
}

export default function Pricing() {
  const { userDetail, setUserDetail, subscriptions, setSubscriptions } = useContext(UserDetailContext)
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annually">("monthly")

  const [checkoutPlan, setCheckoutPlan] = useState<any | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStep, setProcessingStep] = useState(0)
  const apiBusy = useRef(false)

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
      creditsToGrant: 0,
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
      creditsToGrant: 2500,
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
      creditsToGrant: 10000,
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
      creditsToGrant: 50000,
    },
  ]

  const getPlanStatus = (planName: string): "active" | "use" | "upgrade" | null => {
    if (planName === "Free Trial") {
      const hasActiveSub = subscriptions?.some((s: any) => s.isActive === 1)
      return hasActiveSub ? null : "active"
    }
    const sub = subscriptions?.find((s: any) => s.planName === planName)
    if (!sub) return "upgrade"
    if (sub.isActive === 1) return "active"
    return "use"
  }

  const getPlanSubscription = (planName: string) => {
    return subscriptions?.find((s: any) => s.planName === planName)
  }

  const loadRazorpayScript = (): Promise<boolean> =>
    new Promise((resolve) => {
      if ((window as any).Razorpay) { resolve(true); return }
      const s = document.createElement("script")
      s.src = "https://checkout.razorpay.com/v1/checkout.js"
      s.onload = () => resolve(true)
      s.onerror = () => resolve(false)
      document.body.appendChild(s)
    })

  const runCheckoutApi = async (plan: any) => {
    const price = billingPeriod === "monthly" ? plan.priceMonthly : plan.priceAnnually

    try {
      const orderRes = await axios.post("/api/checkout/razorpay", {
        planName: plan.name,
        price,
        billingPeriod,
        creditsToGrant: plan.creditsToGrant,
      })

      setProcessingStep(2)

      if (orderRes.data?.simulation) {
        await new Promise((r) => setTimeout(r, 1200))
        setProcessingStep(3)

        const verifyRes = await axios.post("/api/checkout/razorpay/verify", {
          planName: plan.name,
          planBadge: plan.badge,
          creditsToGrant: plan.creditsToGrant,
          billingPeriod,
          priceMonthly: plan.priceMonthly,
          priceAnnually: plan.priceAnnually,
          razorpay_order_id: orderRes.data?.order?.id || "sim_order_" + Date.now(),
          razorpay_payment_id: "sim_payment_" + Date.now(),
          razorpay_signature: "sim_signature",
          simulation: true,
        })

        if (verifyRes.data?.success) {
          setUserDetail(verifyRes.data.user)
          setSubscriptions(verifyRes.data.subscriptions)
        }
        setProcessingStep(4)
        apiBusy.current = false
        return
      }

      if (!orderRes.data?.order?.id) {
        console.error("No order ID returned")
        setProcessingStep(4)
        apiBusy.current = false
        return
      }

      const rzpKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || ""

      if (!rzpKey) {
        console.warn("NEXT_PUBLIC_RAZORPAY_KEY_ID is not set, falling back to simulation")
        await new Promise((r) => setTimeout(r, 1200))
        setProcessingStep(3)

        const verifyRes = await axios.post("/api/checkout/razorpay/verify", {
          planName: plan.name,
          planBadge: plan.badge,
          creditsToGrant: plan.creditsToGrant,
          billingPeriod,
          priceMonthly: plan.priceMonthly,
          priceAnnually: plan.priceAnnually,
          razorpay_order_id: orderRes.data.order.id,
          razorpay_payment_id: "sim_payment_" + Date.now(),
          razorpay_signature: "sim_signature",
          simulation: true,
        })

        if (verifyRes.data?.success) {
          setUserDetail(verifyRes.data.user)
          setSubscriptions(verifyRes.data.subscriptions)
        }
        setProcessingStep(4)
        apiBusy.current = false
        return
      }

      const scriptLoaded = await loadRazorpayScript()
      if (!scriptLoaded) {
        console.error("Failed to load Razorpay SDK")
        setProcessingStep(4)
        apiBusy.current = false
        return
      }

      setIsProcessing(false)

      const options = {
        key: rzpKey,
        amount: price * 100,
        currency: "INR",
        name: "Testrix",
        description: `${plan.name} Plan`,
        order_id: orderRes.data.order.id,
        handler: async function (response: any) {
          setIsProcessing(true)
          setProcessingStep(3)
          try {
            const verifyRes = await axios.post("/api/checkout/razorpay/verify", {
              planName: plan.name,
              planBadge: plan.badge,
              creditsToGrant: plan.creditsToGrant,
              billingPeriod,
              priceMonthly: plan.priceMonthly,
              priceAnnually: plan.priceAnnually,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              simulation: false,
            })
            if (verifyRes.data?.success) {
              setUserDetail(verifyRes.data.user)
              setSubscriptions(verifyRes.data.subscriptions)
            }
          } catch (err) {
            console.error("Verify failed:", err)
          }
          setProcessingStep(4)
          apiBusy.current = false
        },
        modal: {
          ondismiss: () => {
            apiBusy.current = false
          },
        },
        prefill: {
          email: userDetail?.email || "",
          name: userDetail?.name || "",
        },
        theme: { color: "#059669" },
      }

      const rzp = new (window as any).Razorpay(options)
      rzp.open()
    } catch (err) {
      console.error("Checkout failed:", err)
      setProcessingStep(4)
      setTimeout(() => { setIsProcessing(false); apiBusy.current = false }, 2000)
    }
  }

  const handleCheckout = (plan: any) => {
    if (plan.isTrial || apiBusy.current) return
    apiBusy.current = true

    setCheckoutPlan(plan)
    setProcessingStep(1)
    setIsProcessing(true)

    setTimeout(() => runCheckoutApi(plan), 100)
  }

  const handleUsePlan = async (planName: string) => {
    const sub = getPlanSubscription(planName)
    if (!sub) return
    try {
      const res = await axios.post("/api/subscriptions/activate", { subscriptionId: sub.id })
      if (res.data?.success) setSubscriptions(res.data.subscriptions)
    } catch (err) {
      console.error("Failed to activate plan:", err)
    }
  }

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  }

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
  }

  const steps = [
    { label: "Order Created", detail: `${billingPeriod === "monthly" ? `$${checkoutPlan?.priceMonthly}` : `$${checkoutPlan?.priceAnnually}`} — ${checkoutPlan?.name}` },
    { label: "Payment Confirmed", detail: "Transaction verified securely" },
    { label: "Credits Applied", detail: `+${checkoutPlan?.creditsToGrant} credits added` },
  ]

  return (
    <div className="min-h-screen bg-slate-50/50 relative py-12 px-6 overflow-hidden">
      <div className="absolute top-[-100px] left-[50%] -translate-x-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-emerald-100/40 to-teal-100/30 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-[-100px] right-[10%] w-[300px] h-[300px] bg-emerald-50/30 rounded-full blur-3xl pointer-events-none -z-10" />

      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="max-w-6xl mx-auto space-y-12">
        <motion.div variants={itemVariants} className="text-center space-y-4">
          <Badge className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 px-3 py-1 rounded-full text-xs font-semibold">
            <Sparkles className="h-3 w-3 inline mr-1 fill-emerald-600/20 text-emerald-600 animate-pulse" /> PRICING PLANS
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Flexible plans for <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">every team size</span>
          </h1>
          <p className="text-slate-600 text-base max-w-xl mx-auto">
            Choose the subscription that fits your development pipeline.
          </p>

          <div className="pt-4 flex justify-center">
            <div className="inline-flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-2xl shadow-sm relative z-10">
              <button onClick={() => setBillingPeriod("monthly")} className="px-5 py-2 rounded-xl text-xs font-semibold transition-all relative cursor-pointer">
                {billingPeriod === "monthly" && (
                  <motion.div layoutId="billingToggle" className="absolute inset-0 bg-emerald-600 rounded-xl -z-10 shadow-sm" transition={{ type: "spring", stiffness: 300, damping: 25 }} />
                )}
                <span className={billingPeriod === "monthly" ? "text-white" : "text-slate-500 hover:text-slate-900"}>Monthly</span>
              </button>
              <button onClick={() => setBillingPeriod("annually")} className="px-5 py-2 rounded-xl text-xs font-semibold transition-all relative cursor-pointer">
                {billingPeriod === "annually" && (
                  <motion.div layoutId="billingToggle" className="absolute inset-0 bg-emerald-600 rounded-xl -z-10 shadow-sm" transition={{ type: "spring", stiffness: 300, damping: 25 }} />
                )}
                <span className={billingPeriod === "annually" ? "text-white" : "text-slate-500 hover:text-slate-900"}>
                  Annually <span className={billingPeriod === "annually" ? "text-emerald-200 font-bold" : "text-emerald-600 font-semibold"}>Save 20%</span>
                </span>
              </button>
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 pt-4 items-stretch">
          {plans.map((plan) => {
            const price = billingPeriod === "monthly" ? plan.priceMonthly : plan.priceAnnually
            const isFree = plan.priceMonthly === 0
            const planStatus = getPlanStatus(plan.name)

            return (
              <PricingCard3D key={plan.name} className={`bg-white rounded-3xl border transition-all duration-500 overflow-hidden flex flex-col justify-between ${
                plan.isPopular
                  ? "border-emerald-500 shadow-xl shadow-emerald-500/5 ring-1 ring-emerald-500/20"
                  : planStatus === "active"
                    ? "border-emerald-400 shadow-lg shadow-emerald-400/10 ring-1 ring-emerald-400/30"
                    : "border-slate-200/80 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-500/5"
              }`}>
                {plan.isPopular && (
                  <div className="bg-emerald-500 text-white text-[10px] font-bold px-4 py-1.5 uppercase tracking-wider text-center w-full">Most Popular</div>
                )}
                <CardHeader className="text-left pb-4 pt-6 px-6 relative">
                  <div className="flex justify-between items-start">
                    <Badge variant="secondary" className={`mb-3 ${
                      plan.isPopular ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                        : plan.isTrial ? "bg-slate-100 text-slate-700 border-slate-200"
                          : planStatus === "active" ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                            : "bg-emerald-950 text-emerald-300"
                    }`}>
                      {planStatus === "active" && !plan.isTrial ? (
                        <span className="flex items-center gap-1"><Sparkles className="h-3 w-3 fill-emerald-600/40" /> Active</span>
                      ) : plan.badge}
                    </Badge>
                  </div>
                  <CardTitle className="text-xl font-bold text-slate-950">{plan.name}</CardTitle>
                  <CardDescription className="text-slate-500 text-xs mt-1">{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="text-left flex-1 pb-6 px-6">
                  <div className="mb-6 flex items-baseline gap-1">
                    {planStatus === "active" && !plan.isTrial ? (
                      <span className="text-2xl font-bold text-emerald-600">Active Plan</span>
                    ) : planStatus === "use" ? (
                      <span className="text-2xl font-bold text-slate-900">Owned</span>
                    ) : (
                      <><span className="text-4xl font-extrabold text-slate-900">${price}</span><span className="text-slate-500 text-sm font-medium">/ {plan.period}</span></>
                    )}
                  </div>
                  {plan.billingText && !isFree && planStatus !== "active" && planStatus !== "use" && (
                    <p className="text-[10px] text-slate-400 font-semibold mb-6 -mt-4">{plan.billingText}</p>
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
                  {planStatus === "active" && plan.isTrial ? (
                    <Button variant="outline" className="w-full border-emerald-300 text-emerald-700 bg-emerald-50 rounded-xl py-5 font-semibold text-xs cursor-default" disabled>
                      <CheckCircle className="h-3.5 w-3.5 mr-1.5" /> Active Free Plan
                    </Button>
                  ) : planStatus === "active" ? (
                    <Button variant="outline" className="w-full border-emerald-300 text-emerald-700 bg-emerald-50 rounded-xl py-5 font-semibold text-xs cursor-default" disabled>
                      <CheckCircle className="h-3.5 w-3.5 mr-1.5" /> Active
                    </Button>
                  ) : planStatus === "use" ? (
                    <Button onClick={() => handleUsePlan(plan.name)} className="w-full rounded-xl py-5 font-semibold text-xs transition-transform active:scale-[0.98] bg-white text-emerald-700 border-2 border-emerald-400 hover:bg-emerald-50">
                      Use This Plan
                    </Button>
                  ) : (
                    <Button onClick={() => handleCheckout(plan)} className={`w-full rounded-xl py-5 font-semibold text-xs transition-transform active:scale-[0.98] ${
                      plan.isPopular ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/10" : "bg-slate-900 hover:bg-slate-800 text-white"
                    }`}>
                      Upgrade Workspace
                    </Button>
                  )}
                </CardFooter>
              </PricingCard3D>
            )
          })}
        </motion.div>

        <motion.div variants={itemVariants} className="pt-12 border-t border-slate-200 max-w-3xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-slate-900 flex items-center justify-center gap-2">
              <HelpCircle className="h-5 w-5 text-emerald-600" /> Pricing & Billing FAQs
            </h2>
            <p className="text-slate-500 text-sm">Answers to common questions about accounts, credits, and pricing.</p>
          </div>
          <Accordion type="single" collapsible className="w-full bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
            <AccordionItem value="item-1" className="border-b border-slate-100">
              <AccordionTrigger className="text-slate-800 font-semibold hover:text-emerald-600 text-sm py-4">What are credits used for?</AccordionTrigger>
              <AccordionContent className="text-slate-500 text-xs leading-relaxed pb-4">Credits are consumed when Testrix generates or executes automated Playwright test scripts.</AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2" className="border-b border-slate-100">
              <AccordionTrigger className="text-slate-800 font-semibold hover:text-emerald-600 text-sm py-4">Can I upgrade, downgrade, or switch plans?</AccordionTrigger>
              <AccordionContent className="text-slate-500 text-xs leading-relaxed pb-4">Yes! Switch between owned plans anytime by clicking "Use This Plan".</AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3" className="border-b border-slate-100">
              <AccordionTrigger className="text-slate-800 font-semibold hover:text-emerald-600 text-sm py-4">Is my payment information secure?</AccordionTrigger>
              <AccordionContent className="text-slate-500 text-xs leading-relaxed pb-4">All payment processing is handled through Razorpay's PCI-DSS compliant infrastructure.</AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-4" className="border-b-0">
              <AccordionTrigger className="text-slate-800 font-semibold hover:text-emerald-600 text-sm py-4">What is Browserbase session playback?</AccordionTrigger>
              <AccordionContent className="text-slate-500 text-xs leading-relaxed pb-4">Paid plans include Browserbase cloud-browser session recordings for debugging.</AccordionContent>
            </AccordionItem>
          </Accordion>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => { if (processingStep === 4) setIsProcessing(false) }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-8">
                <div className="text-center flex flex-col items-center mb-6">
                  <motion.div
                    key={processingStep}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    {processingStep === 4 ? (
                      <div className="h-16 w-16 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-emerald-200">
                        <CheckCircle className="h-8 w-8 text-white" />
                      </div>
                    ) : (
                      <div className="h-16 w-16 bg-gradient-to-br from-slate-700 to-slate-900 rounded-full flex items-center justify-center mb-4 shadow-lg">
                        <CreditCard className="h-7 w-7 text-emerald-400" />
                      </div>
                    )}
                  </motion.div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {processingStep === 4 ? "Payment Successful!" : "Secure Checkout"}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    {processingStep === 4
                      ? `${checkoutPlan?.name} plan is now active with +${checkoutPlan?.creditsToGrant} credits`
                      : `Processing your ${checkoutPlan?.name} plan subscription`}
                  </p>
                </div>

                <div className="my-6 space-y-3">
                  {steps.map((step, idx) => {
                    const stepNum = idx + 1
                    const isDone = processingStep > stepNum
                    const isCurrent = processingStep === stepNum

                    return (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 * idx }}
                        className={`flex items-center gap-3 text-sm p-3 rounded-xl border transition-all duration-500 ${
                          isDone ? "bg-emerald-50 border-emerald-100" : isCurrent ? "bg-white border-emerald-300 shadow-sm" : "bg-slate-50 border-slate-100"
                        }`}
                      >
                        <div className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 transition-all ${
                          isDone ? "bg-emerald-100 text-emerald-700" : isCurrent ? "bg-emerald-500 text-white shadow-md shadow-emerald-200" : "bg-slate-200 text-slate-400"
                        }`}>
                          {isDone ? "✓" : isCurrent ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : stepNum}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium truncate ${isDone ? "text-emerald-700" : isCurrent ? "text-slate-900" : "text-slate-400"}`}>
                            {step.label}
                          </p>
                          {isCurrent && <p className="text-xs text-slate-400 truncate">{step.detail}</p>}
                        </div>
                      </motion.div>
                    )
                  })}
                </div>

                <div className="pt-2">
                  {processingStep === 4 ? (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-3"
                    >
                      <div className="flex items-center justify-center gap-2 text-xs text-emerald-600 font-medium">
                        <Lock className="h-3 w-3" />
                        Secured by Razorpay
                      </div>
                      <Button
                        onClick={() => setIsProcessing(false)}
                        className="bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white rounded-xl w-full py-5 shadow-lg shadow-emerald-200"
                      >
                        <Zap className="h-4 w-4 mr-2" /> Return to Plans
                      </Button>
                    </motion.div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                        <Lock className="h-3 w-3" />
                        <span>Secured by Razorpay</span>
                        <span className="text-slate-300">•</span>
                        <Shield className="h-3 w-3" />
                        <span>PCI-DSS Compliant</span>
                      </div>
                      <Button disabled className="bg-slate-100 text-slate-400 rounded-xl w-full py-5 cursor-not-allowed">
                        <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }} className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {processingStep <= 1 ? "Initializing..." : "Processing..."}
                        </motion.div>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
