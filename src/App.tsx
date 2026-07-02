import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { percentSpent, spentHours } from './lib/budget'
import { addAskFromText, readSharedText } from './lib/asks'
import { weatherFor } from './lib/weather'
import { getSettings } from './db'
import { startReminderLoop } from './lib/notify'
import { fmtWhen, fmtHours, fmtUntil } from './lib/format'
import { AddAsk } from './components/AddAsk'
import { DecideSheet } from './components/DecideSheet'
import { SettingsSheet } from './components/SettingsSheet'
import { WeekView } from './components/WeekView'
import { DEFAULT_SETTINGS, type Ask } from './types'
import './App.css'

function App() {
  const asksRaw = useLiveQuery(() => db.asks.toArray(), [])
  const asks = asksRaw ?? ([] as Ask[])
  const storedSettings = useLiveQuery(() => db.settings.get('app'), [])
  const settings = { ...DEFAULT_SETTINGS, ...storedSettings }
  const [view, setView] = useState<'inbox' | 'week'>('inbox')
  const [deciding, setDeciding] = useState<number | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [, forceTick] = useState(0)

  useEffect(() => startReminderLoop(() => forceTick((n) => n + 1)), [])
  // keep the push worker's due-times fresh (no-op unless push is enabled)
  useEffect(() => {
    import('./lib/push').then((m) => m.syncReminders())
  }, [])
  // share-sheet / intake-link asks: ?text=... (share_target) or #add=...
  useEffect(() => {
    const intake = () => {
      const shared = readSharedText()
      if (!shared) return
      window.history.replaceState(null, '', import.meta.env.BASE_URL)
      getSettings().then((s) => addAskFromText(shared, s))
    }
    intake()
    window.addEventListener('hashchange', intake)
    return () => window.removeEventListener('hashchange', intake)
  }, [])
  // refresh countdowns / due states once a minute
  useEffect(() => {
    const id = window.setInterval(() => forceTick((n) => n + 1), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const now = new Date()
  const pct = percentSpent(asks, settings.weeklyBudgetHours, now)
  const spent = spentHours(asks, now)
  const weather = weatherFor(pct)

  // ambient rain follows the forecast
  useEffect(() => {
    document.body.style.setProperty('--rain-opacity', String(weather.rain))
  }, [weather.rain])

  // lightning strikes the moment the budget crosses 100% — but not on app
  // open when already over (baseline is set once data has actually loaded)
  const prevPct = useRef<number | null>(null)
  const [strike, setStrike] = useState(false)
  useEffect(() => {
    if (asksRaw === undefined) return
    if (prevPct.current === null) {
      prevPct.current = pct
      return
    }
    const crossed = prevPct.current < 100 && pct >= 100
    prevPct.current = pct
    if (!crossed) return
    setStrike(true)
    const t = window.setTimeout(() => setStrike(false), 1600)
    return () => window.clearTimeout(t)
  }, [pct, asksRaw])
  const inbox = asks
    .filter((a) => a.status === 'pending' || a.status === 'deferred')
    .sort((x, y) => x.createdAt.localeCompare(y.createdAt))
  const committed = asks
    .filter((a) => a.status === 'committed')
    .sort((x, y) => (x.start ?? '').localeCompare(y.start ?? ''))
  const decidingAsk = deciding === null ? null : asks.find((a) => a.id === deciding) ?? null

  return (
    <main className="shell">
      <header className="masthead">
        <div className="masthead-row">
          <h1 className="wordmark">
            Rain<span className="wordmark-neon">Check</span>
          </h1>
          <button className="gear" type="button" aria-label="Settings" onClick={() => setShowSettings(true)}>
            ⚙
          </button>
        </div>
        <p className="tagline">Pause before you say yes.</p>
      </header>

      <section className="budget" aria-label="Weekly yes-budget">
        <div
          className={`ring ${pct > 100 ? 'ring-over' : ''}`}
          style={{ ['--pct' as string]: Math.min(pct, 100) }}
          role="meter"
          aria-valuenow={Math.min(pct, 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Yes-budget spent"
        >
          <span className="ring-num">{pct}%</span>
        </div>
        <div className="budget-info">
          <span className="budget-label">This week's yes-budget</span>
          <p className="forecast">
            <span className="forecast-emoji">{weather.emoji}</span> {weather.label}
          </p>
          <p className="budget-hint">
            {spent === 0
              ? 'Your week is wide open.'
              : `${fmtHours(spent)} of ${settings.weeklyBudgetHours}h committed`}
          </p>
        </div>
      </section>

      {strike && (
        <div className="lightning" aria-hidden="true">
          ⚡
        </div>
      )}

      <nav className="tabs" aria-label="View">
        <button
          className={`tab ${view === 'inbox' ? 'tab-active' : ''}`}
          type="button"
          onClick={() => setView('inbox')}
        >
          Inbox{inbox.length > 0 && ` · ${inbox.length}`}
        </button>
        <button
          className={`tab ${view === 'week' ? 'tab-active' : ''}`}
          type="button"
          onClick={() => setView('week')}
        >
          Week
        </button>
      </nav>

      {view === 'week' && <WeekView asks={asks} onOpen={setDeciding} />}

      {view === 'inbox' && <AddAsk settings={settings} />}

      {view === 'inbox' && inbox.length > 0 && (
        <section className="list" aria-label="Waiting on you">
          <h2 className="list-title">Waiting on you</h2>
          {inbox.map((ask) => {
            const due = ask.status === 'deferred' && ask.decideBy && new Date(ask.decideBy) <= now
            return (
              <button key={ask.id} className="ask-card" type="button" onClick={() => setDeciding(ask.id!)}>
                <span className="ask-main">
                  <span className="ask-title">{ask.title}</span>
                  <span className="ask-meta">
                    {ask.who && <>w/ {ask.who} · </>}
                    {fmtWhen(ask.start)} · {fmtHours(ask.durationHours)}
                  </span>
                </span>
                {due ? (
                  <span className="status status-due">decide now</span>
                ) : ask.status === 'deferred' ? (
                  <span className="status status-deferred">☁ {fmtUntil(ask.decideBy!)}</span>
                ) : ask.yesLockedUntil && new Date(ask.yesLockedUntil) > now ? (
                  <span className="status status-locked">🔒 {fmtUntil(ask.yesLockedUntil)}</span>
                ) : (
                  <span className="status">new</span>
                )}
              </button>
            )
          })}
        </section>
      )}

      {view === 'inbox' && committed.length > 0 && (
        <section className="list" aria-label="Committed">
          <h2 className="list-title">Committed</h2>
          {committed.map((ask) => (
            <button key={ask.id} className="ask-card ask-committed" type="button" onClick={() => setDeciding(ask.id!)}>
              <span className="ask-main">
                <span className="ask-title">{ask.title}</span>
                <span className="ask-meta">
                  {ask.who && <>w/ {ask.who} · </>}
                  {fmtWhen(ask.start)} · {fmtHours(ask.durationHours)}
                </span>
              </span>
              <span className="status status-yes">yes</span>
            </button>
          ))}
        </section>
      )}

      {view === 'inbox' && inbox.length === 0 && committed.length === 0 && (
        <p className="empty">
          <span className="empty-icon">🌧</span>
          Nothing waiting on you. When someone asks, paste it above and the app takes it from there.
        </p>
      )}

      {view === 'inbox' && <WeekView asks={asks} onOpen={setDeciding} compact />}

      <footer className="phase-note">
        <span className="phase-chip">PHASE 1</span> local-first — everything stays on this device
      </footer>

      {decidingAsk && (
        <DecideSheet ask={decidingAsk} asks={asks} settings={settings} onClose={() => setDeciding(null)} />
      )}
      {showSettings && <SettingsSheet settings={settings} onClose={() => setShowSettings(false)} />}
    </main>
  )
}

export default App
