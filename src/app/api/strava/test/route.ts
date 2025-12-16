import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Get token
  const { data: tokens } = await supabase
    .from('strava_tokens')
    .select('*')
    .limit(1)

  if (!tokens?.length) {
    return NextResponse.json({ error: 'No tokens found' })
  }

  const token = tokens[0]

  // Fetch latest activities from Strava
  const response = await fetch(
    'https://www.strava.com/api/v3/athlete/activities?per_page=5',
    {
      headers: { Authorization: `Bearer ${token.access_token}` },
    }
  )

  const stravaActivities = await response.json()

  // Try to insert first activity
  const activity = stravaActivities[0]
  const insertData = {
    strava_id: activity.id,
    strava_athlete_id: token.athlete_id,
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
    average_heartrate: activity.average_heartrate ? Math.round(activity.average_heartrate) : null,
    max_heartrate: activity.max_heartrate ? Math.round(activity.max_heartrate) : null,
    calories: activity.kilojoules ? Math.round(activity.kilojoules * 0.239) : null,
    suffer_score: activity.suffer_score,
    synced_at: new Date().toISOString(),
  }

  const { data: insertedData, error: insertError } = await supabase
    .from('activities')
    .upsert(insertData, { onConflict: 'strava_id' })
    .select()

  return NextResponse.json({
    strava_activity: {
      id: activity.id,
      name: activity.name,
      date: activity.start_date,
      distance: activity.distance,
    },
    insert_data: insertData,
    insert_result: insertedData,
    insert_error: insertError,
  })
}
