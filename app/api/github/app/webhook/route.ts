import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { db, users } from '@/db';
import { eq } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  const signature = req.headers.get('x-hub-signature-256');
  const body = await req.text();
  const webhookSecret = process.env.GITHUB_APP_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('GITHUB_APP_WEBHOOK_SECRET not configured');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const expectedSignature = createHmac('sha256', webhookSecret).update(body).digest();
  const suppliedSignature = signature?.startsWith('sha256=') ? Buffer.from(signature.slice(7), 'hex') : Buffer.alloc(0);
  if (suppliedSignature.length !== expectedSignature.length || !timingSafeEqual(suppliedSignature, expectedSignature)) {
    console.error('Invalid webhook signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = req.headers.get('x-github-event');
  let payload: any;
  try { payload = JSON.parse(body); } catch { return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 }); }

  console.log(`Received GitHub webhook: ${event}`, payload.action);

  switch (event) {
    case 'installation':
      if (payload.action === 'deleted') {
        console.log('GitHub App uninstalled:', payload.installation.id);
        await db.update(users).set({ installationId: null }).where(eq(users.installationId, String(payload.installation.id)));
      }
      break;
    case 'installation_repositories':
      console.log('Repositories added/removed:', payload.repositories_added, payload.repositories_removed);
      break;
    default:
      console.log(`Unhandled webhook event: ${event}`);
  }

  return NextResponse.json({ received: true });
}
