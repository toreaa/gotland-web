import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../../../convex/_generated/api'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

// Verify request is from Vercel Cron or has valid secret
function isAuthorizedCronRequest(request: NextRequest): boolean {
  // Vercel Cron sends this header
  const vercelCron = request.headers.get('x-vercel-cron')
  if (vercelCron) return true

  // Also accept CRON_SECRET if configured
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true

  return false
}

export async function GET(request: NextRequest) {
  // Verify request is from Vercel Cron (skip in development)
  if (process.env.NODE_ENV === 'production' && !isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Kall Convex action for å synkronisere (inkrementell)
    const result = await convex.action(api.strava.syncActivities, {
      force_full_sync: false,
    })

    // Oppdater ukentlige sammendrag hvis nye aktiviteter ble synkronisert
    if (result.synced > 0) {
      await convex.mutation(api.summaries.updateAll, {})
    }

    return NextResponse.json({
      message: 'Cron sync completed',
      synced: result.synced,
      skipped: result.skipped,
      total: result.total,
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    console.error('Cron sync error:', error)
    return NextResponse.json(
      { error: 'Sync failed', details: String(error) },
      { status: 500 }
    )
  }
}
