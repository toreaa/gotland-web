import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Hent alle faser
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("phases").collect();
  },
});

// Hent fase med ID
export const getById = query({
  args: { id: v.id("phases") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Hent nåværende fase
export const getCurrent = query({
  args: {},
  handler: async (ctx) => {
    const today = new Date().toISOString().split("T")[0];
    const phases = await ctx.db.query("phases").collect();

    return phases.find(
      (p) => p.start_date <= today && p.end_date >= today
    ) || null;
  },
});

// Opprett fase
export const create = mutation({
  args: {
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
    return await ctx.db.insert("phases", args);
  },
});
