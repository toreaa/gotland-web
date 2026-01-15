import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Hent alle aktiviteter
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("activities").order("desc").collect();
  },
});

// Hent aktiviteter for en dato-range
export const getByDateRange = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const activities = await ctx.db
      .query("activities")
      .withIndex("by_date")
      .filter((q) =>
        q.and(
          q.gte(q.field("date"), args.startDate),
          q.lte(q.field("date"), args.endDate)
        )
      )
      .collect();
    return activities;
  },
});

// Hent basetest-aktiviteter (har "base" i navnet)
export const getBaseTests = query({
  args: {},
  handler: async (ctx) => {
    const activities = await ctx.db.query("activities").collect();
    return activities
      .filter((a) => a.name?.toLowerCase().includes("base"))
      .sort((a, b) => a.date.localeCompare(b.date));
  },
});

// Legg til eller oppdater aktivitet fra Strava
export const upsertFromStrava = mutation({
  args: {
    strava_id: v.number(),
    strava_athlete_id: v.optional(v.number()),
    date: v.string(),
    name: v.optional(v.string()),
    activity_type: v.optional(v.string()),
    sport_type: v.optional(v.string()),
    distance_km: v.optional(v.number()),
    moving_time_seconds: v.optional(v.number()),
    elapsed_time_seconds: v.optional(v.number()),
    elevation_gain: v.optional(v.number()),
    average_speed: v.optional(v.number()),
    max_speed: v.optional(v.number()),
    average_heartrate: v.optional(v.number()),
    max_heartrate: v.optional(v.number()),
    calories: v.optional(v.number()),
    suffer_score: v.optional(v.number()),
    raw_data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Sjekk om aktiviteten allerede finnes
    const existing = await ctx.db
      .query("activities")
      .withIndex("by_strava_id", (q) => q.eq("strava_id", args.strava_id))
      .first();

    const now = new Date().toISOString();

    if (existing) {
      // Oppdater eksisterende
      await ctx.db.patch(existing._id, {
        ...args,
        synced_at: now,
      });
      return existing._id;
    } else {
      // Opprett ny
      return await ctx.db.insert("activities", {
        ...args,
        synced_at: now,
      });
    }
  },
});

// Slett aktivitet
export const remove = mutation({
  args: { id: v.id("activities") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
