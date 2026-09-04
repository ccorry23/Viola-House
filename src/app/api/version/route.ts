import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Returns an identifier that changes with every deployment, so an already-open
 * app can notice a newer version is live and offer to refresh. On Vercel each
 * deployment has a unique VERCEL_URL; locally it's a constant ("dev") so the
 * check never fires during development.
 */
export async function GET() {
  const version =
    process.env.VERCEL_URL ||
    process.env.VERCEL_DEPLOYMENT_ID ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    'dev'
  return NextResponse.json(
    { version },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  )
}
