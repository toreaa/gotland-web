'use client'

import { useEffect, useState } from 'react'
import { supabase, getAllWeeks, getCurrentWeek } from '@/lib/supabase'

interface Phase {
  name: string
}

interface WeeklySummary {
  actual_km: number
  completion_percentage: number
  ai_analysis: string | null
}

interface Activity {
  id: number
  strava_id: number
  name: string
  activity_type: string
  sport_type: string
  date: string
  distance_km: number
  moving_time_seconds: number
  elevation_gain: number
  average_heartrate: number | null
}

interface WeekData {
  id: number
  week_number: number
  target_km: number
  target_elevation: number
  start_date: string
  end_date: string
  notes: string
  phases: Phase
  weekly_summaries: WeeklySummary[]
}

export default function Dashboard() {
  const [weeks, setWeeks] = useState<WeekData[]>([])
  const [selectedWeek, setSelectedWeek] = useState<WeekData | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [analysis, setAnalysis] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [daysUntilRace, setDaysUntilRace] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [stravaConnected, setStravaConnected] = useState(false)

  useEffect(() => {
    // Beregn dager til løpet
    const raceDate = new Date('2026-07-04')
    const today = new Date()
    const diff = Math.ceil((raceDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    setDaysUntilRace(diff)

    // Hent data fra Supabase
    fetchWeeks()
    checkStravaConnection()
  }, [])

  // Hent aktiviteter når valgt uke endres
  useEffect(() => {
    if (selectedWeek) {
      fetchActivities(selectedWeek.start_date, selectedWeek.end_date)
    }
  }, [selectedWeek])

  const checkStravaConnection = async () => {
    const { data } = await supabase
      .from('strava_tokens')
      .select('athlete_id')
      .limit(1)
    setStravaConnected(data && data.length > 0)
  }

  const fetchActivities = async (startDate: string, endDate: string) => {
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate + 'T23:59:59')
      .order('date', { ascending: false })

    if (!error && data) {
      setActivities(data)
    }
  }

  const syncStrava = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/cron/sync-strava')
      const data = await res.json()
      if (data.synced > 0 && selectedWeek) {
        fetchActivities(selectedWeek.start_date, selectedWeek.end_date)
        fetchWeeks()
      }
      alert(`Synkronisert ${data.synced} aktiviteter`)
    } catch (err) {
      alert('Kunne ikke synkronisere. Sjekk at Strava er koblet til.')
    }
    setSyncing(false)
  }

  const fetchWeeks = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('weeks')
        .select('*, phases(name), weekly_summaries(*)')
        .order('week_number')

      if (fetchError) throw fetchError

      if (data && data.length > 0) {
        setWeeks(data as WeekData[])

        // Finn nåværende uke basert på dato
        const today = new Date().toISOString().split('T')[0]
        const current = data.find(
          w => w.start_date <= today && w.end_date >= today
        )

        // Hvis vi er før treningsstart, velg uke 1
        if (current) {
          setSelectedWeek(current as WeekData)
        } else {
          setSelectedWeek(data[0] as WeekData)
        }
      }
    } catch (err) {
      console.error('Error fetching weeks:', err)
      setError('Kunne ikke hente data fra Supabase')
    } finally {
      setLoading(false)
    }
  }

  const runAnalysis = async (type: string) => {
    if (!selectedWeek) return

    setAnalyzing(true)
    setAnalysis('')
    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekId: selectedWeek.id,
          analysisType: type,
        }),
      })
      const data = await res.json()

      if (data.error) {
        setAnalysis(`Feil: ${data.error}`)
      } else {
        setAnalysis(data.analysis)
      }
    } catch (error) {
      setAnalysis('Kunne ikke hente analyse. Sjekk at API-nøkler er konfigurert.')
    }
    setAnalyzing(false)
  }

  // Formater tid fra sekunder til lesbar format
  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    if (h > 0) return `${h}t ${m}m`
    return `${m} min`
  }

  // Formater dato
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  // Aktivitetsikon basert på type
  const getActivityIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'run': return '🏃'
      case 'walk': return '🚶'
      case 'hike': return '🥾'
      case 'ride': return '🚴'
      case 'swim': return '🏊'
      case 'workout': return '💪'
      default: return '🏃'
    }
  }

  // Grupper uker etter fase
  const phases = [
    { name: 'Oppstart', weeks: weeks.filter(w => w.week_number <= 6), color: 'bg-blue-600' },
    { name: 'Base', weeks: weeks.filter(w => w.week_number >= 7 && w.week_number <= 12), color: 'bg-green-600' },
    { name: 'Build', weeks: weeks.filter(w => w.week_number >= 13 && w.week_number <= 18), color: 'bg-yellow-600' },
    { name: 'Peak', weeks: weeks.filter(w => w.week_number >= 19 && w.week_number <= 26), color: 'bg-orange-600' },
    { name: 'Taper', weeks: weeks.filter(w => w.week_number >= 27), color: 'bg-rose-600' },
  ]

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">Gotland Rundt 2026</h1>
              <p className="text-slate-400">AI Treningsanalyse</p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold text-rose-500">{daysUntilRace}</div>
              <div className="text-slate-400 text-sm">dager igjen</div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Oversikt */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-slate-800 rounded-xl p-6">
            <h3 className="text-slate-400 text-sm mb-2">LØPET</h3>
            <div className="text-3xl font-bold">511 km</div>
            <p className="text-slate-400">4-14 juli 2026</p>
          </div>

          <div className="bg-slate-800 rounded-xl p-6">
            <h3 className="text-slate-400 text-sm mb-2">MÅL</h3>
            <div className="text-3xl font-bold">80-100 km/dag</div>
            <p className="text-slate-400">5-6 dagers gjennomføring</p>
          </div>

          <div className="bg-slate-800 rounded-xl p-6">
            <h3 className="text-slate-400 text-sm mb-2">STATUS</h3>
            {loading ? (
              <div className="text-slate-400">Laster...</div>
            ) : error ? (
              <div className="text-rose-400 text-sm">{error}</div>
            ) : (
              <>
                <div className="text-3xl font-bold">{weeks.length} uker</div>
                <p className="text-slate-400">lastet fra database</p>
              </>
            )}
          </div>
        </div>

        {/* Ukevelger */}
        {!loading && weeks.length > 0 && (
          <div className="bg-slate-800 rounded-xl p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">Velg uke</h2>
            <div className="flex flex-wrap gap-2">
              {weeks.map((week) => (
                <button
                  key={week.id}
                  onClick={() => setSelectedWeek(week)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedWeek?.id === week.id
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                  }`}
                >
                  Uke {week.week_number}
                </button>
              ))}
            </div>

            {selectedWeek && (
              <div className="mt-4 p-4 bg-slate-900 rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg">
                      Uke {selectedWeek.week_number}: {selectedWeek.phases?.name || 'Ukjent fase'}
                    </h3>
                    <p className="text-slate-400 text-sm">
                      {selectedWeek.start_date} - {selectedWeek.end_date}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-rose-500">{selectedWeek.target_km} km</div>
                    <p className="text-slate-400 text-sm">mål</p>
                  </div>
                </div>
                {selectedWeek.notes && (
                  <p className="mt-2 text-slate-300 text-sm">{selectedWeek.notes}</p>
                )}
                {selectedWeek.weekly_summaries?.[0] && (
                  <div className="mt-3 pt-3 border-t border-slate-700">
                    <div className="flex gap-4 text-sm">
                      <span>Faktisk: <strong>{selectedWeek.weekly_summaries[0].actual_km} km</strong></span>
                      <span>Fullført: <strong>{selectedWeek.weekly_summaries[0].completion_percentage}%</strong></span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* AI Analyse */}
        <div className="bg-slate-800 rounded-xl p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">AI Treningsanalyse</h2>
            <div className="flex gap-2">
              <button
                onClick={() => runAnalysis('weekly_review')}
                disabled={analyzing || !selectedWeek}
                className="bg-rose-600 hover:bg-rose-700 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {analyzing ? 'Analyserer...' : 'Ukesanalyse'}
              </button>
              <button
                onClick={() => runAnalysis('motivation')}
                disabled={analyzing || !selectedWeek}
                className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Motivasjon
              </button>
              <button
                onClick={() => runAnalysis('plan_adjustment')}
                disabled={analyzing || !selectedWeek}
                className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Juster plan
              </button>
            </div>
          </div>

          {analyzing ? (
            <div className="bg-slate-900 rounded-lg p-8 text-center">
              <div className="animate-pulse">
                <div className="flex justify-center mb-4">
                  <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <p className="text-slate-400">Claude analyserer treningsdataene dine...</p>
              </div>
            </div>
          ) : analysis ? (
            <div className="bg-slate-900 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="bg-rose-600 text-xs px-2 py-1 rounded">Claude</span>
                <span className="text-slate-400 text-sm">AI Analyse</span>
              </div>
              <p className="text-slate-200 whitespace-pre-wrap">{analysis}</p>
            </div>
          ) : (
            <div className="bg-slate-900 rounded-lg p-8 text-center text-slate-400">
              {!selectedWeek ? (
                <p>Velg en uke for å kjøre AI-analyse.</p>
              ) : (
                <>
                  <p>Klikk på en av knappene over for å få AI-vurdering av treningen din.</p>
                  <p className="text-sm mt-2">Claude analyserer treningsdata og gir konkrete tilbakemeldinger.</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Treningsplan oversikt */}
        <div className="bg-slate-800 rounded-xl p-6">
          <h2 className="text-xl font-bold mb-6">Treningsfaser</h2>

          <div className="space-y-4">
            {phases.map((phase) => (
              <div key={phase.name} className="flex items-center gap-4">
                <div className={`w-3 h-3 rounded-full ${phase.color}`} />
                <div className="flex-1">
                  <div className="flex justify-between">
                    <span className="font-medium">{phase.name}</span>
                    <span className="text-slate-400 text-sm">
                      {phase.weeks.length > 0
                        ? `Uke ${phase.weeks[0].week_number}-${phase.weeks[phase.weeks.length - 1].week_number}`
                        : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-400">
                    <span>
                      {phase.weeks.length > 0
                        ? `${phase.weeks[0].start_date} - ${phase.weeks[phase.weeks.length - 1].end_date}`
                        : '-'}
                    </span>
                    <span>
                      {phase.weeks.length > 0
                        ? `${phase.weeks[0].target_km}→${phase.weeks[phase.weeks.length - 1].target_km} km/uke`
                        : '-'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Strava Aktiviteter */}
        <div className="mt-8 bg-slate-800 rounded-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Strava Aktiviteter</h2>
            <div className="flex gap-2">
              {stravaConnected ? (
                <button
                  onClick={syncStrava}
                  disabled={syncing}
                  className="bg-orange-600 hover:bg-orange-700 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {syncing ? 'Synkroniserer...' : 'Synk nå'}
                </button>
              ) : (
                <a
                  href="/api/strava"
                  className="bg-orange-600 hover:bg-orange-700 px-4 py-2 rounded-lg text-sm font-medium"
                >
                  Koble til Strava
                </a>
              )}
            </div>
          </div>

          {!stravaConnected ? (
            <div className="bg-slate-900 rounded-lg p-8 text-center">
              <p className="text-slate-400 mb-2">Strava er ikke koblet til.</p>
              <p className="text-slate-500 text-sm">Klikk "Koble til Strava" for å synkronisere aktiviteter automatisk.</p>
            </div>
          ) : activities.length === 0 ? (
            <div className="bg-slate-900 rounded-lg p-8 text-center">
              <p className="text-slate-400">Ingen aktiviteter denne uken.</p>
              <p className="text-slate-500 text-sm mt-2">Aktiviteter fra Strava vil vises her etter synkronisering.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map((activity) => (
                <div key={activity.id} className="bg-slate-900 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex gap-3">
                      <span className="text-2xl">{getActivityIcon(activity.activity_type)}</span>
                      <div>
                        <h3 className="font-medium">{activity.name}</h3>
                        <p className="text-slate-400 text-sm">{formatDate(activity.date)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-orange-500">
                        {activity.distance_km?.toFixed(1)} km
                      </div>
                      <div className="text-slate-400 text-sm">
                        {formatDuration(activity.moving_time_seconds)}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-4 mt-3 text-sm text-slate-400">
                    {activity.elevation_gain > 0 && (
                      <span>↑ {Math.round(activity.elevation_gain)} m</span>
                    )}
                    {activity.average_heartrate && (
                      <span>❤️ {Math.round(activity.average_heartrate)} bpm</span>
                    )}
                    {activity.moving_time_seconds && activity.distance_km > 0 && (
                      <span>
                        Pace: {Math.floor(activity.moving_time_seconds / 60 / activity.distance_km)}:{String(Math.round((activity.moving_time_seconds / 60 / activity.distance_km % 1) * 60)).padStart(2, '0')} /km
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {/* Ukens totaler */}
              {activities.length > 0 && (
                <div className="bg-orange-900/30 rounded-lg p-4 mt-4">
                  <h4 className="font-medium text-orange-400 mb-2">Ukens totaler</h4>
                  <div className="flex gap-6 text-sm">
                    <span>
                      <strong className="text-white">
                        {activities.reduce((sum, a) => sum + (a.distance_km || 0), 0).toFixed(1)} km
                      </strong>
                      <span className="text-slate-400 ml-1">totalt</span>
                    </span>
                    <span>
                      <strong className="text-white">
                        {formatDuration(activities.reduce((sum, a) => sum + (a.moving_time_seconds || 0), 0))}
                      </strong>
                      <span className="text-slate-400 ml-1">tid</span>
                    </span>
                    <span>
                      <strong className="text-white">{activities.length}</strong>
                      <span className="text-slate-400 ml-1">aktiviteter</span>
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
