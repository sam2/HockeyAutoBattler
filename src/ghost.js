// Ghost opponents: the team a player drops the puck with goes to a shared pool, and other players on the same day get
// it as their opponent, matched on wins and patience the way Super Auto Pets matches on turn, trophies and lives.
// The pool is a Firebase Realtime Database reached with plain fetch: no SDK, no login. Anything that fails, times out or
// comes back odd means a bot, silently, so the game plays exactly as it did before the pool existed.
import { SLOTS, rand } from './sim.js'
import { CARDS, PACK } from './cards.js'
import { COACHES } from './coaches.js'
import { GEAR } from './gear.js'
import { ITEMS } from './items.js'
import { EVENTS } from './events.js'
import { myTeam, botTeam } from './run.js'

export const DB = 'https://hockeyautobattler-default-rtdb.firebaseio.com' // the database URL from the Firebase console; blank plays bots
// Each pack keeps its own pool, run log and shop log, so a run only ever meets teams of its own pack: pack one's stay
// under v1, where they always were, and pack n's go under pn.
export const FOLDER = PACK === '1' ? 'v1' : 'p' + PACK
// Read the newest POOL records of the day, keep the NEAREST by record, pick one; fewer than MIN_GHOSTS valid ghosts is a bot.
// A ghost ahead on wins counts AHEAD further away, so a run reaches down before it reaches up (Batomon casual matches at or
// below your rating first).
const POOL = 100, NEAREST = 5, MIN_GHOSTS = 3, TIMEOUT = 3000, AHEAD = 20
// ponytail: no auth and no prune. Anyone with the URL can add a create-only record; firebase.rules.json caps its shape and
// size and parse() drops anything the game can't field. Anonymous sign-in with per-user slots is the upgrade when junk
// shows up; deleting old day nodes by hand is the prune.

// The team as myTeam reads it: dressed slots only, no prices. cups marks the dressed cards in the player's Hall of Fame,
// 2 for one won as a Star, so the other side sees the same cup on them.
export const team = (run, hall = {}) => {
  const dressed = SLOTS.filter(s => run.lineup[s]), cups = Object.fromEntries(dressed.map(s => run.lineup[s].id).filter(id => hall[id]).map(id => [id, hall[id][1] ? 2 : 1]))
  return {
    coach: run.coach,
    lineup: Object.fromEntries(dressed.map(s => { const { id, level, perm } = run.lineup[s]; return [s, perm ? { id, level, perm } : { id, level }] })),
    gear: run.gear, encore: run.encore, levelUps: run.levelUps, ...(Object.keys(cups).length ? { cups } : {}),
  }
}
// The balance version: a hash of every card, coach, gear piece, item and event as written, numbers and code, so the lab
// can tell the records played on today's numbers from older ones.
const fnv = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0).toString(36) }
export const VERSION = fnv(JSON.stringify([CARDS, COACHES, GEAR, ITEMS, EVENTS], (k, v) => (typeof v === 'function' ? String(v) : v)))

// The previous game: its result and who it was against (the UI notes that on run.last).
const last = run => ({ won: run.last.won, gf: run.last.score[0], ga: run.last.score[1], ot: !!run.last.ot, vs: run.last.vs ?? 'bot' })
// What goes to the day's pool at puck drop. t is the server's clock. uid is there only from a signed-in player (the rules
// check it is theirs), so the game can look up the name they show without a ghost ever carrying it.
export const record = (run, pid, uid, hall) => ({ pid, v: VERSION, day: run.day, wins: run.wins, patience: run.patience, t: { '.sv': 'timestamp' }, team: JSON.stringify(team(run, hall)), ...(run.last ? { last: last(run) } : {}), ...(uid ? { uid } : {}) })
// What goes to the run log when a run ends: the final day's team, the result and what was bought along the way.
export const ending = (run, pid) => ({ ...record(run, pid), coach: run.coach, won: run.won, vote: run.voteUsed, items: run.bought.join(',') })
// The day's shop for the lab, at puck drop: the run as the shop opened and what the player did in it (see run.js open).
export const shop = (run, pid) => ({ pid, v: VERSION, day: run.day, t: { '.sv': 'timestamp' }, open: run.open, acts: JSON.stringify(run.acts) })

const small = n => Number.isInteger(n) && n >= 0 && n < 100
// A player name as the plates can hold it: trimmed, NAME_MAX characters at most, null when there is nothing left.
export const NAME_MAX = 20
export const shortName = n => (typeof n === 'string' && n.trim() ? n.trim().slice(0, NAME_MAX).trim() : null)
// A pool record as a lineup the sim can take, or null when anything about it is off: our own, another day, a coach,
// card or gear the game doesn't have (a built-in name like constructor included, or another pack's player), a goalie
// off the crease, a level or a number out of range.
export function parse(rec, day, pid) {
  try {
    if (!rec || rec.pid === pid || rec.day !== day || !small(rec.wins) || !small(rec.patience)) return null
    const t = JSON.parse(rec.team)
    if (!Object.hasOwn(COACHES, t.coach) || !t.lineup || !Array.isArray(t.gear) || !t.gear.every(id => Object.hasOwn(GEAR, id)) || !small(t.encore) || !small(t.levelUps)) return null
    const lineup = {}
    for (const [slot, o] of Object.entries(t.lineup)) {
      const c = Object.hasOwn(CARDS, o?.id) && CARDS[o.id]
      if (!SLOTS.includes(slot) || !c || (c.pos === 'G' && slot !== 'G') || ![1, 2, 3].includes(o.level)) return null
      if (o.perm !== undefined && !(o.perm && typeof o.perm === 'object' && Object.values(o.perm).every(n => Number.isFinite(n) && Math.abs(n) < 100))) return null
      lineup[slot] = o.perm ? { id: o.id, level: o.level, perm: o.perm } : { id: o.id, level: o.level }
    }
    // Cups are only looks: an odd one is dropped, not the ghost.
    const cups = Object.fromEntries(Object.entries(t.cups ?? {}).filter(([id, n]) => Object.hasOwn(CARDS, id) && (n === 1 || n === 2)))
    return { lineup: myTeam({ coach: t.coach, lineup, gear: t.gear, encore: t.encore, levelUps: t.levelUps }), coach: t.coach, wins: rec.wins, patience: rec.patience, cups, rec }
  } catch { return null }
}

// The nearest ghosts by wins (worth ten patience each) and patience, one of them at random with the run's own dice so a
// run replays the same. Ties at the cut all stay in, so on day 1, when every ghost is 0 wins and 10 patience, the whole
// pool is in play and nothing favors the newest.
export const pick = (run, pool, pid) => nearest(run, Object.values(pool ?? {}).map(rec => parse(rec, run.day, pid)).filter(Boolean))
// The same from a day's ghosts already parsed (the lab parses each day once).
export function nearest(run, ghosts) {
  if (ghosts.length < MIN_GHOSTS) return null
  const all = [...ghosts]
  for (const g of all) g.d = Math.abs(g.wins - run.wins) * 10 + Math.abs(g.patience - run.patience) + (g.wins > run.wins ? AHEAD : 0)
  all.sort((a, b) => a.d - b.d)
  const near = all.filter(g => g.d <= all[Math.min(NEAREST, all.length) - 1].d)
  return near[Math.floor(rand(run) * near.length)]
}

const call = (db, path, query = '', init = {}) => fetch(`${db}/${path}.json${query}`, { ...init, signal: AbortSignal.timeout(TIMEOUT) }).then(r => (r.ok ? r.json() : null)).catch(() => null)
export const post = (path, body, db = DB, token) => (db ? call(db, path, token ? `?auth=${token}` : '', { method: 'POST', body: JSON.stringify(body) }) : Promise.resolve(null))
// Post today's team and take an opponent from the day's pool: a ghost when there is one, else a bot. Both calls go out
// together; our own record comes back in the read and parse() drops it. signed is { uid, token } for a signed-in player.
export async function opponent(run, pid, db = DB, signed = null, hall) {
  if (!db) return { lineup: botTeam(run) }
  const day = `ghosts/${FOLDER}/d${run.day}`
  post(day, record(run, pid, signed?.uid, hall), db, signed?.token)
  if (run.open) post(`shops/${FOLDER}`, shop(run, pid), db)
  return pick(run, await call(db, day, `?orderBy=%22t%22&limitToLast=${POOL}`), pid) ?? { lineup: botTeam(run) }
}
