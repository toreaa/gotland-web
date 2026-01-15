import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../../../convex/_generated/api'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

export async function POST(request: NextRequest) {
  try {
    // Sjekk om force_full_sync er satt i query params
    const forceFullSync = request.nextUrl.searchParams.get('full') === 'true'

    // Kall Convex action for å synkronisere
    const result = await convex.action(api.strava.syncActivities, {
      force_full_sync: forceFullSync,
    })

    // Oppdater ukentlige sammendrag hvis nye aktiviteter ble synkronisert
    if (result.synced > 0) {
      await convex.mutation(api.summaries.updateAll, {})
    }

    return NextResponse.json({
      message: 'Sync completed',
      synced: result.synced,
      skipped: result.skipped,
      total: result.total,
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json(
      { error: 'Sync failed', details: String(error) },
      { status: 500 }
    )
  }
}
