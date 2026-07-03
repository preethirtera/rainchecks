import type { Tone } from '../types'

/* Reply rules: no dashes of any kind, read like a real text, not a memo.
   The first decline per tone is the suggested pick. */

/** "Blame the calendar" — the one-tap deflection you paste back into the chat. */
export const DEFLECTIONS: Record<Tone, string> = {
  gentle:
    "That sounds so fun! Let me check my calendar when I get home and I'll text you 💜",
  firm: "Let me check my calendar and I'll get back to you tomorrow.",
  snarky:
    'consulting my calendar, it makes all my decisions now. will report back',
}

/** shown when someone tries to back out of a commitment */
export const FLAKE_WARNINGS: Record<Tone, string> = {
  gentle:
    "They're counting on you. If you flake, the hours stay spent anyway. Your week already paid for this.",
  firm: 'You committed. The hours stay on your budget either way. Flake anyway?',
  snarky:
    'Bailing after saying yes? Bold. The budget keeps the hours and your reputation keeps the dent.',
}

/** a no that offers a real alternative, pulled from actual free time */
export function counterOffer(tone: Tone, day: string): string {
  const by: Record<Tone, string> = {
    gentle: `That day doesn't work for me, but I'd love to see you ${day}! 💜`,
    firm: `Can't make it then. ${day} works if you're free.`,
    snarky: `my calendar vetoed that one. it has graciously approved ${day} though`,
  }
  return by[tone]
}

export const DECLINES: Record<Tone, string[]> = {
  gentle: [
    "That sounds so fun! But this week is already packed for me. Can we find another time soon? 💜",
    "Thank you for thinking of me! I'm at capacity right now but I really do want to see you.",
    "I have to sit this one out, I've been so overbooked lately. Rain check?",
  ],
  firm: [
    "I can't make it, my week is already committed.",
    "That doesn't work for me this time. Let's plan something further out.",
    "I already have plans then so I'll have to pass.",
  ],
  snarky: [
    'my calendar said no and honestly I fear it more than I fear disappointing you',
    "I've exceeded my weekly yes quota. the system won't let me.",
    'RainChecks the app has denied this request on my behalf. take it up with the app',
  ],
}
