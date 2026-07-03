export type AskSize = 'small' | 'evening' | 'fullday' | 'multiday'

export type AskStatus = 'pending' | 'deferred' | 'committed' | 'declined' | 'flaked'

export type AskKind = 'ask' | 'alone'

export interface Ask {
  id?: number
  /** 'alone' = protected alone time, treated exactly like a real plan */
  kind: AskKind
  rawText: string
  title: string
  who: string | null
  /** ISO datetime of when the plan starts; null if no time was found */
  start: string | null
  durationHours: number
  size: AskSize
  status: AskStatus
  createdAt: string
  /** when a deferred ask should nudge you to decide */
  decideBy: string | null
  /** 24-hour rule: Yes is disabled until this passes (big asks only) */
  yesLockedUntil: string | null
  decidedAt: string | null
  /** weekly reflection: marked when a yes turned out to be a mistake */
  regretted?: boolean
}

export type Tone = 'gentle' | 'firm' | 'snarky'

export interface Settings {
  id: 'app'
  weeklyBudgetHours: number
  tone: Tone
  /** cooling-off window for the 24-hour rule, in hours */
  coolingOffHours: number
  quietStartHour: number
  quietEndHour: number
  /** declines written in the user's own words; shown first when saying no */
  customDeclines: string[]
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'app',
  weeklyBudgetHours: 10,
  tone: 'gentle',
  coolingOffHours: 24,
  quietStartHour: 22,
  quietEndHour: 8,
  customDeclines: [],
}
