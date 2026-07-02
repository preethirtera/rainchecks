import { useRef } from 'react'
import { db, saveSettings, exportJSON, importJSON } from '../db'
import { parseICS } from '../lib/ics'
import type { Settings, Tone } from '../types'

export function SettingsSheet({ settings, onClose }: { settings: Settings; onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const icsRef = useRef<HTMLInputElement>(null)

  async function onImportICS(file: File) {
    const events = parseICS(await file.text())
    if (events.length === 0) {
      alert('No events found in that file.')
      return
    }
    const now = new Date().toISOString()
    await db.asks.bulkAdd(
      events.map((e) => ({
        kind: 'ask' as const,
        rawText: e.title,
        title: e.title,
        who: null,
        start: e.start.toISOString(),
        durationHours: e.durationHours,
        size: e.durationHours >= 5 ? ('fullday' as const) : ('evening' as const),
        status: 'pending' as const,
        createdAt: now,
        decideBy: null,
        yesLockedUntil: null,
        decidedAt: null,
      })),
    )
    alert(`Added ${events.length} invite${events.length > 1 ? 's' : ''} to your inbox. They still need your yes.`)
  }

  async function download() {
    const blob = new Blob([await exportJSON()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `raincheck-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function onImport(file: File) {
    try {
      const count = await importJSON(await file.text())
      alert(`Restored ${count} asks from backup.`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Import failed')
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="Settings" onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <h2 className="sheet-title">Settings</h2>
          <p className="sheet-sub">Everything lives on this device. No account, no cloud.</p>
        </header>

        <div className="settings-grid">
          <label className="setting">
            <span>Weekly yes-budget</span>
            <span className="setting-value">{settings.weeklyBudgetHours}h</span>
            <input
              type="range"
              min={2}
              max={30}
              step={1}
              value={settings.weeklyBudgetHours}
              onChange={(e) => saveSettings({ weeklyBudgetHours: Number(e.target.value) })}
            />
          </label>

          <label className="setting">
            <span>Nudge tone</span>
            <select
              value={settings.tone}
              onChange={(e) => saveSettings({ tone: e.target.value as Tone })}
            >
              <option value="gentle">Gentle</option>
              <option value="firm">Firm</option>
              <option value="snarky">Snarky</option>
            </select>
          </label>

          <label className="setting">
            <span>24-hour rule cooling-off</span>
            <select
              value={settings.coolingOffHours}
              onChange={(e) => saveSettings({ coolingOffHours: Number(e.target.value) })}
            >
              <option value={12}>12 hours</option>
              <option value={24}>24 hours</option>
              <option value={48}>48 hours</option>
            </select>
          </label>

          <label className="setting setting-wide">
            <span>Your own declines, in your words (one per line, shown first)</span>
            <textarea
              className="add-input"
              rows={3}
              placeholder={'sorry can’t do that day!! next week?\nnooo I have a thing that night 😭'}
              defaultValue={settings.customDeclines.join('\n')}
              onChange={(e) =>
                saveSettings({
                  customDeclines: e.target.value
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </label>

          <label className="setting">
            <span>Quiet hours</span>
            <span className="setting-row">
              <select
                value={settings.quietStartHour}
                onChange={(e) => saveSettings({ quietStartHour: Number(e.target.value) })}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>{`${h}:00`}</option>
                ))}
              </select>
              →
              <select
                value={settings.quietEndHour}
                onChange={(e) => saveSettings({ quietEndHour: Number(e.target.value) })}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>{`${h}:00`}</option>
                ))}
              </select>
            </span>
          </label>
        </div>

        <div className="intake-note">
          <strong>Get asks in without typing:</strong> on Android, share any message to
          RainCheck from the share sheet. On iPhone, make a Shortcut that opens{' '}
          <code>…/raincheck/#add=</code> plus the selected text. Slack, Teams and email
          forwarding arrive with the Phase&nbsp;3 backend.
        </div>

        <div className="sheet-actions">
          <button className="btn" type="button" onClick={() => icsRef.current?.click()}>
            Import calendar invites (.ics)
          </button>
          <input
            ref={icsRef}
            type="file"
            accept=".ics,text/calendar"
            hidden
            onChange={(e) => e.target.files?.[0] && onImportICS(e.target.files[0])}
          />
          <button className="btn" type="button" onClick={download}>
            Export backup (JSON)
          </button>
          <button className="btn" type="button" onClick={() => fileRef.current?.click()}>
            Import backup
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])}
          />
          <button className="btn btn-quiet" type="button" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
