// Script for å importere data til Convex
// Kjør med: node scripts/import-to-convex.mjs

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  console.error("Mangler NEXT_PUBLIC_CONVEX_URL i .env.local");
  process.exit(1);
}

const client = new ConvexHttpClient(convexUrl);

// Les JSONL-fil
function readJsonl(filename) {
  const path = join(__dirname, "data", filename);
  if (!existsSync(path)) {
    console.log(`  Fil ikke funnet: ${filename}`);
    return [];
  }
  const content = readFileSync(path, "utf-8");
  return content.split("\n").filter(Boolean).map(JSON.parse);
}

async function main() {
  console.log("=== Importerer data til Convex ===\n");

  // ID mappings
  const phaseMapping = new Map(); // old_id -> new_convex_id
  const weekMapping = new Map();

  // 1. Import phases
  console.log("Importerer phases...");
  const phases = readJsonl("phases.jsonl");
  for (const phase of phases) {
    const result = await client.mutation(api.import.importPhase, {
      old_id: phase.id,
      name: phase.name,
      description: phase.description || undefined,
      start_date: phase.start_date,
      end_date: phase.end_date,
      weekly_km_target_start: phase.weekly_km_target_start || undefined,
      weekly_km_target_end: phase.weekly_km_target_end || undefined,
      long_run_target_km: phase.long_run_target_km || undefined,
      focus_areas: phase.focus_areas || undefined,
    });
    phaseMapping.set(result.old_id, result.new_id);
  }
  console.log(`  -> ${phases.length} phases importert`);

  // 2. Import weeks
  console.log("Importerer weeks...");
  const weeks = readJsonl("weeks.jsonl");
  for (const week of weeks) {
    const newPhaseId = phaseMapping.get(week.phase_id);
    if (!newPhaseId) {
      console.error(`  Fant ikke phase_id ${week.phase_id} for week ${week.id}`);
      continue;
    }
    const result = await client.mutation(api.import.importWeek, {
      old_id: week.id,
      phase_id: newPhaseId,
      week_number: week.week_number,
      start_date: week.start_date,
      end_date: week.end_date,
      target_km: week.target_km || undefined,
      target_elevation: week.target_elevation || undefined,
      target_hours: week.target_hours || undefined,
      target_strength_sessions: week.target_strength_sessions || undefined,
      notes: week.notes || undefined,
    });
    weekMapping.set(result.old_id, result.new_id);
  }
  console.log(`  -> ${weeks.length} weeks importert`);

  // 3. Import planned workouts
  console.log("Importerer planned_workouts...");
  const workouts = readJsonl("planned_workouts.jsonl");
  let workoutCount = 0;
  for (const workout of workouts) {
    const newWeekId = weekMapping.get(workout.week_id);
    if (!newWeekId) {
      console.error(`  Fant ikke week_id ${workout.week_id} for workout ${workout.id}`);
      continue;
    }
    await client.mutation(api.import.importWorkout, {
      week_id: newWeekId,
      date: workout.date,
      day_of_week: workout.day_of_week || undefined,
      workout_type: workout.workout_type,
      title: workout.title || undefined,
      description: workout.description || undefined,
      target_km: workout.target_km || undefined,
      target_duration_minutes: workout.target_duration_minutes || undefined,
      target_elevation: workout.target_elevation || undefined,
      intensity: workout.intensity || undefined,
      gotl_number: workout.lavs_number || workout.gotl_number || undefined,
      is_key_workout: workout.is_key_workout || undefined,
    });
    workoutCount++;
  }
  console.log(`  -> ${workoutCount} workouts importert`);

  // 4. Import activities
  console.log("Importerer activities...");
  const activities = readJsonl("activities.jsonl");
  let activityCount = 0;
  for (const activity of activities) {
    await client.mutation(api.import.importActivity, {
      strava_id: activity.strava_id,
      strava_athlete_id: activity.strava_athlete_id || undefined,
      date: activity.date,
      name: activity.name || undefined,
      activity_type: activity.activity_type || undefined,
      sport_type: activity.sport_type || undefined,
      distance_km: activity.distance_km || undefined,
      moving_time_seconds: activity.moving_time_seconds || undefined,
      elapsed_time_seconds: activity.elapsed_time_seconds || undefined,
      elevation_gain: activity.elevation_gain || undefined,
      average_speed: activity.average_speed ? parseFloat(activity.average_speed) : undefined,
      max_speed: activity.max_speed ? parseFloat(activity.max_speed) : undefined,
      average_heartrate: activity.average_heartrate || undefined,
      max_heartrate: activity.max_heartrate || undefined,
      calories: activity.calories || undefined,
      suffer_score: activity.suffer_score || undefined,
      raw_data: activity.raw_data || undefined,
      synced_at: activity.synced_at || undefined,
    });
    activityCount++;
  }
  console.log(`  -> ${activityCount} activities importert`);

  // 5. Import strava tokens
  console.log("Importerer strava_tokens...");
  const tokens = readJsonl("strava_tokens.jsonl");
  for (const token of tokens) {
    await client.mutation(api.import.importStravaToken, {
      athlete_id: token.athlete_id,
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_at: token.expires_at,
      athlete_data: token.athlete_data || undefined,
    });
  }
  console.log(`  -> ${tokens.length} tokens importert`);

  console.log("\n=== Import fullført! ===");
  console.log("Sjekk Convex dashboard: https://dashboard.convex.dev");
}

main().catch(console.error);
