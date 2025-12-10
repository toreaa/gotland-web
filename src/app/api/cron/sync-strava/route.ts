import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Verify cron secret to prevent unauthorized access
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return false

  const cronSecret = process.env.CRON_SECRET
  return authHeader === `Bearer ${cronSecret}`
}

// Refresh Strava access token if expired
async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string
  refresh_token: string
  expires_at: number
} | null> {
  try {
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!response.ok) {
      console.error('Token refresh failed:', await response.text())
      return null
    }

    return response.json()
  } catch (error) {
    console.error('Token refresh error:', error)
    return null
  }
}

// Fetch activities from Strava
async function fetchStravaActivities(
  accessToken: string,
  after?: number
): Promise<any[]> {
  const params = new URLSearchParams({
    per_page: '50',
  })

  if (after) {
    params.set('after', after.toString())
  }

  const response = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?${params}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )

  if (!response.ok) {
    console.error('Strava API error:', await response.text())
    return []
  }

  return response.json()
}

export async function GET(request: NextRequest) {
  // Verify cron secret (skip in development)
  if (process.env.NODE_ENV === 'production' && !verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    // Get all stored Strava tokens
    const { data: tokens, error: tokensError } = await supabase
      .from('strava_tokens')
      .select('*')

    if (tokensError || !tokens?.length) {
      return NextResponse.json({
        message: 'No Strava accounts connected',
        synced: 0,
      })
    }

    let totalSynced = 0

    for (const tokenRecord of tokens) {
      let accessToken = tokenRecord.access_token

      // Check if token is expired
      const now = Math.floor(Date.now() / 1000)
      if (tokenRecord.expires_at < now) {
        console.log(`Refreshing token for athlete ${tokenRecord.athlete_id}`)
        const newTokens = await refreshAccessToken(tokenRecord.refresh_token)

        if (!newTokens) {
          console.error(`Failed to refresh token for athlete ${tokenRecord.athlete_id}`)
          continue
        }

        // Update tokens in database
        await supabase
          .from('strava_tokens')
          .update({
            access_token: newTokens.access_token,
            refresh_token: newTokens.refresh_token,
            expires_at: newTokens.expires_at,
            updated_at: new Date().toISOString(),
          })
          .eq('athlete_id', tokenRecord.athlete_id)

        accessToken = newTokens.access_token
      }

      // Get last synced activity timestamp
      const { data: lastActivity } = await supabase
        .from('activities')
        .select('date')
        .eq('strava_athlete_id', tokenRecord.athlete_id)
        .order('date', { ascending: false })
        .limit(1)
        .single()

      const afterTimestamp = lastActivity
        ? Math.floor(new Date(lastActivity.date).getTime() / 1000)
        : undefined

      // Fetch activities from Strava
      const activities = await fetchStravaActivities(accessToken, afterTimestamp)

      // Store activities in Supabase
      for (const activity of activities) {
        const { error: insertError } = await supabase
          .from('activities')
          .upsert({
            strava_id: activity.id,
            strava_athlete_id: tokenRecord.athlete_id,
            name: activity.name,
            activity_type: activity.type,
            sport_type: activity.sport_type,
            date: activity.start_date,
            distance_km: activity.distance / 1000,
            moving_time_seconds: activity.moving_time,
            elapsed_time_seconds: activity.elapsed_time,
            elevation_gain: activity.total_elevation_gain,
            average_speed: activity.average_speed,
            max_speed: activity.max_speed,
            average_heartrate: activity.average_heartrate,
            max_heartrate: activity.max_heartrate,
            calories: activity.calories,
            suffer_score: activity.suffer_score,
            raw_data: activity,
            synced_at: new Date().toISOString(),
          }, { onConflict: 'strava_id' })

        if (insertError) {
          console.error('Insert error:', insertError)
        } else {
          totalSynced++
        }
      }

      console.log(`Synced ${activities.length} activities for athlete ${tokenRecord.athlete_id}`)
    }

    // Update weekly summaries
    await updateWeeklySummaries(supabase)

    return NextResponse.json({
      message: 'Sync completed',
      synced: totalSynced,
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

// Update weekly summaries based on synced activities
async function updateWeeklySummaries(supabase: any) {
  // Get all weeks
  const { data: weeks } = await supabase
    .from('weeks')
    .select('*')

  if (!weeks) return

  for (const week of weeks) {
    // Get activities for this week
    const { data: activities } = await supabase
      .from('activities')
      .select('*')
      .gte('date', week.start_date)
      .lte('date', week.end_date + 'T23:59:59')

    if (!activities?.length) continue

    // Calculate totals
    const totals = activities.reduce(
      (acc: any, act: any) => ({
        km: acc.km + (act.distance_km || 0),
        elevation: acc.elevation + (act.elevation_gain || 0),
        time: acc.time + (act.moving_time_seconds || 0) / 3600,
        count: acc.count + 1,
      }),
      { km: 0, elevation: 0, time: 0, count: 0 }
    )

    // Upsert weekly summary
    await supabase
      .from('weekly_summaries')
      .upsert({
        week_id: week.id,
        actual_km: Math.round(totals.km * 10) / 10,
        actual_elevation: Math.round(totals.elevation),
        actual_hours: Math.round(totals.time * 10) / 10,
        activities_count: totals.count,
        completion_rate: Math.round((totals.km / week.target_km) * 100),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'week_id' })
  }
}
