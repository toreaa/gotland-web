import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Hent sammendrag for en uke
export const getByWeek = query({
  args: { week_id: v.id("weeks") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("weekly_summaries")
      .withIndex("by_week", (q) => q.eq("week_id", args.week_id))
      .first();
  },
});

// Hent alle sammendrag
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("weekly_summaries").collect();
  },
});

// Oppdater sammendrag for en uke
export const updateForWeek = mutation({
  args: { week_id: v.id("weeks") },
  handler: async (ctx, args) => {
    const week = await ctx.db.get(args.week_id);
    if (!week) return null;

    // Hent aktiviteter for denne uken
    const activities = await ctx.db
      .query("activities")
      .filter((q) =>
        q.and(
          q.gte(q.field("date"), week.start_date),
          q.lte(q.field("date"), week.end_date + "T23:59:59")
        )
      )
      .collect();

    if (activities.length === 0) return null;

    // Beregn totaler
    const totals = activities.reduce(
      (acc, act) => ({
        km: acc.km + (act.distance_km || 0),
        elevation: acc.elevation + (act.elevation_gain || 0),
        time: acc.time + (act.moving_time_seconds || 0) / 3600,
        count: acc.count + 1,
      }),
      { km: 0, elevation: 0, time: 0, count: 0 }
    );

    // Sjekk om sammendrag allerede finnes
    const existing = await ctx.db
      .query("weekly_summaries")
      .withIndex("by_week", (q) => q.eq("week_id", args.week_id))
      .first();

    const summaryData = {
      week_id: args.week_id,
      actual_km: Math.round(totals.km * 10) / 10,
      actual_elevation: Math.round(totals.elevation),
      actual_hours: Math.round(totals.time * 10) / 10,
      actual_activities: totals.count,
      completion_percentage: week.target_km
        ? Math.round((totals.km / week.target_km) * 100)
        : undefined,
    };

    if (existing) {
      await ctx.db.patch(existing._id, summaryData);
      return existing._id;
    } else {
      return await ctx.db.insert("weekly_summaries", summaryData);
    }
  },
});

// Oppdater alle ukentlige sammendrag
export const updateAll = mutation({
  args: {},
  handler: async (ctx) => {
    const weeks = await ctx.db.query("weeks").collect();

    for (const week of weeks) {
      // Hent aktiviteter for denne uken
      const activities = await ctx.db
        .query("activities")
        .filter((q) =>
          q.and(
            q.gte(q.field("date"), week.start_date),
            q.lte(q.field("date"), week.end_date + "T23:59:59")
          )
        )
        .collect();

      if (activities.length === 0) continue;

      // Beregn totaler
      const totals = activities.reduce(
        (acc, act) => ({
          km: acc.km + (act.distance_km || 0),
          elevation: acc.elevation + (act.elevation_gain || 0),
          time: acc.time + (act.moving_time_seconds || 0) / 3600,
          count: acc.count + 1,
        }),
        { km: 0, elevation: 0, time: 0, count: 0 }
      );

      // Sjekk om sammendrag allerede finnes
      const existing = await ctx.db
        .query("weekly_summaries")
        .withIndex("by_week", (q) => q.eq("week_id", week._id))
        .first();

      const summaryData = {
        week_id: week._id,
        actual_km: Math.round(totals.km * 10) / 10,
        actual_elevation: Math.round(totals.elevation),
        actual_hours: Math.round(totals.time * 10) / 10,
        actual_activities: totals.count,
        completion_percentage: week.target_km
          ? Math.round((totals.km / week.target_km) * 100)
          : undefined,
      };

      if (existing) {
        await ctx.db.patch(existing._id, summaryData);
      } else {
        await ctx.db.insert("weekly_summaries", summaryData);
      }
    }

    return { updated: weeks.length };
  },
});
