// Deterministic hockey match sim: the same lineups and seed always play the same game.
// No DOM, so it runs in the browser and under `node --test`.

export const TPS = 10 // ticks per second
export const SLOTS = ['LW', 'C', 'RW', 'LD', 'RD', 'G']
const PERIOD = 20 * TPS
const REGULATION = 3 * PERIOD
const PENALTY = 6 * TPS
const BOX = 2 // skaters a team can have in the box at once: 5-on-3, never fewer than three on the ice
const MIN_EVERY = 0.5 // haste can't push a cooldown below this
const STORM = 0.05 // overtime: each second both nets take this share of their size, doubling every STORM_DOUBLE seconds
const STORM_DOUBLE = 10
export const EMPTY_NET = 28 // net meter with no goalie card in G
export const GROUP = { LW: 'W', C: 'C', RW: 'W', LD: 'D', RD: 'D', G: 'G' }
export const ANY = 'A' // a card's pos when it plays any skater seat
// Nothing here pairs units across teams: the player can't plan around a random opponent's lineup,
// so effects aimed at the rival hit their net or their whole team.
// Who is adjacent to whom: the C is the hub of the line, wingers play with their side's D, the D are a pair, and
// the goalie plays the puck to his D. Mutual, so "adjacent" reads the same from either side.
const ADJACENT = { LW: ['C', 'LD'], C: ['LW', 'RW', 'LD', 'RD'], RW: ['C', 'RD'], LD: ['LW', 'C', 'RD', 'G'], RD: ['RW', 'C', 'LD', 'G'], G: ['LD', 'RD'] }
const FORWARDS = ['LW', 'C', 'RW']
const RATTLE_START = 0.16, RATTLE_STEP = 0.08 // of the net meter: a 70 net takes 11 Rattled for its first penalty, 17 for the next, then 22...

// mulberry32 over o.r, so the state is a plain number that survives JSON saves.
export function rand(o) {
  let t = (o.r = (o.r + 0x6d2b79f5) | 0)
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// Lineups are { LW: { card, level, perm }, C: ..., G: ... }; a missing slot stays empty.
// perm is a card's permanent gains from earlier games, by stat; they start this game's gains.
// A lineup may also carry gear (the team's bag, as gear objects from gear.js) and encore (extra game starts).
export function newGame(home, away, seed = 1, start = true) {
  const g = { t: 0, ot: false, over: false, winner: null, score: [0, 0], log: [], r: seed | 0 }
  g.gear = [home, away].map(lineup => (lineup.gear ?? []).flatMap(x => x.abilities ?? [])) // each side's gear hooks, duplicates stacking
  g.teams = [home, away].map((lineup, side) => SLOTS.filter(slot => lineup[slot]).map(slot => {
    const { card, level = 1, perm = {} } = lineup[slot]
    if (card.pos === 'G' && slot !== 'G') throw new Error(`${card.name} can only play G`)
    // A skater in G is the empty-net extra attacker, so no off-position cost there.
    const off = slot !== 'G' && GROUP[slot] !== card.pos && card.pos !== ANY
    return { card, level, slot, side, off, cd: 0, box: 0, bonus: 0, acts: 0, gain: { ...perm }, perm: { ...perm } }
  }))
  for (const u of g.teams.flat()) for (const a of hooks(g, u.side, 'level')) u.level = Math.min(3, Math.max(u.level, a.level(u)))
  // Each team's net, plus how Rattled that team is and how much more its next penalty takes.
  g.nets = g.teams.map(team => {
    const goalie = team.find(u => u.card.pos === 'G')
    const side = g.teams.indexOf(team), lift = hooks(g, side, 'net').reduce((n, a) => n + a.net, 0), wider = hooks(g, side, 'netMult').reduce((f, a) => f * a.netMult, 1)
    const base = goalie ? Math.round((goalie.card.composure + lift) * mult(goalie.level) * wider) : EMPTY_NET
    return { max: base, meter: base, block: 0, pressure: 0, rattled: 0, need: Math.round(base * RATTLE_START), step: Math.round(base * RATTLE_STEP) }
  })
  for (const u of g.teams.flat()) u.cd = every(u, g) * TPS
  // Game start: each side once, its players' abilities, then its gear; an encore repeats it.
  if (start) for (const side of order(g)) {
    const times = 1 + ([home, away][side].encore ?? 0) + hooks(g, side, 'encore').length
    for (let k = 0; k < times; k++) log(g, 'start', { side })
  }
  return g
}
// The side's passive gear hooks of one kind.
const hooks = (g, side, hook) => g.gear[side].filter(a => a.on === 'passive' && a[hook] !== undefined)
// Product of a side's gear factors (big, shot, perm) that apply to this unit.
const factor = (u, g, hook) => (g ? g.gear[u.side].reduce((f, a) => f * (a.on === 'passive' && a[hook] !== undefined && (!a.who || a.who(u, g)) ? a[hook] : 1), 1) : 1)

export function playGame(home, away, seed) {
  const g = newGame(home, away, seed)
  while (!g.over) step(g)
  return g
}

export function step(g) {
  if (g.over) return
  g.t++
  // Count down the box before anyone acts, so every penalty lasts exactly PENALTY ticks.
  for (const team of g.teams) for (const u of team) {
    if (u.box && --u.box === 0) { u.cd = every(u, g) * TPS; log(g, 'return', u); callPenalty(g, u.side) }
  }
  for (const side of order(g)) for (const u of g.teams[side]) {
    if (g.over) return
    if (onIce(u) && --u.cd <= 0) { u.cd = every(u, g) * TPS; cast(g, u) }
  }
  // Each second: Pressure hits the net for its stacks and loses one, like a burn; in overtime the storm hits both nets.
  if (g.t % TPS === 0) for (const side of order(g)) {
    const net = g.nets[side], p = net.pressure
    if (p) { if (!(shorthanded(g, side) && aura(g, 1 - side, 'pin'))) net.pressure = p - 1; hitNet(g, side, p) }
    if (g.ot && !g.over) hitNet(g, side, storm(g, side))
    if (g.over) return
  }
  if (g.t % PERIOD === 0 && g.t <= REGULATION) log(g, 'period', undefined, g.t / PERIOD)
  if (g.t !== REGULATION) return
  if (g.score[0] !== g.score[1]) return end(g)
  // Sudden death: a storm wears both nets down, harder and harder, until someone scores.
  g.ot = true
  log(g, 'ot')
}

const order = g => (rand(g) < 0.5 ? [0, 1] : [1, 0])
const storm = (g, side) => Math.ceil(g.nets[side].max * STORM * 2 ** Math.floor((g.t - REGULATION) / (STORM_DOUBLE * TPS)))
const shorthanded = (g, side) => g.teams[side].some(u => u.box)
// Whether a side has a card on the ice (other than not) with this passive rule: pin, save, screen, twice.
const aura = (g, side, rule, not) => g.teams[side].some(m => m !== not && onIce(m) && m.card.abilities.some(a => a.on === 'passive' && a[rule]))
// 0, 1 or 2: the period being played (overtime counts as the 3rd).
export const periodOf = g => Math.min(2, Math.floor(Math.max(0, g.t - 1) / PERIOD))

// Block soaks a shot or a Pressure tick whole, while it lasts.
function hitNet(g, side, d, by, pierce) {
  if (g.over) return
  const net = g.nets[side], absorbed = pierce ? 0 : Math.min(net.block, d)
  net.block -= absorbed
  if (absorbed) log(g, 'blocked', { side }, absorbed, by ? { shot: true } : undefined) // shot: not a Pressure tick or the storm
  damage(g, side, d - absorbed, by)
}

function damage(g, side, d, by) {
  const net = g.nets[side]
  if (by && !g.ot && net.meter - d <= 0 && (g.saved ??= [-1, -1])[side] !== periodOf(g) && aura(g, side, 'save')) {
    g.saved[side] = periodOf(g)
    net.block += d
    return log(g, 'save', { side }, d)
  }
  net.meter -= d
  if (net.meter > 0) return
  const scorer = 1 - side
  g.score[scorer]++
  Object.assign(net, { meter: net.max, block: 0, pressure: 0 })
  log(g, 'goal', { side: scorer, slot: by?.slot })
  if (g.ot) end(g)
}

function end(g) {
  g.over = true
  g.winner = g.score[0] > g.score[1] ? 0 : 1
  for (const u of g.teams.flat()) u.box = 0 // everyone's out for the handshake
  log(g, 'win', { side: g.winner })
}

// --- Events ---
// Every log entry is an event: { t, type, side, slot, amount, ...extra }. side and slot say whose it is (a shot's
// shooter, a penalty's offender, a goal's scorer and shooter, a win's winner). After it's written, every unit on
// the ice whose card has an ability with on === type fires it, if the event is of the right source for the ability:
//   self      this unit's own event (the default)
//   team      any event on this unit's side (including its own)
//   adjacent  an adjacent player's event
//   rival     any event on the other side
//   all       every event of that type, whoever's (period has no side)
// Chains always end because the cards are written so they can't loop, the way Batomon's trigger cards exclude their
// own copies: a card that makes another act never picks a card that does the same (cards.js calm()), and
// sim.test.js plays every pair of such cards in every pair of slots. The sim itself has no depth cap and no guard.
export const WHO = {
  self: (u, g, e, src) => src === u,
  team: (u, g, e) => e.side === u.side,
  adjacent: (u, g, e, src) => e.side === u.side && adjacent(g, u).includes(src),
  rival: (u, g, e) => e.side !== undefined && e.side !== u.side,
  all: () => true,
}
export function log(g, type, u = {}, amount, extra) {
  const e = { t: g.t, type, side: u.side, slot: u.slot, amount, ...extra }
  g.log.push(e)
  const src = e.slot !== undefined ? g.teams[e.side].find(m => m.slot === e.slot) : null
  for (const team of g.teams) for (const m of team) if (onIce(m)) {
    for (const a of m.card.abilities) if (a.on === type && a.run && WHO[a.of ?? 'self'](m, g, e, src)) a.run(m, g, e, src)
  }
  for (const side of [0, 1]) for (const a of g.gear[side]) if (a.on === type && a.run && GEAR_WHO[a.of ?? 'team'](side, e)) a.run(g, side, e, src)
}
// Gear belongs to a side, not a unit: team is that side's events, rival the other side's.
const GEAR_WHO = { team: (side, e) => e.side === side, rival: (side, e) => e.side !== undefined && e.side !== side, all: () => true }
// Fire an event about a unit ('start', 'act'...). Cards call it to set off each other's abilities.
export const trigger = (g, u, on) => log(g, on, u)
// Make a unit act now: its pills, then its act abilities. Its cooldown is untouched.
export function cast(g, u) {
  if (!u || !onIce(u)) return
  perform(g, u)
  u.acts++
  trigger(g, u, 'act')
}

// --- Helpers for card abilities ---

// A hybrid counts as both its archetypes wherever an archetype is asked for.
export const is = (card, arch) => !!arch && (card.arch === arch || card.arch2 === arch) // no archetype asked matches nothing, not every non-hybrid
export const onIce = u => !u.box
export const unitAt = (g, side, slot) => g.teams[side].find(u => u.slot === slot && onIce(u))
export const adjacent = (g, u) => (u.slot !== 'G' && hooks(g, u.side, 'blend').length ? g.teams[u.side].filter(m => m !== u && m.slot !== 'G' && onIce(m)) : ADJACENT[u.slot].map(s => unitAt(g, u.side, s)).filter(Boolean))
const passives = (u, hook) => u.card.abilities.filter(a => a.on === 'passive' && a[hook])

// A unit's extra base for a stat right now: its gains plus its passive adds. Pill stats are then scaled by level
// in amount(); 'haste' is a percent off the cooldown.
// Passive adds scale with level like a printed stat, so a Pro's add is worth two Rookies' and one slot.
// Gear adds are in base units like a printed stat; a flat one is divided by the level so it stays flat.
export const adds = (u, g, stat) => passives(u, 'add').reduce((n, a) => n + (a.add[0] === stat ? a.add[1](u, g) : 0), u.gain[stat] ?? 0)
  + (g ? g.teams[u.side].reduce((n, m) => n + (onIce(m) ? m.card.abilities.reduce((k, a) => k + (a.on === 'passive' && a.aura?.[0] === stat ? a.aura[1](m, u, g) : 0), 0) : 0), 0) : 0)
  + (g ? g.gear[u.side].reduce((n, a) => n + (a.on === 'passive' && a.add && a.add[0] === stat && (!a.who || a.who(u, g)) ? a.add[1] / (a.flat ? mult(u.level) : 1) : 0), 0) : 0)
// Levels double the numbers twice: a Pro is x2, a Star x4, so late builds dwarf early ones.
export const mult = level => 2 ** (level - 1)
export const amount = (u, base, g) => Math.round(base * mult(u.level) * (u.off ? 0.8 : 1) * factor(u, g, 'big'))
export const every = (u, g) => Math.max(MIN_EVERY, u.card.every * (1 - adds(u, g, 'haste') / 100))

// Raise a unit's base for a stat by n for the rest of this game, or permanently (it comes back next game, and
// merges carry it). Base units: a pill stat then scales with level like the printed number. Haste is a percent
// of the cooldown as it stands, so each drop takes a little less off than the one before.
export function gain(g, u, stat, n, perm = false) {
  if (stat === 'haste') n *= 1 - (u.gain.haste ?? 0) / 100
  if (perm) n *= factor(u, g, 'perm')
  if (n <= 0) return
  u.gain[stat] = (u.gain[stat] ?? 0) + n
  if (perm) u.perm[stat] = (u.perm[stat] ?? 0) + n
  log(g, 'gain', u, n, { stat, perm })
}

// What a unit does when it acts, as [stat, base, target]: its card's pills, a met When's pills added on, plus its adds.
// The sim acts on it and the screen draws pills from it, so they always agree.
export function plan(u, g) {
  const when = u.card.abilities.find(a => a.on === 'when' && a.if(u, g))
  const list = u.card.pills.map(([stat, base, target]) => [stat, base, target])
  for (const [stat, n, target] of when?.pills ?? []) { const p = list.find(p => p[0] === stat); if (p) p[1] += n; else list.push([stat, n, target]) }
  for (const p of list) p[1] += adds(u, g, p[0])
  // A stat the card lacks but has been given (gear, a gain, or a pass bonus to a player with no Shoot) becomes a pill:
  // he shoots for what his teammates passed him. The goalie never shoots, and nothing passes to him.
  for (const stat of GRANT) if (!list.some(p => p[0] === stat) && !(stat === 'shoot' && u.slot === 'G')) { const n = adds(u, g, stat); if (n > 0 || (stat === 'shoot' && u.bonus)) list.push([stat, n]) }
  return list
}
const GRANT = ['shoot', 'block', 'pressure', 'rattle', 'rebound']
// A unit's pills right now: [stat, value, target], with level, position, passes and power play applied.
// The pass bonus is spent on the first shot, so a scratch copy stands in for the unit's.
export function pills(u, g) {
  const scratch = { bonus: u.bonus }
  return plan(u, g).map(([stat, base, target]) => [stat, (WORTH[stat] ?? amount)(u, base, g, scratch), target])
}

// Shots add pass bonuses (spent from `spend`), the power play and overtime; the rival's defense is applied as they land.
const WORTH = {
  shoot: (u, base, g, spend) => {
    let bonus = spend.bonus
    spend.bonus = 0
    for (const a of passives(u, 'bonus')) bonus = a.bonus(bonus)
    let d = (amount(u, base, g) + bonus) * (u.shotMult ?? 1) * factor(u, g, 'shot')
    if (shorthanded(g, 1 - u.side)) d *= 1.4 // power play
    return Math.round(d)
  },
}
// Where a pass (or a card's nudge) goes: the whole neighbourhood unless the card names a narrower one, so a card's
// reach depends on the seat it is in, and the budget prices it by the home seat.
export const TARGETS = {
  adjacent: (g, u) => adjacent(g, u),
  'adjacent forwards': (g, u) => adjacent(g, u).filter(m => FORWARDS.includes(m.slot)),
  'your Snipers': (g, u) => g.teams[u.side].filter(m => is(m.card, 'Sniper')),
  'adjacent D': (g, u) => adjacent(g, u).filter(m => m.slot === 'LD' || m.slot === 'RD'),
  'adjacent C': (g, u) => adjacent(g, u).filter(m => m.slot === 'C'),
  'your whole team': (g, u) => g.teams[u.side].filter(m => m !== u && m.slot !== 'G' && onIce(m)),
}
const DO = { shoot, block, refill, pressure, rebound, rattle: hit, pass: (g, u, base, target) => pass(g, u, TARGETS[target ?? 'adjacent'](g, u), base) }
const perform = (g, u, skip) => { for (const [stat, base, target] of plan(u, g)) if (!g.over && stat !== skip) DO[stat](g, u, base, target) }

// Do the unit's other pills again n times.
export function rebound(g, u, base) {
  const n = amount(u, base, g)
  log(g, 'rebound', u, n)
  for (let i = 0; i < n; i++) perform(g, u, 'rebound')
}

// Nothing passes to the net: the goalie never shoots, so a bonus there would only be wasted.
export function pass(g, u, mates, base) {
  const n = amount(u, base, g)
  mates.filter(m => m.slot !== 'G').forEach(m => (m.bonus += n))
  log(g, 'pass', u, n)
}

export function shoot(g, u, base) {
  if (g.over) return
  const bonus = u.bonus
  let d = WORTH.shoot(u, base, g, u)
  if (passives(u, 'spend').length) { d += g.nets[u.side].block; g.nets[u.side].block = 0 }
  for (const def of g.teams[1 - u.side]) if (onIce(def)) for (const a of passives(def, 'defend')) d = a.defend(def, u, d, g)
  d = Math.round(d)
  log(g, 'shot', u, d, { bonus })
  hitNet(g, 1 - u.side, d, u, passives(u, 'pierce').length > 0)
}

export function block(g, u, base) {
  const net = g.nets[u.side], n = amount(u, base, g) * (aura(g, 0, 'twice', u) || aura(g, 1, 'twice', u) ? 2 : 1)
  net.block += n
  log(g, 'block', u, n)
}

export function refill(g, u, base) {
  const net = g.nets[u.side], n = net.pressure && aura(g, 1 - u.side, 'screen') ? 0 : amount(u, base, g)
  net.meter = Math.min(net.max, net.meter + n)
  log(g, 'refill', u, n)
}

export function pressure(g, u, base) {
  const n = amount(u, base, g)
  g.nets[1 - u.side].pressure += n
  log(g, 'pressure', u, n)
}

// Rattle the rival team. A full meter sends their next skater to act to the box, and each penalty a team
// takes makes its next one need more. Two can sit in the box at once (5-on-3); hits past that bank until one returns.
export function hit(g, u, base) {
  if (g.over) return
  const net = g.nets[1 - u.side], n = amount(u, base, g)
  log(g, 'hit', u, n)
  net.rattled += n
  callPenalty(g, 1 - u.side)
}

function callPenalty(g, side) {
  const net = g.nets[side]
  if (net.rattled < net.need || g.teams[side].filter(u => u.box).length >= BOX) return
  const skaters = g.teams[side].filter(m => onIce(m) && m.slot !== 'G')
  if (!skaters.length) return
  const target = skaters.reduce((a, b) => (b.cd < a.cd ? b : a))
  if (target.card.abilities.some(a => a.negate)) { net.rattled = 0; return log(g, 'negated', target) }
  net.rattled -= net.need
  net.need += net.step
  target.box = PENALTY
  log(g, 'penalty', target)
}

// Send a skater to the box without Rattle (a fight, a dirty player's own penalty). False when his team already has two there.
export function sendOff(g, u) {
  if (!u || !onIce(u) || u.slot === 'G' || g.teams[u.side].filter(m => m.box).length >= BOX) return false
  u.box = PENALTY
  log(g, 'penalty', u)
  return true
}
// Damage their net straight from a card (thorns): no Block in the way, so a thorns hit is never blocked back.
export const strike = (g, u, d) => { if (!g.over && d > 0) { log(g, 'strike', u, d); damage(g, 1 - u.side, d, u) } }
