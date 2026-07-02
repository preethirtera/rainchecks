import { useMemo, useState } from 'react'
import { parseAsk } from '../lib/parse'
import { addAskFromText } from '../lib/asks'
import { fmtWhen, fmtHours, SIZE_LABELS } from '../lib/format'
import type { Settings } from '../types'

export function AddAsk({ settings }: { settings: Settings }) {
  const [text, setText] = useState('')
  const parsed = useMemo(() => (text.trim().length > 2 ? parseAsk(text) : null), [text])

  async function add() {
    if (!parsed) return
    await addAskFromText(text, settings)
    setText('')
  }

  return (
    <section className="add" aria-label="Add an ask">
      <textarea
        className="add-input"
        rows={2}
        placeholder='Paste the ask — "dinner thurs 7 w/ maya"'
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            add()
          }
        }}
      />
      {parsed && (
        <div className="parse-preview">
          <span className="chip chip-title">{parsed.title}</span>
          {parsed.who && <span className="chip">w/ {parsed.who}</span>}
          <span className={parsed.start ? 'chip chip-time' : 'chip chip-dim'}>
            {fmtWhen(parsed.start ? parsed.start.toISOString() : null)}
          </span>
          <span className="chip">{fmtHours(parsed.durationHours)}</span>
          <span className="chip chip-dim">{SIZE_LABELS[parsed.size]}</span>
          {(parsed.size === 'fullday' || parsed.size === 'multiday') && (
            <span className="chip chip-lock">24-hour rule applies</span>
          )}
        </div>
      )}
      <button className="add-ask" type="button" disabled={!parsed} onClick={add}>
        + Into the inbox
      </button>
    </section>
  )
}
