import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../../../convex/_generated/api'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(error)}`, request.url)
    )
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/?error=no_code', request.url)
    )
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('Strava token error:', errorData)
      return NextResponse.redirect(
        new URL('/?error=token_exchange_failed', request.url)
      )
    }

    const tokenData = await tokenResponse.json()

    // Store tokens in Convex
    await convex.mutation(api.strava.upsertToken, {
      athlete_id: tokenData.athlete.id,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: tokenData.expires_at,
      athlete_data: tokenData.athlete,
    })

    // Redirect to success page
    return NextResponse.redirect(
      new URL(`/?success=strava_connected&athlete=${tokenData.athlete.firstname}`, request.url)
    )

  } catch (error) {
    console.error('Callback error:', error)
    return NextResponse.redirect(
      new URL('/?error=unknown_error', request.url)
    )
  }
}
