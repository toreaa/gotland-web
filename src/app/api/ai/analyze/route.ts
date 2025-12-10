import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request: Request) {
  try {
    const { weekId, analysisType } = await request.json()

    const supabase = createServiceClient()

    // Hent all relevant data
    const { data: week } = await supabase
      .from('weeks')
      .select('*, phases(name, description)')
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

    const { data: lifestyle } = await supabase
      .from('lifestyle_log')
      .select('*')
      .gte('date', week?.start_date)
      .lte('date', week?.end_date)

    // Bygg kontekst for AI
    const context = buildAnalysisContext(week, summary, workouts, activities, lifestyle)

    // Velg prompt basert på analysetype
    const systemPrompt = getSystemPrompt(analysisType)
    const userPrompt = getUserPrompt(analysisType, context)

    // Kall Claude
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ],
    })

    const analysis = message.content[0].type === 'text'
      ? message.content[0].text
      : ''

    // Lagre analysen
    await supabase
      .from('ai_analyses')
      .insert({
        week_id: weekId,
        analysis_type: analysisType,
        ai_model: 'claude-sonnet-4-20250514',
        prompt: userPrompt,
        response: analysis,
      })

    // Oppdater weekly_summaries med AI-analyse
    if (summary) {
      await supabase
        .from('weekly_summaries')
        .update({ ai_analysis: analysis })
        .eq('id', summary.id)
    }

    return NextResponse.json({ analysis, model: 'claude' })

  } catch (error) {
    console.error('AI Analysis error:', error)
    return NextResponse.json(
      { error: 'Kunne ikke generere analyse' },
      { status: 500 }
    )
  }
}

function buildAnalysisContext(
  week: any,
  summary: any,
  workouts: any[],
  activities: any[],
  lifestyle: any[]
) {
  const plannedKm = week?.target_km || 0
  const actualKm = summary?.actual_km || 0
  const completionPct = summary?.completion_percentage || 0

  const completedWorkouts = workouts?.filter(w => {
    const activity = activities?.find(a =>
      a.date.split('T')[0] === w.date
    )
    return !!activity
  }).length || 0

  const avgSleep = lifestyle?.length > 0
    ? lifestyle.reduce((sum, l) => sum + (l.sleep_hours || 0), 0) / lifestyle.length
    : null

  const avgEnergy = lifestyle?.length > 0
    ? lifestyle.reduce((sum, l) => sum + (l.energy_level || 0), 0) / lifestyle.length
    : null

  return {
    weekNumber: week?.week_number,
    phaseName: week?.phases?.name,
    phaseDescription: week?.phases?.description,
    plannedKm,
    actualKm,
    kmDiff: actualKm - plannedKm,
    completionPct,
    plannedWorkouts: workouts?.length || 0,
    completedWorkouts,
    plannedElevation: week?.target_elevation || 0,
    actualElevation: summary?.actual_elevation || 0,
    avgSleep,
    avgEnergy,
    activities: activities?.map(a => ({
      date: a.date,
      name: a.name,
      km: a.distance_km,
      elevation: a.elevation_gain,
    })),
    daysUntilRace: Math.ceil((new Date('2026-07-04').getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)),
  }
}

function getSystemPrompt(type: string): string {
  const base = `Du er en erfaren ultraløpstrener som hjelper en 51 år gammel løper med å forberede seg til Gotland Rundt 2026 - et 511 km etappeløp over 10 dager i juli. Målet er 80-100 km per dag.

Løperen har tidligere gjennomført Vol State 500k (579 km på 6.7 dager) i august 2024, så du vet at de har kapasiteten.

Viktige hensyn:
- Alder 51: Lengre restitusjon, styrketrening viktig
- Må bygge opp fra null (har hatt pause)
- Livsstil: Kutter brus, fokus på søvn og kosthold
- Gåing er en viktig del av treningen

Svar på norsk, vær konkret og praktisk. Ikke vær for snill - gi ærlige tilbakemeldinger.`

  return base
}

function getUserPrompt(type: string, context: any): string {
  switch (type) {
    case 'weekly_review':
      return `Analyser uke ${context.weekNumber} (${context.phaseName}-fase):

PLANLAGT:
- Mål: ${context.plannedKm} km
- Økter: ${context.plannedWorkouts}
- Høydemeter: ${context.plannedElevation} m

FAKTISK:
- Gjennomført: ${context.actualKm?.toFixed(1)} km (${context.completionPct?.toFixed(0)}%)
- Økter: ${context.completedWorkouts}
- Høydemeter: ${context.actualElevation} m
- Differanse: ${context.kmDiff > 0 ? '+' : ''}${context.kmDiff?.toFixed(1)} km

LIVSSTIL:
- Gjennomsnittlig søvn: ${context.avgSleep?.toFixed(1) || 'ikke registrert'} timer
- Gjennomsnittlig energinivå: ${context.avgEnergy?.toFixed(1) || 'ikke registrert'}/5

DAGER TIL LØPET: ${context.daysUntilRace}

Gi en kort (3-5 setninger) analyse:
1. Hva gikk bra/dårlig?
2. Er fremgangen på rett spor for målet?
3. Ett konkret råd for neste uke`

    case 'plan_adjustment':
      return `Basert på data fra uke ${context.weekNumber}:
- Fullføringsgrad: ${context.completionPct?.toFixed(0)}%
- Trend siste uker: (data kommer)

Trenger planen justering? Vurder:
1. Er ukevolumet realistisk?
2. Bør lange løp justeres?
3. Andre anbefalinger?

Vær konkret med tall og forslag.`

    case 'motivation':
      return `Løperen er i uke ${context.weekNumber} av forberedelsene til Gotland Rundt.
${context.daysUntilRace} dager igjen til start.

Fullført ${context.actualKm?.toFixed(0)} km denne uken (mål: ${context.plannedKm} km).

Gi en kort, motiverende melding som:
1. Anerkjenner innsatsen
2. Holder fokus på det store målet
3. Er ærlig men støttende`

    default:
      return `Gi en generell vurdering av treningsfremgang for uke ${context.weekNumber}.`
  }
}
