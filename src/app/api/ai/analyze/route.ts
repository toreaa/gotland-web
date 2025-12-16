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
    const context = buildAnalysisContext(week, summary, workouts || [], activities || [], lifestyle || [])

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
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const weekStart = new Date(week?.start_date)
  const weekEnd = new Date(week?.end_date)

  // Beregn ukens status
  let weekStatus: 'future' | 'current' | 'past'
  let daysIntoWeek = 0
  let daysLeftInWeek = 0

  if (todayStr < week?.start_date) {
    weekStatus = 'future'
    const daysUntilStart = Math.ceil((weekStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    daysLeftInWeek = daysUntilStart
  } else if (todayStr > week?.end_date) {
    weekStatus = 'past'
    daysIntoWeek = 7
  } else {
    weekStatus = 'current'
    daysIntoWeek = Math.ceil((today.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
    daysLeftInWeek = 7 - daysIntoWeek
  }

  const plannedKm = week?.target_km || 0
  const actualKm = summary?.actual_km || 0
  const completionPct = summary?.completion_percentage || 0

  // Tell planlagte økter frem til i dag (ikke fremtidige)
  const workoutsUntilToday = workouts?.filter(w => w.date <= todayStr) || []
  const futureWorkouts = workouts?.filter(w => w.date > todayStr) || []

  const completedWorkouts = workoutsUntilToday.filter(w => {
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
    // Dato-kontekst
    today: todayStr,
    weekStart: week?.start_date,
    weekEnd: week?.end_date,
    weekStatus,
    daysIntoWeek,
    daysLeftInWeek,

    // Uke-info
    weekNumber: week?.week_number,
    phaseName: week?.phases?.name,
    phaseDescription: week?.phases?.description,
    weekNotes: week?.notes,

    // Mål
    plannedKm,
    plannedElevation: week?.target_elevation || 0,
    plannedWorkouts: workouts?.length || 0,
    workoutsUntilToday: workoutsUntilToday.length,
    futureWorkoutsCount: futureWorkouts.length,

    // Faktisk (så langt)
    actualKm,
    kmDiff: actualKm - plannedKm,
    completionPct,
    completedWorkouts,
    actualElevation: summary?.actual_elevation || 0,

    // Livsstil
    avgSleep,
    avgEnergy,

    // Aktiviteter
    activities: activities?.map(a => ({
      date: a.date,
      name: a.name,
      km: a.distance_km,
      elevation: a.elevation_gain,
    })),

    // Planlagte økter denne uken
    plannedWorkoutsList: workouts?.map(w => ({
      date: w.date,
      title: w.title,
      type: w.workout_type,
      targetKm: w.target_km,
      intensity: w.intensity,
      isPast: w.date < todayStr,
      isToday: w.date === todayStr,
      isFuture: w.date > todayStr,
    })),

    // Løpet
    daysUntilRace: Math.ceil((new Date('2026-07-04').getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
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

VIKTIG: Du får informasjon om dagens dato og ukens status (fremtidig, pågående, eller avsluttet).
- Hvis uken er i fremtiden: Gi forberedelsestips og hva løperen bør fokusere på
- Hvis uken er pågående: Vurder fremgang basert på antall dager som har gått
- Hvis uken er avsluttet: Gi full analyse av resultatene

Svar på norsk, vær konkret og praktisk. Ikke vær for snill - gi ærlige tilbakemeldinger.`

  return base
}

function getUserPrompt(type: string, context: any): string {
  // Bygg dato-kontekst streng
  let dateContext = ''
  if (context.weekStatus === 'future') {
    dateContext = `MERK: Denne uken har IKKE startet ennå!
Dagens dato: ${context.today}
Uken starter: ${context.weekStart} (om ${context.daysLeftInWeek} dager)
Det er derfor naturlig at ingen aktiviteter er registrert.`
  } else if (context.weekStatus === 'current') {
    dateContext = `MERK: Denne uken er PÅGÅENDE.
Dagens dato: ${context.today}
Vi er på dag ${context.daysIntoWeek} av 7 i denne uken.
${context.daysLeftInWeek} dager gjenstår av uken.
Vurder kun økter som burde vært gjennomført frem til i dag.`
  } else {
    dateContext = `Denne uken er AVSLUTTET.
Uken var: ${context.weekStart} - ${context.weekEnd}
Full analyse kan gjøres.`
  }

  switch (type) {
    case 'weekly_review':
      return `Analyser uke ${context.weekNumber} (${context.phaseName}-fase):

${dateContext}

OM UKEN:
${context.weekNotes || 'Ingen spesielle notater'}

PLANLAGT FOR HELE UKEN:
- Mål: ${context.plannedKm} km
- Antall økter: ${context.plannedWorkouts}
- Høydemeter: ${context.plannedElevation} m

PLANLAGTE ØKTER:
${context.plannedWorkoutsList?.map((w: any) =>
  `- ${w.date}: ${w.title} (${w.targetKm || '-'} km, ${w.intensity || '-'}) ${w.isPast ? '[PASSERT]' : w.isToday ? '[I DAG]' : '[KOMMER]'}`
).join('\n') || 'Ingen økter planlagt'}

FAKTISK SÅ LANGT:
- Gjennomført: ${context.actualKm?.toFixed(1) || 0} km
- Økter fullført: ${context.completedWorkouts} av ${context.workoutsUntilToday} (som burde vært gjort)
- Høydemeter: ${context.actualElevation || 0} m

REGISTRERTE AKTIVITETER:
${context.activities?.length > 0
  ? context.activities.map((a: any) => `- ${a.date}: ${a.name} (${a.km?.toFixed(1)} km)`).join('\n')
  : 'Ingen aktiviteter registrert ennå'}

LIVSSTIL:
- Gjennomsnittlig søvn: ${context.avgSleep?.toFixed(1) || 'ikke registrert'} timer
- Gjennomsnittlig energinivå: ${context.avgEnergy?.toFixed(1) || 'ikke registrert'}/5

DAGER TIL LØPET: ${context.daysUntilRace}

Gi en kort (3-5 setninger) analyse tilpasset ukens status:
${context.weekStatus === 'future'
  ? '1. Hva bør løperen fokusere på i denne uken?\n2. Hvilke økter er viktigst?\n3. Tips for å komme godt i gang'
  : context.weekStatus === 'current'
  ? '1. Hvordan går det så langt i uken?\n2. Er løperen på rett spor?\n3. Hva bør prioriteres resten av uken?'
  : '1. Hva gikk bra/dårlig?\n2. Er fremgangen på rett spor for målet?\n3. Ett konkret råd for neste uke'}`

    case 'plan_adjustment':
      return `${dateContext}

Basert på data fra uke ${context.weekNumber} (${context.phaseName}):
- Planlagt: ${context.plannedKm} km
- Fullført så langt: ${context.actualKm?.toFixed(1) || 0} km
- Ukens status: ${context.weekStatus === 'future' ? 'Ikke startet' : context.weekStatus === 'current' ? `Dag ${context.daysIntoWeek}/7` : 'Avsluttet'}

${context.weekStatus === 'future'
  ? 'Ser planen realistisk ut for denne uken? Gi tips for hvordan løperen bør tilnærme seg uken.'
  : 'Trenger planen justering? Vurder:\n1. Er ukevolumet realistisk?\n2. Bør lange løp justeres?\n3. Andre anbefalinger?'}

Vær konkret med tall og forslag.`

    case 'motivation':
      return `${dateContext}

Løperen er i uke ${context.weekNumber} av forberedelsene til Gotland Rundt.
${context.daysUntilRace} dager igjen til start.
Fase: ${context.phaseName}

${context.weekStatus === 'future'
  ? `Uken starter om ${context.daysLeftInWeek} dager med mål på ${context.plannedKm} km.`
  : `Fullført ${context.actualKm?.toFixed(0) || 0} km så langt denne uken (mål: ${context.plannedKm} km).`}

Gi en kort, motiverende melding som:
1. ${context.weekStatus === 'future' ? 'Forbereder løperen mentalt på uken som kommer' : 'Anerkjenner innsatsen så langt'}
2. Holder fokus på det store målet
3. Er ærlig men støttende`

    default:
      return `${dateContext}

Gi en generell vurdering av treningsfremgang for uke ${context.weekNumber}.`
  }
}
