import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  const signature = req.headers.get('x-hub-signature-256');
  const body = await req.text();
  const webhookSecret = process.env.GITHUB_APP_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('GITHUB_APP_WEBHOOK_SECRET not configured');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const expectedSignature = `sha256=${crypto
    .createHmac('sha256', webhookSecret)
    .update(body)
    .digest('hex')}`;

  if (signature !== expectedSignature) {
    console.error('Invalid webhook signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = req.headers.get('x-github-event');
  const payload = JSON.parse(body);

  console.log(`Received GitHub webhook: ${event}`, payload.action);

  switch (event) {
    case 'installation':
      if (payload.action === 'deleted') {
        console.log('GitHub App uninstalled:', payload.installation.id);
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