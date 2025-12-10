import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Server-side client with service role (for API routes)
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Types
export interface Week {
  id: number
  phase_id: number
  week_number: number
  start_date: string
  end_date: string
  target_km: number
  target_elevation: number
  target_hours: number
  notes: string
}

export interface WeeklySummary {
  id: number
  week_id: number
  actual_km: number
  actual_elevation: number
  actual_hours: number
  actual_activities: number
  completion_percentage: number
  km_diff: number
  ai_analysis: string | null
}

export interface Activity {
  id: number
  strava_id: number
  date: string
  name: string
  activity_type: string
  distance_km: number
  moving_time_seconds: number
  elevation_gain: number
}

export interface PlannedWorkout {
  id: number
  date: string
  workout_type: string
  title: string
  description: string
  target_km: number | null
  target_duration_minutes: number | null
  lavs_number: number
  is_key_workout: boolean
}

// Hjelpefunksjoner
export async function getCurrentWeek(): Promise<Week | null> {
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('weeks')
    .select('*')
    .lte('start_date', today)
    .gte('end_date', today)
    .single()
  return data
}

export async function getWeekWithSummary(weekId: number) {
  const { data: week } = await supabase
    .from('weeks')
    .select('*, phases(*)')
    .eq('id', weekId)
    .single()

  const { data: summary } = await supabase
    .from('weekly_summaries')
    .select('*')
    .eq('week_id', weekId)
    .single()

  const { data: workouts } = await supabase
    .from('planned_workouts')
    .select('*')
    .eq('week_id', weekId)
    .order('date')

  const { data: activities } = await supabase
    .from('activities')
    .select('*')
    .gte('date', week?.start_date)
    .lte('date', week?.end_date)
    .order('date')

  return { week, summary, workouts, activities }
}

export async function getAllWeeks() {
  const { data } = await supabase
    .from('weeks')
    .select('*, phases(name), weekly_summaries(*)')
    .order('week_number')
  return data
}

export async function getTrainingProgress() {
  const { data: weeks } = await supabase
    .from('weeks')
    .select('week_number, target_km, start_date, end_date')
    .order('week_number')

  const { data: summaries } = await supabase
    .from('weekly_summaries')
    .select('week_id, actual_km, completion_percentage')

  return { weeks, summaries }
}
