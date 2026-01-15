import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Hent alle planlagte økter
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("planned_workouts")
      .withIndex("by_date")
      .collect();
  },
});

// Hent økter for en uke
export const getByWeek = query({
  args: { week_id: v.id("weeks") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("planned_workouts")
      .withIndex("by_week", (q) => q.eq("week_id", args.week_id))
      .collect();
  },
});

// Hent økter for en dato
export const getByDate = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("planned_workouts")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect();
  },
});

// Hent dagens økt
export const getToday = query({
  args: {},
  handler: async (ctx) => {
    const today = new Date().toISOString().split("T")[0];
    return await ctx.db
      .query("planned_workouts")
      .withIndex("by_date", (q) => q.eq("date", today))
      .first();
  },
});

// Opprett planlagt økt
export const create = mutation({
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

// Oppdater planlagt økt
export const update = mutation({
  args: {
    id: v.id("planned_workouts"),
    workout_type: v.optional(v.string()),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    target_km: v.optional(v.number()),
    target_duration_minutes: v.optional(v.number()),
    intensity: v.optional(v.string()),
    is_key_workout: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});
