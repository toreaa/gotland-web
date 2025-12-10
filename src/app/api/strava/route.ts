import { NextResponse } from 'next/server'

// Start Strava OAuth flow
export async function GET() {
  const clientId = process.env.STRAVA_CLIENT_ID
  const redirectUri = process.env.NEXT_PUBLIC_URL
    ? `${process.env.NEXT_PUBLIC_URL}/api/strava/callback`
    : 'http://localhost:3000/api/strava/callback'

  if (!clientId) {
    return NextResponse.json(
      { error: 'STRAVA_CLIENT_ID not configured' },
      { status: 500 }
    )
  }

  const scope = 'read,activity:read_all'
  const stravaAuthUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}`

  return NextResponse.redirect(stravaAuthUrl)
}
