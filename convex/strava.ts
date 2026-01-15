import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// Types for Strava API responses
interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

interface StravaActivity {
  id: number;
  athlete?: { id: number };
  start_date: string;
  name: string;
  type: string;
  sport_type: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  average_speed: number;
  max_speed: number;
  average_heartrate?: number;
  max_heartrate?: number;
  calories: number;
  suffer_score?: number;
}

// Hent Strava token for en athlete
export const getToken = query({
  args: { athlete_id: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("strava_tokens")
      .withIndex("by_athlete_id", (q) => q.eq("athlete_id", args.athlete_id))
      .first();
  },
});

// Hent første/eneste token (for single-user app)
export const getFirstToken = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("strava_tokens").first();
  },
});

// Lagre eller oppdater Strava token
export const upsertToken = mutation({
  args: {
    athlete_id: v.number(),
    access_token: v.string(),
    refresh_token: v.string(),
    expires_at: v.number(),
    athlete_data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("strava_tokens")
      .withIndex("by_athlete_id", (q) => q.eq("athlete_id", args.athlete_id))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    } else {
      return await ctx.db.insert("strava_tokens", args);
    }
  },
});

// Action for å refreshe Strava token
export const refreshToken = action({
  args: { athlete_id: v.number() },
  handler: async (ctx, args): Promise<string> => {
    // Hent eksisterende token
    const token = await ctx.runQuery(api.strava.getToken, {
      athlete_id: args.athlete_id,
    });

    if (!token) {
      throw new Error("No token found for athlete");
    }

    // Refresh via Strava API
    const response: Response = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: token.refresh_token,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to refresh token");
    }

    const data: StravaTokenResponse = await response.json();

    // Oppdater token i database
    await ctx.runMutation(api.strava.upsertToken, {
      athlete_id: args.athlete_id,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
    });

    return data.access_token;
  },
});

// Hent siste aktivitetsdato for inkrementell sync
export const getLastActivityDate = query({
  args: {},
  handler: async (ctx) => {
    const activities = await ctx.db
      .query("activities")
      .withIndex("by_date")
      .order("desc")
      .first();
    return activities?.date ?? null;
  },
});

// Sjekk om aktivitet allerede finnes
export const activityExists = query({
  args: { strava_id: v.number() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("activities")
      .withIndex("by_strava_id", (q) => q.eq("strava_id", args.strava_id))
      .first();
    return !!existing;
  },
});

// Action for å hente aktiviteter fra Strava (inkrementell sync)
export const syncActivities = action({
  args: {
    athlete_id: v.optional(v.number()),
    force_full_sync: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{ synced: number; skipped: number; total: number }> => {
    // Hent token
    let token;
    if (args.athlete_id) {
      token = await ctx.runQuery(api.strava.getToken, {
        athlete_id: args.athlete_id,
      });
    } else {
      token = await ctx.runQuery(api.strava.getFirstToken, {});
    }

    if (!token) {
      throw new Error("No Strava token found");
    }

    // Sjekk om token er utløpt
    const now = Math.floor(Date.now() / 1000);
    let accessToken: string = token.access_token;

    if (token.expires_at < now) {
      accessToken = await ctx.runAction(api.strava.refreshToken, {
        athlete_id: token.athlete_id,
      });
    }

    // Hent siste aktivitetsdato for inkrementell sync
    let afterTimestamp: number | undefined;
    if (!args.force_full_sync) {
      const lastDate = await ctx.runQuery(api.strava.getLastActivityDate, {});
      if (lastDate) {
        // Trekk fra 1 dag for å være sikker på at vi får med alt
        afterTimestamp = Math.floor(new Date(lastDate).getTime() / 1000) - 86400;
      }
    }

    // Bygg URL med after-parameter hvis vi har det
    let url = "https://www.strava.com/api/v3/athlete/activities?per_page=100";
    if (afterTimestamp) {
      url += `&after=${afterTimestamp}`;
    }

    // Hent aktiviteter fra Strava
    const response: Response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch activities from Strava");
    }

    const activities: StravaActivity[] = await response.json();

    // Lagre kun nye aktiviteter
    let synced = 0;
    let skipped = 0;

    for (const activity of activities) {
      // Sjekk om aktiviteten allerede finnes
      const exists = await ctx.runQuery(api.strava.activityExists, {
        strava_id: activity.id,
      });

      if (exists) {
        skipped++;
        continue;
      }

      // Lagre ny aktivitet
      await ctx.runMutation(api.activities.upsertFromStrava, {
        strava_id: activity.id,
        strava_athlete_id: activity.athlete?.id,
        date: activity.start_date,
        name: activity.name,
        activity_type: activity.type,
        sport_type: activity.sport_type,
        distance_km: activity.distance ? activity.distance / 1000 : undefined,
        moving_time_seconds: activity.moving_time,
        elapsed_time_seconds: activity.elapsed_time,
        elevation_gain: activity.total_elevation_gain,
        average_speed: activity.average_speed,
        max_speed: activity.max_speed,
        average_heartrate: activity.average_heartrate
          ? Math.round(activity.average_heartrate)
          : undefined,
        max_heartrate: activity.max_heartrate
          ? Math.round(activity.max_heartrate)
          : undefined,
        calories: activity.calories,
        suffer_score: activity.suffer_score,
        raw_data: activity,
      });
      synced++;
    }

    return { synced, skipped, total: activities.length };
  },
});
