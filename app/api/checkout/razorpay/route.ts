import { NextResponse } from "next/server";
import { razorpay } from "@/lib/razorpay";

export async function POST(req: Request) {
  try {
    const { planName, price, billingPeriod, creditsToGrant } = await req.json();

    const isSimulation =
      !process.env.RAZORPAY_KEY_ID ||
      process.env.RAZORPAY_KEY_ID === "rzp_test_xxxxxxxxxxxx";

    if (isSimulation) {
      return NextResponse.json({
        simulation: true,
        order: { id: "sim_order_" + Date.now() },
      });
    }

    const options = {
      amount: price * 100,
      currency: "INR",
      receipt: `receipt_${planName.replace(/\s+/g, "_")}_${Date.now()}`,
      notes: {
        planName,
        billingPeriod,
        creditsToGrant: String(creditsToGrant),
      },
    };

    const order = await razorpay.orders.create(options);
    return NextResponse.json({ order });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
