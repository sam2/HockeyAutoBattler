// One run: pick a coach, then sign, set lines and play a game each day until 10 wins or 0 patience.
// The run is a plain object, so it saves as JSON.
import { SLOTS, GROUP, ANY, rand, is } from './sim.js'
import { CARDS, PACK } from './cards.js'
import { COACHES } from './coaches.js'
import { GEAR } from './gear.js'
import { ITEMS } from './items.js'
import { EVENTS } from './events.js'

export const RARITY_COST = { Common: 3, Uncommon: 4, Rare: 5, 'Super Rare': 6, Legendary: 8 }
// A day's paid re-scouts cost $1, then $2, then $3 each after that.
export const rescoutCost = run => Math.min(3, 1 + (run.paidRescouts ?? 0))
export const TIERS = ['Junior', 'College', 'Pro', 'All-Star', 'Legend']
export const RARITIES = Object.keys(RARITY_COST)
// Rarity odds (%) per scouting tier, in RARITIES order. Cards, items and gear all roll on it.
export const ODDS = [
  [100, 0, 0, 0, 0],
  [70, 30, 0, 0, 0],
  [45, 35, 20, 0, 0],
  [25, 35, 25, 15, 0],
  [15, 25, 30, 20, 10],
]
const DAILY_CASH = 10
// Tomorrow's pay: $10 +$1 a day, plus $1 interest per $10 saved (up to $5, more with a Savings Bond), plus sponsor gear.
export const income = run => DAILY_CASH + run.day + Math.min(5 + bag(run, 'interest'), Math.floor(run.cash / 10)) + bag(run, 'pay')
const WIN_TARGET = 10
export const BENCH = ['B0', 'B1', 'B2', 'B3']
export const PLACES = [...SLOTS, ...BENCH]

export const at = (run, place) => (place[0] === 'B' ? run.bench[place[1]] : run.lineup[place])
const put = (run, place, o) => (place[0] === 'B' ? (run.bench[place[1]] = o) : (run.lineup[place] = o))
const pick = (run, list) => list[Math.floor(rand(run) * list.length)]
// The bag's total for a numeric gear hook, or its pieces with a hook.
export const bag = (run, hook) => run.gear.reduce((n, id) => n + (GEAR[id][hook] ?? 0), 0)
const having = (run, hook) => run.gear.filter(id => GEAR[id][hook] !== undefined)
const hasGear = (run, id) => run.gear.includes(id)
const idOf = new Map(Object.entries(CARDS).map(([id, c]) => [c, id])) // sim units carry the card; the season log goes by id
const TALLIED = new Set(['goal', 'block', 'hit'])
// Everything that came in over the run: what is left plus what was spent, less the opening money.
export const earned = run => run.cash + run.spent - DAILY_CASH - (COACHES[run.coach].startCash ?? 0)

export function newRun(coachId, seed = Date.now()) {
  const run = {
    pack: PACK, coach: coachId, day: 1, wins: 0, patience: 10, cash: DAILY_CASH + (COACHES[coachId].startCash ?? 0),
    tier: 1, board: [], item: null, locked: false, freeRescouts: 0, freeArchUsed: false, freeCommonUsed: false, firstSigned: false, discount: 0, bet: 0, encore: 0, itemBought: false,
    lineup: Object.fromEntries(SLOTS.map(s => [s, null])), bench: BENCH.map(() => null),
    gear: [], offer: null, owed: [], bought: [], levelUps: 0, events: [], draftDay: 0, games: [], tally: {}, signed: 0, spent: 0, rescouts: 0,
    voteUsed: false, over: false, won: false, last: null, r: seed | 0,
  }
  startDay(run)
  COACHES[coachId].start?.(run, kit(run))
  open(run)
  return run
}

// The shop log for the balance lab: the run as the shop opened (the season log and last game left out) and every action
// taken in it, so the lab can replay the day exactly through these functions and see each choice with what was on offer.
const LOGGED = new Set(['open', 'acts', 'games', 'tally', 'last', 'match'])
function open(run) {
  run.acts = []
  run.open = JSON.stringify(run, (k, v) => (LOGGED.has(k) ? undefined : v))
}
const log = (run, ...act) => { run.acts?.push(act); return true }

function startDay(run) {
  const coach = COACHES[run.coach]
  run.tier = tierFor(run.day, (coach.tierBonus ?? 0) + bag(run, 'tier'))
  run.freeRescouts = coach.freeRescouts ?? 0
  run.paidRescouts = 0
  run.freeArchUsed = run.freeCommonUsed = run.firstSigned = false
  run.discount = run.bet = run.encore = 0
  run.itemBought = false
  rollBoard(run)
  coach.onDay?.(run, kit(run))
  if (run.draftDay === run.day) kit(run).addCard(rollCard(run, run.tier, undefined, undefined, 'Legendary'))
  if ([3, 6, 9].includes(run.day)) dealEvent(run, run.day)
}

// --- Events ---
// One event from the pool for that day (or 'vote') goes on the queue; the player chooses before the shop opens.
// Cards an event rolls are rolled now, so the screen can show them.
export function dealEvent(run, when, id = pick(run, Object.keys(EVENTS).filter(id => EVENTS[id].when === when))) {
  ;(run.events ??= []).push({ id, cards: EVENTS[id].cards?.(run, kit(run)) ?? [] })
}
// The places an option asks the player to choose one of, or null when it asks nothing.
export const eventPlaces = (run, i) => EVENTS[run.events[0].id].options[i].pick?.(run, kit(run)) ?? null
export function chooseEvent(run, i, place) {
  const ev = run.events?.[0], opt = ev && EVENTS[ev.id].options[i]
  if (!opt) return false
  const places = opt.pick?.(run, kit(run))
  if (places && !places.includes(place)) return false
  log(run, 'event', i, place)
  run.events.shift()
  opt.use(run, kit(run), { card: opt.card === true ? ev.cards[i] : opt.card, place })
  return true
}

const tierFor = (day, bonus = 0) => Math.min(TIERS.length, Math.max(1, 1 + Math.floor((day - 1) / 2) + bonus))

// A rarity from the tier's odds, or one tier higher for a bump, capped at Legendary.
function rollRarity(run, tier, bump = 0) {
  let roll = rand(run) * 100, i = 0
  while (roll >= ODDS[tier - 1][i]) roll -= ODDS[tier - 1][i++]
  return RARITIES[Math.min(RARITIES.length - 1, i + bump)]
}
// A card of the tier's rarity odds (or a set rarity), narrowed to a position, an archetype and a test when there are any.
function rollCard(run, tier, pos, arch, rarity = rollRarity(run, tier), test = () => true) {
  const ids = Object.keys(CARDS).filter(id => (!pos || CARDS[id].pos === pos || (CARDS[id].pos === ANY && pos !== 'G')) && test(CARDS[id]))
  const kin = ids.filter(id => is(CARDS[id], arch)), from = kin.length ? kin : ids
  const pool = from.filter(id => CARDS[id].rarity === rarity)
  return pick(run, pool.length ? pool : from)
}
const rollItem = run => (hasGear(run, 'austerity') ? null : pick(run, Object.keys(ITEMS).filter(id => ITEMS[id].rarity === rollRarity(run, run.tier, COACHES[run.coach].itemBump ?? 0))))

// A locked shop keeps its unsigned cards and item; only the empty spots roll. A rarity forces every card to it.
// The item seat scouts a fifth player once the day's item is bought; a locked fifth player stays overnight and the
// item waits for the seat to free up.
function rollBoard(run, rarity) {
  const keep = run.locked ? run.board : [], seats = run.itemBought || keep[4] ? [0, 1, 2, 3, 4] : [0, 1, 2, 3], fresh = seats.filter(i => !keep[i])
  run.board = seats.map(i => keep[i] ?? rollCard(run, run.tier, undefined, undefined, rarity))
  // Always offer a goalie while you have none.
  const hasG = [...PLACES.map(p => at(run, p)?.id), ...run.board].some(id => id && CARDS[id].pos === 'G')
  if (!hasG && fresh.length) run.board[fresh[0]] = rollCard(run, run.tier, 'G', undefined, rarity)
  if (seats.length < 5 && !run.itemBought && (!run.locked || !run.item)) run.item = rollItem(run)
}

export const toggleLock = run => { run.locked = !run.locked; return log(run, 'lock') }

export function price(run, id) {
  const { freeArch, freeFirst } = COACHES[run.coach], c = CARDS[id]
  if (freeFirst && !run.firstSigned) return 0
  if (freeArch && !run.freeArchUsed && is(c, freeArch)) return 0
  if (c.rarity === 'Common' && !run.freeCommonUsed && hasGear(run, 'rookieContract')) return 0
  return Math.max(0, RARITY_COST[c.rarity] - run.discount)
}

export function rescout(run) {
  if (run.freeRescouts) run.freeRescouts--
  else if (run.cash >= rescoutCost(run)) { const n = rescoutCost(run); run.cash -= n; run.spent += n; run.paidRescouts = (run.paidRescouts ?? 0) + 1 }
  else return false
  run.rescouts++
  run.locked = false // a re-scout is a fresh look at every card
  rollBoard(run)
  return log(run, 'rescout')
}

// Goalie cards only go to G or the bench; a skater in G is the extra attacker.
export const fits = (id, place) => place === 'G' || place[0] === 'B' || CARDS[id].pos !== 'G'

// A new card lands at place if it's empty and fits (by default an empty natural slot, else the bench),
// unless it completes a merge, which goes where the first copy is. Gear that marks signed cards marks it here.
export function sign(run, i, place) {
  const id = run.board[i]
  if (!id || run.cash < price(run, id)) return false
  const merges = PLACES.filter(p => at(run, p)?.id === id && at(run, p).level === 1).length >= 2
  const spot = place ? (!at(run, place) && fits(id, place) ? place : null)
    : [...SLOTS.filter(s => GROUP[s] === CARDS[id].pos || (CARDS[id].pos === ANY && s !== 'G')), ...BENCH].find(p => !at(run, p))
  if (!merges && !spot) return false
  log(run, 'sign', i, place)
  const paid = price(run, id), c = CARDS[id]
  run.cash -= paid
  run.spent += paid
  run.signed++
  if (is(c, COACHES[run.coach].freeArch)) run.freeArchUsed = true
  if (c.rarity === 'Common' && hasGear(run, 'rookieContract')) run.freeCommonUsed = true
  run.board[i] = null
  const o = { id, level: 1, paid }
  for (const g of having(run, 'signGain')) { const [stat, n, test] = GEAR[g].signGain; if (test(c)) perm(o, stat, n) }
  if (!run.firstSigned) for (const g of having(run, 'firstSign')) perm(o, ...GEAR[g].firstSign)
  run.firstSigned = true
  let lifted = 0
  if (spot && hasGear(run, 'developmentDeal')) { consume(run, 'developmentDeal'); levelUp(run, o); lifted++ } // a card with a spot of its own; a merge keeps the deal for the next signing
  absorb(run, o, spot, lifted)
  return true
}
const perm = (o, stat, n) => { o.perm = { ...o.perm, [stat]: (o.perm?.[stat] ?? 0) + n } }
const consume = (run, id) => run.gear.splice(run.gear.indexOf(id), 1)

// Three level-1 copies make a Pro, two Pros make a Star; the result takes the first copy's place and keeps
// every copy's paid price; each permanent gain is the best any copy had, not the sum. One signing that levels a card,
// however many times, owes one gear pick, rolled for the level it reached; an item's level up (gear = null) owes none.
function absorb(run, o, place, lifted = 0) {
  while (o.level < 3) {
    const need = o.level === 1 ? 2 : 1
    const used = PLACES.filter(p => at(run, p)?.id === o.id && at(run, p).level === o.level).slice(0, need)
    if (used.length < need) break
    const all = [o, ...used.map(p => at(run, p))]
    o = { id: o.id, level: o.level, paid: all.reduce((sum, c) => sum + c.paid, 0) }
    const best = all.reduce((best, c) => maxPerm(best, c.perm), {})
    if (Object.keys(best).length) o.perm = best
    used.forEach(p => put(run, p, null))
    place = used[0]
    levelUp(run, o)
    if (lifted !== null) lifted++
  }
  put(run, place, o)
  if (lifted) { run.owed.push(o.level === 3 ? 1 : 0); offerGear(run) }
}
const maxPerm = (best, perm = {}) => { for (const [stat, n] of Object.entries(perm)) best[stat] = Math.max(best[stat] ?? 0, n); return best }
// Gear that marks levelled cards marks it here; the pick it owes is absorb's business.
function levelUp(run, o) {
  o.level++
  run.levelUps++
  for (const g of having(run, 'levelGain')) perm(o, ...GEAR[g].levelGain)
}

// --- Gear ---
// Three distinct pieces of one rarity: no Legendary (or other unique piece) the bag already holds.
function rollGear(run, rarity, n = 3, have = run.gear) {
  const out = []
  for (let k = 0; k < n; k++) {
    const pool = Object.keys(GEAR).filter(id => GEAR[id].rarity === rarity && !out.includes(id) && !(GEAR[id].unique && have.includes(id)))
    if (!pool.length) break
    out.push(pick(run, pool))
  }
  return out
}
// The next owed pick becomes the offer on the table, with the bag's tricks applied: a Treasure Map lifts the rarity,
// Greedy Gloves let you take all three, a Spare Set doubles the pick.
function offerGear(run, rarity) {
  if (run.offer) return
  if (rarity === undefined) { if (!run.owed.length) return; rarity = rollRarity(run, run.tier, run.owed.shift() + (hasGear(run, 'treasureMap') ? 1 : 0) + (COACHES[run.coach].gearBump ?? 0)) }
  if (hasGear(run, 'treasureMap')) consume(run, 'treasureMap')
  run.offer = { gear: rollGear(run, rarity), all: hasGear(run, 'greedyGloves'), dup: hasGear(run, 'greedyGloves') ? false : hasGear(run, 'spareSet') }
  if (run.offer.all) consume(run, 'greedyGloves')
  if (run.offer.dup) consume(run, 'spareSet')
  if (!run.offer.gear.length) { run.offer = null; offerGear(run) }
}
export function pickGear(run, i) {
  const offer = run.offer
  if (!offer || !offer.gear[i]) return false
  log(run, 'gear', i)
  run.offer = null
  for (const id of offer.all ? offer.gear : [offer.gear[i]]) addGear(run, id, offer.dup ? 2 : 1)
  offerGear(run)
  return true
}
function addGear(run, id, copies = 1) {
  const g = GEAR[id]
  for (let k = 0; k < copies; k++) {
    if (g.onPick) g.onPick(run)
    if (!g.consumed) run.gear.push(id)
    if (g.unique) break
  }
}

// --- Items ---
// Everything an item may touch, so items.js needs no run.js import.
const kit = run => ({
  rand: () => rand(run),
  dressed: () => SLOTS.filter(s => run.lineup[s]).map(s => [s, run.lineup[s]]),
  at: place => at(run, place),
  players: test => PLACES.filter(p => at(run, p) && test(at(run, p))),
  perm,
  gear: (id, copies = 1) => addGear(run, id, copies),
  offer: rarity => offerGear(run, rarity),
  roll: rarity => { run.locked = false; rollBoard(run, rarity) },
  rookies: cheap => PLACES.filter(p => at(run, p)?.level === 1 && (!cheap || ['Common', 'Uncommon'].includes(CARDS[at(run, p).id].rarity))),
  levelUp: place => { const o = at(run, place); put(run, place, null); levelUp(run, o); absorb(run, o, place, null) },
  room: () => BENCH.some(b => !at(run, b)),
  // A gift lands on the bench (or merges); with no room it is lost.
  addCard: (id, level = 1, perm) => { const b = BENCH.find(b => !at(run, b)); if (b) absorb(run, { id, level, paid: RARITY_COST[CARDS[id].rarity] * (level === 1 ? 1 : 3), ...(perm && { perm }) }, b, null) },
  rollCard: (rarity = rollRarity(run, run.tier), test = () => true) => rollCard(run, run.tier, undefined, undefined, rarity, test),
  // Every dressed player becomes a random one of the same position at that rarity (or rarity(his rarity, RARITIES)), as a Rookie unless kept at level.
  rebuild: (rarity, keep = false) => { for (const s of SLOTS) if (run.lineup[s]) { const o = run.lineup[s], r = typeof rarity === 'function' ? rarity(CARDS[o.id].rarity, RARITIES) : rarity; run.lineup[s] = { id: rollCard(run, run.tier, CARDS[o.id].pos === ANY ? GROUP[s] : CARDS[o.id].pos, undefined, r), level: keep ? o.level : 1, paid: o.paid } } },
})
export const itemPrice = (run, id) => Math.max(0, ITEMS[id].cost - bag(run, 'itemDiscount') - (COACHES[run.coach].itemDiscount ?? 0))
export const canBuyItem = run => !!run.item && run.cash >= itemPrice(run, run.item) && ITEMS[run.item].can(run, kit(run))
export function buyItem(run) {
  if (!canBuyItem(run)) return false
  log(run, 'item')
  const id = run.item
  run.cash -= itemPrice(run, id)
  run.spent += itemPrice(run, id)
  run.item = null
  run.itemBought = true
  run.bought.push(id)
  ITEMS[id].use(run, kit(run))
  if (run.board.length < 5) run.board[4] = rollCard(run, run.tier) // the item seat scouts a fifth player for the rest of the day
  return true
}

export const releaseValue = o => Math.floor(o.paid / 2)

export function release(run, place) {
  const o = at(run, place)
  if (!o) return false
  log(run, 'release', place)
  run.cash += releaseValue(o)
  put(run, place, null)
  return true
}

// Swap two places.
export function move(run, from, to) {
  const a = at(run, from), b = at(run, to)
  if (from === to || (!a && !b) || (a && !fits(a.id, to)) || (b && !fits(b.id, from))) return false
  put(run, from, b)
  put(run, to, a)
  return log(run, 'move', from, to)
}

// Your dressed lineup as the sim takes it, coach bonuses, the gear bag and any encore included.
export function myTeam(run) {
  const { prepare } = COACHES[run.coach]
  const mine = Object.fromEntries(SLOTS.filter(s => run.lineup[s]).map(s => [s, { card: CARDS[run.lineup[s].id], level: run.lineup[s].level, perm: run.lineup[s].perm }]))
  const team = prepare ? prepare(mine) : mine
  team.gear = run.gear.map(id => GEAR[id])
  if (COACHES[run.coach].abilities) team.gear.push({ abilities: COACHES[run.coach].abilities(run) })
  if (run.encore) team.encore = run.encore
  return team
}

// The away team is a bot unless a ghost lineup is handed in (the lab matches runs against each other).
export function startGame(run, away = botTeam(run)) {
  return { home: myTeam(run), away, seed: Math.floor(rand(run) * 2 ** 31) }
}

// ponytail: bots stand in for real ghost teams until the ghost server exists; tune the level curve in playtests
// A bot drafts one archetype, so what the player faces is a build the balance pass balanced, not a grab bag.
// It carries a gear pick per level up, like a player would, and never fields two copies of a card: where its archetype has
// one card at a position, the other slot comes from the whole pool, as a player's would.
const ARCHES = [...new Set(Object.values(CARDS).filter(c => c.pos !== 'G').map(c => c.arch))]
export function botTeam(run) {
  const { day } = run, tier = tierFor(day), arch = pick(run, ARCHES)
  const slots = ['G', 'C', 'RW', 'LW', 'LD', 'RD'].slice(0, Math.min(6, day + 2))
  const used = new Set()
  const team = Object.fromEntries(slots.map(slot => {
    const level = 1 + Number(rand(run) < (day - 3) / 9) + Number(rand(run) < (day - 7) / 9)
    const card = CARDS[rollCard(run, tier, GROUP[slot], arch, undefined, c => !used.has(c))]
    used.add(card)
    return [slot, { card, level }]
  }))
  const bag = []
  for (const u of Object.values(team)) for (let lv = 2; lv <= u.level; lv++) {
    const [id] = rollGear(run, rollRarity(run, tier, lv === 3 ? 1 : 0), 1, bag)
    if (id && !GEAR[id].consumed) bag.push(id)
  }
  team.gear = bag.map(id => GEAR[id])
  return team
}

// g is the finished sim game; the player is side 0.
// What a loss costs in owner patience: it rises as the run goes on.
export const lossCost = run => run.day <= 2 ? 1 : run.day <= 4 ? 2 : 3

export function finishDay(run, g) {
  const won = g.winner === 0
  // Permanent gains made in the game stay on the card that made them.
  for (const u of g.teams?.[0] ?? []) if (run.lineup[u.slot] && Object.keys(u.perm).length) run.lineup[u.slot].perm = u.perm
  const cost = won ? 0 : lossCost(run)
  run.last = { day: run.day, won, score: [...g.score], cost, ot: g.ot, vote: false }
  // The season log for the box score: every game, and goals, blocks and rattles totalled by the card that made them.
  run.games.push([g.score[0], g.score[1], !!g.ot])
  const who = Object.fromEntries((g.teams?.[0] ?? []).map(u => [u.slot, idOf.get(u.card)]))
  for (const e of g.log ?? []) if (e.side === 0 && TALLIED.has(e.type) && who[e.slot]) {
    const t = (run.tally[who[e.slot]] ??= {})
    t[e.type] = (t[e.type] ?? 0) + (e.type === 'goal' ? 1 : e.amount ?? 0)
  }
  const coach = COACHES[run.coach]
  run.cash += (coach.penaltyCash ?? 0) * (g.log?.filter(e => e.type === 'penalty' && e.side === 1).length ?? 0)
  if (won) { run.wins++; run.cash += bag(run, 'winCash') + run.bet; coach.onWin?.(run, kit(run)) }
  else {
    run.patience = Math.max(0, run.patience - cost)
    for (const id of having(run, 'onLose')) {
      const what = GEAR[id].onLose
      if (what === 'insurance') { run.cash += 15; consume(run, id) }
      else { const [got] = rollGear(run, what === 'legendaryGear' ? 'Legendary' : rollRarity(run, run.tier), 1); if (got) addGear(run, got) }
    }
  }
  if (!run.patience && !run.voteUsed) {
    run.voteUsed = run.last.vote = true // vote of confidence
    run.patience = 1
    dealEvent(run, 'vote')
  }
  run.won = run.wins >= WIN_TARGET
  run.over = run.won || !run.patience
  if (run.over) return
  run.cash += income(run)
  run.day++
  startDay(run)
  open(run)
}

// Replays a logged shop: the run as it opened with every action applied, as the player left it at puck drop. each sees
// the run before every action, and once more at the end as 'drop'.
const DO = { sign, release, move, rescout, lock: toggleLock, gear: pickGear, item: buyItem, event: chooseEvent }
export function replay(opened, acts, each = () => {}) {
  const run = JSON.parse(opened)
  for (const [name, ...args] of acts) { each(run, name, args); if (!DO[name]?.(run, ...args)) throw new Error(`replay: ${name} ${args} failed on day ${run.day}`) }
  each(run, 'drop', [])
  return run
}

// The Hall of Fame, by card id: [cups won dressed in the final game, 1 once one of them was at level 3+ in it].
// A card dressed twice in that game still gets one cup.
export function induct(hall, g) {
  const best = new Map()
  for (const u of g.teams[0]) best.set(idOf.get(u.card), Math.max(best.get(idOf.get(u.card)) ?? 0, u.level))
  for (const [id, lv] of best) { const [cups = 0, gold = 0] = hall[id] ?? []; hall[id] = [cups + 1, gold || +(lv >= 3)] }
  return hall
}
