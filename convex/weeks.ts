import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Hent alle uker med fase-info
export const list = query({
  args: {},
  handler: async (ctx) => {
    const weeks = await ctx.db
      .query("weeks")
      .withIndex("by_week_number")
      .collect();

    // Hent faser og summaries
    const phases = await ctx.db.query("phases").collect();
    const summaries = await ctx.db.query("weekly_summaries").collect();

    return weeks.map((week) => ({
      ...week,
      phase: phases.find((p) => p._id === week.phase_id),
      summary: summaries.find((s) => s.week_id === week._id),
    }));
  },
});

// Hent nåværende uke
export const getCurrent = query({
  args: {},
  handler: async (ctx) => {
    const today = new Date().toISOString().split("T")[0];
    const weeks = await ctx.db.query("weeks").collect();

    const currentWeek = weeks.find(
      (w) => w.start_date <= today && w.end_date >= today
    );

    if (!currentWeek) return null;

    const phase = await ctx.db.get(currentWeek.phase_id);
    const summary = await ctx.db
      .query("weekly_summaries")
      .withIndex("by_week", (q) => q.eq("week_id", currentWeek._id))
      .first();

    const workouts = await ctx.db
      .query("planned_workouts")
      .withIndex("by_week", (q) => q.eq("week_id", currentWeek._id))
      .collect();

    const activities = await ctx.db
      .query("activities")
      .filter((q) =>
        q.and(
          q.gte(q.field("date"), currentWeek.start_date),
          q.lte(q.field("date"), currentWeek.end_date)
        )
      )
      .collect();

    return {
      week: currentWeek,
      phase,
      summary,
      workouts: workouts.sort((a, b) => a.date.localeCompare(b.date)),
      activities: activities.sort((a, b) => a.date.localeCompare(b.date)),
    };
  },
});

// Hent en spesifikk uke med alle detaljer
export const getById = query({
  args: { weekId: v.id("weeks") },
  handler: async (ctx, args) => {
    const week = await ctx.db.get(args.weekId);
    if (!week) return null;

    const phase = await ctx.db.get(week.phase_id);
    const summary = await ctx.db
      .query("weekly_summaries")
      .withIndex("by_week", (q) => q.eq("week_id", week._id))
      .first();

    const workouts = await ctx.db
      .query("planned_workouts")
      .withIndex("by_week", (q) => q.eq("week_id", week._id))
      .collect();

    const activities = await ctx.db
      .query("activities")
      .filter((q) =>
        q.and(
          q.gte(q.field("date"), week.start_date),
          q.lte(q.field("date"), week.end_date)
        )
      )
      .collect();

    return {
      week,
      phase,
      summary,
      workouts: workouts.sort((a, b) => a.date.localeCompare(b.date)),
      activities: activities.sort((a, b) => a.date.localeCompare(b.date)),
    };
  },
});

// Hent treningsprogresjon
export const getProgress = query({
  args: {},
  handler: async (ctx) => {
    const weeks = await ctx.db
      .query("weeks")
      .withIndex("by_week_number")
      .collect();

    const summaries = await ctx.db.query("weekly_summaries").collect();

    return weeks.map((week) => ({
      week_number: week.week_number,
      target_km: week.target_km,
      start_date: week.start_date,
      end_date: week.end_date,
      summary: summaries.find((s) => s.week_id === week._id),
    }));
  },
});
