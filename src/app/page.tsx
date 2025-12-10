'use client'

import { useEffect, useState } from 'react'

interface WeekData {
  week_number: number
  target_km: number
  start_date: string
  end_date: string
  phases: { name: string }
  weekly_summaries: Array<{
    actual_km: number
    completion_percentage: number
    ai_analysis: string | null
  }>
}

export default function Dashboard() {
  const [weeks, setWeeks] = useState<WeekData[]>([])
  const [currentWeek, setCurrentWeek] = useState<WeekData | null>(null)
  const [analysis, setAnalysis] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [daysUntilRace, setDaysUntilRace] = useState(0)

  useEffect(() => {
    // Beregn dager til løpet
    const raceDate = new Date('2026-07-04')
    const today = new Date()
    const diff = Math.ceil((raceDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    setDaysUntilRace(diff)

    // For demo - vis placeholder data
    setLoading(false)
  }, [])

  const runAnalysis = async (type: string) => {
    if (!currentWeek) return

    setAnalyzing(true)
    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekId: currentWeek.week_number,
          analysisType: type,
        }),
      })
      const data = await res.json()
      setAnalysis(data.analysis)
    } catch (error) {
      setAnalysis('Kunne ikke hente analyse. Sjekk at API-nøkler er konfigurert.')
    }
    setAnalyzing(false)
  }

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
            <h3 className="text-slate-400 text-sm mb-2">TRENINGSSTART</h3>
            <div className="text-3xl font-bold">15. des</div>
            <p className="text-slate-400">29 ukers program</p>
          </div>
        </div>

        {/* AI Analyse */}
        <div className="bg-slate-800 rounded-xl p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">AI Treningsanalyse</h2>
            <div className="flex gap-2">
              <button
                onClick={() => runAnalysis('weekly_review')}
                disabled={analyzing}
                className="bg-rose-600 hover:bg-rose-700 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {analyzing ? 'Analyserer...' : 'Ukesanalyse'}
              </button>
              <button
                onClick={() => runAnalysis('motivation')}
                disabled={analyzing}
                className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                Motivasjon
              </button>
              <button
                onClick={() => runAnalysis('plan_adjustment')}
                disabled={analyzing}
                className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                Juster plan
              </button>
            </div>
          </div>

          {analysis ? (
            <div className="bg-slate-900 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="bg-rose-600 text-xs px-2 py-1 rounded">Claude</span>
                <span className="text-slate-400 text-sm">AI Analyse</span>
              </div>
              <p className="text-slate-200 whitespace-pre-wrap">{analysis}</p>
            </div>
          ) : (
            <div className="bg-slate-900 rounded-lg p-8 text-center text-slate-400">
              <p>Koble til Supabase og kjør en analyse for å se AI-vurdering av treningen din.</p>
              <p className="text-sm mt-2">Claude analyserer treningsdata og gir konkrete tilbakemeldinger.</p>
            </div>
          )}
        </div>

        {/* Treningsplan oversikt */}
        <div className="bg-slate-800 rounded-xl p-6">
          <h2 className="text-xl font-bold mb-6">Treningsfaser</h2>

          <div className="space-y-4">
            {[
              { name: 'Oppstart', weeks: '1-6', dates: '15.12 - 25.01', km: '15→35', color: 'bg-blue-600' },
              { name: 'Base', weeks: '7-12', dates: '26.01 - 08.03', km: '35→50', color: 'bg-green-600' },
              { name: 'Build', weeks: '13-18', dates: '09.03 - 19.04', km: '50→70', color: 'bg-yellow-600' },
              { name: 'Peak', weeks: '19-24', dates: '20.04 - 31.05', km: '70→85', color: 'bg-orange-600' },
              { name: 'Taper', weeks: '25-29', dates: '01.06 - 03.07', km: '85→40', color: 'bg-rose-600' },
            ].map((phase) => (
              <div key={phase.name} className="flex items-center gap-4">
                <div className={`w-3 h-3 rounded-full ${phase.color}`} />
                <div className="flex-1">
                  <div className="flex justify-between">
                    <span className="font-medium">{phase.name}</span>
                    <span className="text-slate-400 text-sm">Uke {phase.weeks}</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-400">
                    <span>{phase.dates}</span>
                    <span>{phase.km} km/uke</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-8 text-center text-slate-500 text-sm">
          <p>Koble til Supabase for å se live treningsdata fra Strava</p>
          <p className="mt-1">
            Konfigurer miljøvariabler i <code className="bg-slate-800 px-2 py-1 rounded">.env.local</code>
          </p>
        </div>
      </main>
    </div>
  )
}
