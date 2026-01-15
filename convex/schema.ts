import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Treningsfaser (Base, Build, Peak, Taper)
  phases: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    start_date: v.string(), // ISO date string
    end_date: v.string(),
    weekly_km_target_start: v.optional(v.number()),
    weekly_km_target_end: v.optional(v.number()),
    long_run_target_km: v.optional(v.number()),
    focus_areas: v.optional(v.array(v.string())),
  }),

  // Uker i planen
  weeks: defineTable({
    phase_id: v.id("phases"),
    week_number: v.number(),
    start_date: v.string(),
    end_date: v.string(),
    target_km: v.optional(v.number()),
    target_elevation: v.optional(v.number()),
    target_hours: v.optional(v.number()),
    target_strength_sessions: v.optional(v.number()),
    notes: v.optional(v.string()),
  }).index("by_week_number", ["week_number"])
    .index("by_dates", ["start_date", "end_date"]),

  // Planlagte økter
  planned_workouts: defineTable({
    week_id: v.id("weeks"),
    date: v.string(),
    day_of_week: v.optional(v.number()),
    workout_type: v.string(), // 'run', 'walk', 'strength', 'rest', 'long_run', 'back_to_back'
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    target_km: v.optional(v.number()),
    target_duration_minutes: v.optional(v.number()),
    target_elevation: v.optional(v.number()),
    intensity: v.optional(v.string()), // 'easy', 'moderate', 'hard'
    gotl_number: v.optional(v.number()), // Nedtelling til løpet (tidligere lavs_number)
    is_key_workout: v.optional(v.boolean()),
  }).index("by_date", ["date"])
    .index("by_week", ["week_id"]),

  // Faktiske aktiviteter (fra Strava)
  activities: defineTable({
    strava_id: v.number(),
    strava_athlete_id: v.optional(v.number()),
    date: v.string(),
    name: v.optional(v.string()),
    activity_type: v.optional(v.string()), // 'Run', 'Walk', 'Hike', 'WeightTraining'
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
    description: v.optional(v.string()),
    matched_workout_id: v.optional(v.id("planned_workouts")),
    raw_data: v.optional(v.any()),
    synced_at: v.optional(v.string()),
  }).index("by_strava_id", ["strava_id"])
    .index("by_date", ["date"])
    .index("by_athlete", ["strava_athlete_id"]),

  // Strava tokens
  strava_tokens: defineTable({
    athlete_id: v.number(),
    access_token: v.string(),
    refresh_token: v.string(),
    expires_at: v.number(),
    athlete_data: v.optional(v.any()),
  }).index("by_athlete_id", ["athlete_id"]),

  // Ukentlig sammendrag
  weekly_summaries: defineTable({
    week_id: v.id("weeks"),
    actual_km: v.optional(v.number()),
    actual_elevation: v.optional(v.number()),
    actual_hours: v.optional(v.number()),
    actual_activities: v.optional(v.number()),
    actual_strength_sessions: v.optional(v.number()),
    completion_percentage: v.optional(v.number()),
    completion_rate: v.optional(v.number()),
    km_diff: v.optional(v.number()),
    notes: v.optional(v.string()),
    ai_analysis: v.optional(v.string()),
  }).index("by_week", ["week_id"]),

  // Livsstilslogg
  lifestyle_log: defineTable({
    date: v.string(),
    sleep_hours: v.optional(v.number()),
    sleep_quality: v.optional(v.number()),
    weight_kg: v.optional(v.number()),
    energy_level: v.optional(v.number()),
    soreness_level: v.optional(v.number()),
    stress_level: v.optional(v.number()),
    notes: v.optional(v.string()),
    no_sugar: v.optional(v.boolean()),
  }).index("by_date", ["date"]),

  // AI-analyser
  ai_analyses: defineTable({
    week_id: v.optional(v.id("weeks")),
    analysis_type: v.optional(v.string()),
    ai_model: v.optional(v.string()),
    prompt: v.optional(v.string()),
    response: v.optional(v.string()),
    recommendations: v.optional(v.any()),
  }).index("by_week", ["week_id"]),

  // Mål
  goals: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    target_date: v.optional(v.string()),
    goal_type: v.optional(v.string()),
    target_value: v.optional(v.number()),
    current_value: v.optional(v.number()),
    is_completed: v.optional(v.boolean()),
    completed_at: v.optional(v.string()),
  }),
});
