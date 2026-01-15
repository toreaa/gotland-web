import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Import phases
export const importPhase = mutation({
  args: {
    old_id: v.number(),
    name: v.string(),
    description: v.optional(v.string()),
    start_date: v.string(),
    end_date: v.string(),
    weekly_km_target_start: v.optional(v.number()),
    weekly_km_target_end: v.optional(v.number()),
    long_run_target_km: v.optional(v.number()),
    focus_areas: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { old_id, ...data } = args;
    const newId = await ctx.db.insert("phases", data);
    return { old_id, new_id: newId };
  },
});

// Import week med phase_id mapping
export const importWeek = mutation({
  args: {
    old_id: v.number(),
    phase_id: v.id("phases"),
    week_number: v.number(),
    start_date: v.string(),
    end_date: v.string(),
    target_km: v.optional(v.number()),
    target_elevation: v.optional(v.number()),
    target_hours: v.optional(v.number()),
    target_strength_sessions: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { old_id, ...data } = args;
    const newId = await ctx.db.insert("weeks", data);
    return { old_id, new_id: newId };
  },
});

// Import planned workout med week_id mapping
export const importWorkout = mutation({
  args: {
    week_id: v.id("weeks"),
    date: v.string(),
    day_of_week: v.optional(v.number()),
    workout_type: v.string(),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    target_km: v.optional(v.number()),
    target_duration_minutes: v.optional(v.number()),
    target_elevation: v.optional(v.number()),
    intensity: v.optional(v.string()),
    gotl_number: v.optional(v.number()),
    is_key_workout: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("planned_workouts", args);
  },
});

// Import activity
export const importActivity = mutation({
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
    synced_at: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("activities", args);
  },
});

// Import strava token
export const importStravaToken = mutation({
  args: {
    athlete_id: v.number(),
    access_token: v.string(),
    refresh_token: v.string(),
    expires_at: v.number(),
    athlete_data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("strava_tokens", args);
  },
});
