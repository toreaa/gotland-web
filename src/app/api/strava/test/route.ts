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

  // Check if expired
  const now = Math.floor(Date.now() / 1000)
  const isExpired = token.expires_at < now

  // Fetch latest activities from Strava
  const response = await fetch(
    'https://www.strava.com/api/v3/athlete/activities?per_page=10',
    {
      headers: { Authorization: `Bearer ${token.access_token}` },
    }
  )

  const stravaData = await response.json()

  return NextResponse.json({
    token_expired: isExpired,
    token_expires_at: new Date(token.expires_at * 1000).toISOString(),
    strava_response_status: response.status,
    strava_activities: stravaData,
  })
}
