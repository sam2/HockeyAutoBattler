// Browser UI: coach pick, shop, live battle, end screen, drawn on a fixed 1280x720 stage scaled to fit.
// All game rules live in run.js and sim.js; this file only renders and forwards taps.
import { newGame, step, pills, every, mult, TPS, SLOTS, GROUP, ANY, EMPTY_NET, TARGETS } from './sim.js'
import { CARDS, PACK, PACKS } from './cards.js'
import { COACHES } from './coaches.js'
import { portrait, icon, BAG } from './art.js'
import { GEAR } from './gear.js'
import { ITEMS } from './items.js'
import { EVENTS } from './events.js'
import { DB, FOLDER, opponent, post, ending, parse, shortName } from './ghost.js'
import { CAN, ready, loaded, user, signIn, signOut, signed, nameOf, setName, pull, push } from './account.js'
import { newRun, price, rescout, toggleLock, sign, release, move, at, fits, myTeam, botTeam, releaseValue, startGame, finishDay, income, earned, pickGear, buyItem, canBuyItem, itemPrice, chooseEvent, eventPlaces, lossCost, induct, rescoutCost, TIERS, ODDS, RARITIES } from './run.js'

// The device's own run, and the signed-in account's run kept apart from it, so signing out puts the device's back.
// One run at a time, whatever its pack (run.pack): playing another pack means abandoning it. Each pack (?pack=2) keeps
// its own Hall of Fame.
const KEY = 'hab-run', ACCT = 'hab-run-acct'
// Every pack's cards by id (no two packs share an id for different players), for the Hall of Fame's other packs.
const EVERY = Object.assign({}, ...Object.values(PACKS).map(p => p.cards))
// A device signed in before the two were split holds the account's run under the device's key.
try { if (flag('hab-signed') && !localStorage.getItem(ACCT)) { localStorage.setItem(ACCT, localStorage.getItem(KEY) ?? 'null'); localStorage.removeItem(KEY) } } catch {}
// Who this browser is to the ghost pool, so it never meets its own teams. Signed in, it is the account, so every device
// on one account counts as one player.
const PID = (() => { try { let id = localStorage.getItem('hab-pid'); if (!id) localStorage.setItem('hab-pid', (id = crypto.randomUUID())); return id } catch { return 'anon' } })()
const pid = () => user()?.uid ?? PID
// Only ever the first name off the account, never the full one.
const firstName = () => shortName(user()?.displayName?.trim().split(/\s+/)[0])
// The name on this player's plates, and the one other players look up: signed in, with the switch on (it starts off).
// The switch mirrors whether the account has a name up, so it reads the same on every device.
const myName = () => (flag('hab-showname') ? firstName() : null)
const PERIOD = 20 * TPS, REG = 3 * PERIOD
const BENCH = ['B0', 'B1', 'B2', 'B3']
const PLACES = [...SLOTS, ...BENCH]
// Shop seats (mini top-left corners): the battle's 1-2-3 arrow, 94px between rows and 170px between columns.
const SEAT = { G: [116, 104], LD: [286, 57], RD: [286, 151], LW: [456, 10], C: [456, 104], RW: [456, 198] }
// An end-zone faceoff circle centered at x, y with outer radius r: the ring, the dot, the hash marks toward the boards
// and the four L marks around the dot, drawn in feet (the ring is 15 ft) and scaled to r.
const circle = (x, y, r) => {
  const f = r / 15, R = r + 4 * f, L = [[1, 1], [1, -1], [-1, 1], [-1, -1]]
  const hash = L.map(([a, b]) => `M${a * 2.8 * f} ${b * (r - 1.5)}v${b * 3 * f}`).join('')
  const ls = L.map(([a, b]) => `M${a * 5.5 * f} ${b * 1.2 * f}H${a * 2 * f}V${b * 4 * f}`).join('')
  return `<svg style="position:absolute;left:${x - R}px;top:${y - R}px" width="${2 * R}" height="${2 * R}" viewBox="${-R} ${-R} ${2 * R} ${2 * R}" opacity=".3" fill="none" stroke="#d4202c">
    <circle r="${r - 1.5}" stroke-width="3"/><path d="${hash}" stroke-width="2.5"/><path d="${ls}" stroke-width="1.5"/><circle r="${1.5 * f}" fill="#d4202c" stroke="none"/></svg>`
}
// Goal line, crease, faceoff circles, blue line and the red line, drawn around the seats.
const ICE = `<i style="left:98px;top:0;width:3px;height:100%;background:rgba(212,32,44,.5)"></i><i style="left:101px;top:117px;width:22px;height:60px;border-radius:0 30px 30px 0;background:#bfe0f5"></i>
  ${circle(254, 56, 33)}${circle(254, 244, 33)}
  <i style="left:570px;top:0;width:8px;height:100%;background:rgba(27,79,160,.55)"></i><i style="right:0;top:0;width:5px;height:100%;background:rgba(212,32,44,.6)"></i>`
const ORD = ['1ST', '2ND', '3RD']

const STAT = {
  shoot: ['#c41e2a', 'Shoot'], pass: ['#0b7a7a', 'Pass'], pressure: ['#b34d00', 'Pressure'], rattle: ['#6f35a8', 'Rattle'],
  block: ['#2c5f9e', 'Block'], refill: ['#1b7a43', 'Refill'], rebound: ['#a3203a', 'Rebound'], haste: ['#8a5d00', 'Haste'], net: ['#13243b', 'Net'],
}
// [main color, light tint, mid tint (added below)]
const ARCH = {
  Sniper: ['#c41e2a', '#f8d9dc'], Playmaker: ['#0b7a7a', '#d2ecec'], Grinder: ['#b34d00', '#f7e0cf'], Enforcer: ['#6f35a8', '#e8ddf4'],
  Shutdown: ['#2c5f9e', '#d9e5f3'], 'Puck-mover': ['#8a5d00', '#f3e8cc'], Butterfly: ['#1b7a43', '#d6ecdd'], Hybrid: ['#3f6b2a', '#dfe9d6'],
}
for (const a of Object.values(ARCH)) a.push(`color-mix(in srgb, ${a[0]} 50%, #fff)`) // a scouted card's fill
// [frame, shadow, ink on navy, ink on white]
const RAR = {
  Common: ['#8c99a6', '#5f6b77', '#c3ccd5', '#56636f'], Uncommon: ['#2f9e5a', '#1d7a42', '#5fd68f', '#1d7a42'],
  Rare: ['#2b6fe0', '#1f57b8', '#7fb2ff', '#1f57b8'], 'Super Rare': ['#8b3fd6', '#6a2aa8', '#c79bff', '#7130b4'],
  Legendary: ['#e8a317', '#b07800', '#ffcc4d', '#8f5b00'],
}
const POS = { W: 'WING', C: 'CENTER', D: 'DEFENSE', G: 'GOALIE', [ANY]: 'ANY POSITION' }
const short = pos => (pos === ANY ? 'ANY' : pos)
const LEVEL = n => ['ROOKIE ★', 'PRO ★★', 'STAR ★★★'][n - 1] ?? 'STAR+ ★★★' // Superstar coach can push a Star to 4
const TAG = { x: ['EXTRA ATTACKER', 'EXTRA ATTACKER, EMPTY NET'], off: ['OFF POS 80%', 'OFF POSITION: 80% OUTPUT'] }

// Battle spots from the mock; the ghost team is mirrored.
const SPOT = [
  { LW: [560, 232], C: [560, 382], RW: [560, 532], LD: [380, 302], RD: [380, 462], G: [170, 382] },
  { RW: [720, 232], C: [720, 382], LW: [720, 532], RD: [900, 302], LD: [900, 462], G: [1110, 382] },
]
const NET_POP = [[95, 300], [1185, 300]] // "-N" by each net
const HUD_POP = [[250, 128], [1030, 128]] // "+N" under each net meter

const app = document.getElementById('app'), stage = document.getElementById('stage')
const $ = id => document.getElementById(id)
const idOf = new Map(Object.entries(CARDS).map(([id, c]) => [c, id])) // sim units carry the card, art needs the id

const fit = () => stage.style.setProperty('--s', Math.min(innerWidth / 1280, innerHeight / 720))
addEventListener('resize', fit)
fit()

let run = fresh(load()), sel = null, quitting = false, B = null, zoom = null, bagOpen = false, offered = null, waiting = false, lastStats = false
// The gear offer whose bag has been tapped open, whether this render follows a level up, and the gear picked last tap.
let opened = null, lifted = false, seenUps = run?.levelUps ?? 0, flying = null
// The offer whose opening has played (or been skipped), and when the bag on screen finishes moving.
let played = null, settle = 0
// Three coaches on offer for the next run, kept on the device until one is picked so a reload cannot redraw them.
const OFFER = 'hab-offer'
function offerCoaches() {
  if (offered) return offered
  try { offered = JSON.parse(localStorage.getItem(OFFER)); if (offered.length === 3 && offered.every(id => COACHES[id])) return offered } catch {}
  offered = Object.keys(COACHES).sort(() => Math.random() - 0.5).slice(0, 3)
  try { localStorage.setItem(OFFER, JSON.stringify(offered)) } catch {}
  return offered
}

// The game opens on the title. A device that was signed in last time waits there (up to 3 s) for the account's run.
let title = true, loading = CAN && flag('hab-signed')
// PLAY without a run picks the pack, then the coach. Each pack is its own page (?pack=2), so picking another pack loads
// it with a note to skip its title and open on the coaches. A run plays on its own pack's page: one opened on another
// pack goes there instead.
const packURL = n => { const url = new URL(location.href); if (n === '1') url.searchParams.delete('pack'); else url.searchParams.set('pack', n); return url }
const away = !!run && (run.pack ?? '1') !== PACK && Object.hasOwn(PACKS, run.pack)
if (away) location.replace(packURL(run.pack))
let packing = false, toCoach = (() => { try { const on = sessionStorage.getItem('hab-pick'); sessionStorage.removeItem('hab-pick'); return !!on } catch { return false } })()
const land = () => { if (!toCoach || loading) return; toCoach = false; if (!run) title = false }

// A save from before gear existed starts over; one from before the season log gets empty counters.
function slot() { return flag('hab-signed') ? ACCT : KEY }
function load(key = slot()) { try { return JSON.parse(localStorage.getItem(key)) } catch { return null } }
function fresh(r) { return r?.gear ? { games: [], tally: {}, signed: 0, spent: 0, rescouts: 0, ...r } : null }
function flag(key, on) { try { if (on === undefined) return !!localStorage.getItem(key); on ? localStorage.setItem(key, '1') : localStorage.removeItem(key) } catch { return false } }
// Signed in, every save goes to the account too, or a reload would bring back the account's older copy (a fresh shop to re-scout).
function save() { try { run ? localStorage.setItem(slot(), JSON.stringify(run)) : localStorage.removeItem(slot()) } catch {} if (flag('hab-signed') && !loading) push(run) } // not while the account's own copy is still on its way

// The Hall of Fame (see induct in run.js). The device keeps its signed-out hall under its own key. Signed in, the
// account's hall is the one shown and added to, and an account without one takes this device's, as the run does; the
// device's own hall stays as it was, so signing in on a friend's device leaves theirs there. Each pack has its own hall
// (the account's key 'hall' for pack one, 'hall-p2' for pack two), and the account's is copied to the device so the
// Hall of Fame can show another pack's. hof: the pack whose hall is up, or null.
const sfx = n => (n === '1' ? '' : '-p' + n), ACCT_HALL = 'hall' + sfx(PACK)
const hallKey = (n, signed) => (signed ? 'hab-hall-acct' : 'hab-hall') + sfx(n), HALL = hallKey(PACK)
let hall = loadHall(), hallSigned = false, hof = null
function loadHall() { try { return JSON.parse(localStorage.getItem(HALL)) ?? {} } catch { return {} } }
function saveHall() { try { localStorage.setItem(hallKey(PACK, hallSigned), JSON.stringify(hall)) } catch {} if (hallSigned) push(hall, ACCT_HALL) }
const hallOf = n => { if (n === PACK) return hall; try { return JSON.parse(localStorage.getItem(hallKey(n, flag('hab-signed')))) ?? {} } catch { return {} } }
// An unreachable database leaves the device's hall in use, and cups won meanwhile go to the device. The other packs'
// halls are copied down too, since cups won on another device or page never reached this one's copies.
async function pullHall(u) {
  const others = Object.keys(PACKS).filter(n => n !== PACK).map(n => pull(u, 'hall' + sfx(n)).then(h => {
    if (h !== undefined && user() === u) try { localStorage.setItem(hallKey(n, true), JSON.stringify(h ?? {})) } catch {}
  }))
  const saved = await pull(u, ACCT_HALL)
  await Promise.all(others)
  if (saved === undefined || user() !== u) return
  if (saved) hall = saved
  else if (Object.keys(hall).length) push(hall, ACCT_HALL)
  hallSigned = true
  try { localStorage.setItem(hallKey(PACK, true), JSON.stringify(hall)) } catch {}
}

// --- Small renderers ---

const art = (id, bg) => `<span class="art"${bg ? ` style="background:${bg}"` : ''}>${portrait(id)}</span>`
// Every pill comes from sim.js pills(). A card outside a game is fielded alone, so it shows its printed stats.
const HOME = { W: 'LW', C: 'C', D: 'LD', G: 'G', [ANY]: 'C' }
function solo(card, level, perm) {
  const g = newGame({ [HOME[card.pos]]: { card, level, perm } }, {}, 1, false)
  return [g.teams[0][0], g]
}
const pill = ([k, n]) => `<span class="pill" style="background:${STAT[k][0]}">${k === 'pass' ? '+' : ''}${n}</span>`
// A cooldown chip joins the row once haste has moved it off the printed number.
const cdChip = (u, g) => (every(u, g) !== u.card.every ? `<span class="pill" style="background:${STAT.haste[0]}">${+every(u, g).toFixed(2)}s</span>` : '')
const pillRow = (u, g) => pills(u, g).map(pill).join('') + cdChip(u, g)
// A dressed player in the shop, fielded as at game start (before its abilities), so their pills count teammates and the coach.
// Bench and scouted cards have no team, so they show printed stats.
function fielded(p) {
  const g = p[0] !== 'B' && newGame(myTeam(run), {}, 1, false), u = g && g.teams[0].find(m => m.slot === p)
  return u ? [u, g] : solo(CARDS[at(run, p).id], at(run, p).level, at(run, p).perm)
}

// Color stat keywords and archetype names in rules text.
const KW = { shoo: 'shoot', shot: 'shoot', pass: 'pass', pres: 'pressure', ratt: 'rattle', bloc: 'block', refi: 'refill', rebo: 'rebound', soon: 'haste', cool: 'haste', powe: 'shoot' }
const RICH = /\b(?:shoot\w*|shots?|pass(?:es)?|pressure|rattle[ds]?|blocks?|refills?|rebounds?|sooner|cooldowns?|power play|Snipers?|Playmakers?|Grinders?|Enforcers?|Shutdowns?|Puck-movers?)\b/gi
const rich = s => s.replace(RICH, w => {
  const a = Object.keys(ARCH).find(n => w.toLowerCase().startsWith(n.toLowerCase()))
  return `<b class="kw" style="color:${a ? ARCH[a][0] : STAT[KW[w.toLowerCase().slice(0, 4)]][0]}">${w}</b>`
})

// An ability's trigger line: When <cond>, Passive, On game start, or On <whose> <event>.
const EV = { hit: 'rattle', blocked: 'blocked shot' }
const OF = { self: '', team: 'team', adjacent: 'adjacent', rival: 'rival', all: '' }
const head = a => a.head ?? (a.on === 'when' ? `When ${a.cond}` : a.on === 'passive' ? 'Passive' : a.on === 'start' ? 'On game start' : `On ${[OF[a.of ?? 'self'], EV[a.on] ?? a.on].filter(Boolean).join(' ')}`)
// A hybrid's chip is split between its two archetypes.
// A card's archetype colour as a background (k: 0 the strong shade, 1 the light one, 2 the mid one); a hybrid is split, down the middle
// unless deg tilts it.
const archBg = (c, k = 0, deg = 90) => c.arch2 ? `linear-gradient(${deg}deg,${ARCH[c.arch][k]} 50%,${ARCH[c.arch2][k]} 50%)` : ARCH[c.arch][k]
const archChip = c => `<span${c.arch2 ? ' class="hy"' : ''} style="background:${archBg(c)}">${c.arch2 ? `<i>${c.arch}</i><i>${c.arch2}</i>` : c.arch}</span>`
const scaled = (text, lv) => text.replace(/\{([\d.]+)\}/g, (_, n) => +(n * mult(lv)).toFixed(2))

// sell: what releasing this owned player pays, shown beside the rarity.
function face(id, lv, [u, g] = solo(EVERY[id], lv), sell) {
  const c = EVERY[id], r = RAR[c.rarity], list = pills(u, g)
  if (c.pos === 'G') list.push(['net', c.composure * mult(lv), 'meter size'])
  return `<div class="face" style="--r:${r[0]};--rs:${r[1]}">
    <div class="head"><b>${c.name}</b><span style="color:${r[2]}">${c.rarity}${sell !== undefined ? ` <i class="sell">+$${sell}</i>` : ''}</span></div>
    <div class="top">
      <div class="frame">${art(id)}</div>
      <div class="chips">${archChip(c)}<span>${POS[c.pos]}</span><span class="lvl">${LEVEL(lv)}</span></div>
    </div>
    <div class="stats">
      <div class="cdbox"${every(u, g) !== c.every ? ` style="border-color:${STAT.haste[0]}"` : ''}><b>${+every(u, g).toFixed(2)}</b><span>sec</span></div>
      <div class="plist">${list.map(p => `<div>${pill(p)}<b style="color:${STAT[p[0]][0]}">${STAT[p[0]][1]}</b><span class="tgt">${p[2] ?? ''}</span></div>`).join('')}</div>
    </div>
    ${c.abilities.filter(a => a.text).map(a => `<div class="ability"><span class="ah">${head(a)}</span><span class="at">${rich(scaled(a.text, lv))}</span></div>`).join('')}
  </div>`
}

// A gear or item tile: icon, name, rarity and rules text. Items also show their price.
function tile(def, extra = '') {
  const r = RAR[def.rarity]
  return `<span class="gt" style="--r:${r[0]};--rs:${r[1]}"><span class="gi">${icon(def.icon)}</span><b>${def.name}</b><span class="gr" style="color:${r[3]}">${def.rarity}${def.cost !== undefined ? ` · ${def.cost ? '$' + def.cost : 'FREE'}` : ''}</span><p>${rich(def.text)}</p>${extra}</span>`
}
// The shop's item slot: one item a day, bought on the spot.
function itemCard() {
  if (run.board.length > 4) return "" // the seat holds a fifth player today
  const id = run.item
  if (!id) return `<div class="ph">${run.itemBought ? 'SOLD' : 'NO ITEM'}</div>`
  const d = ITEMS[id], r = RAR[d.rarity], poor = !canBuyItem(run), cost = itemPrice(run, id)
  return `<button class="bc item${sel?.item ? ' sel' : ''}${poor ? ' poor' : ''}" style="border-color:${r[0]}" data-act="item" aria-label="Item: ${d.name}, ${d.rarity}, ${cost ? '$' + cost : 'free'}">
    <span class="body"><span class="gi">${icon(d.icon)}</span><span class="rar" style="color:${r[3]}">${d.rarity}</span><span class="itag">ITEM</span></span>
    <span class="strip" style="background:${r[0]}"><b>${d.name}</b><span>${cost ? '$' + cost : 'FREE'}</span></span>
  </button>`
}
// The bag, grouped: each piece once with a count.
const bagHTML = () => {
  const counts = run.gear.reduce((m, id) => m.set(id, (m.get(id) ?? 0) + 1), new Map())
  return `<div class="modal" data-act="nobag"><div class="bagv" role="dialog" aria-modal="true" aria-label="Team bag"><h2>TEAM BAG</h2>
    <div class="tiles">${counts.size ? [...counts].map(([id, n]) => tile(GEAR[id], n > 1 ? `<span class="count">×${n}</span>` : '')).join('') : '<p class="none">Empty. Level up a player to pick gear.</p>'}</div>
    <span class="znote">Gear works for the whole team, all run. Tap anywhere to close</span></div></div>`
}
// A level up (or a bag item, or an event) brings gear in a duffel. It drops in shut, after the card's LEVEL UP when a
// card levelled, glowing the rarity of what's inside; a tap unzips it and the three pieces arc out to pick from.
// A tap anywhere while the bag is still coming in or opening skips straight to the gear, laid out and still.
const offerHTML = o => {
  const wait = lifted ? 0.8 : 0, look = `--glow:${RAR[GEAR[o.gear[0]].rarity][2]};--wait:${wait}s`
  const bag = `<span class="beam"></span><span class="shadow"></span><span class="sp">${BAG.body}</span><span class="sp lid">${BAG.lid}</span><span class="seam"></span><span class="pull"></span>`
  if (o !== opened) {
    settle = performance.now() + (wait + 0.95) * 1000
    return `<div class="modal bagm" style="${look}" data-act="openbag"><button class="duffel" data-act="openbag" aria-label="Open the bag: new gear inside">${bag}</button><p class="tapbag">TAP THE BAG</p></div>`
  }
  const still = played === o
  if (!still) { played = o; settle = performance.now() + 1300 }
  return `<div class="modal bagm open${still ? ' still' : ''}" style="${look}" data-act="openbag"><div class="duffel" aria-hidden="true">${bag}</div>
  <div class="offer" role="dialog" aria-modal="true" aria-labelledby="oh"><h2 id="oh">${o.all ? 'GREEDY GLOVES: TAKE ALL THREE' : 'NEW GEAR: PICK ONE'}</h2>
  <div class="tiles">${o.gear.map((id, i) => `<button class="gtb" style="--i:${i}" data-act="pick" data-arg="${i}" aria-label="Take ${GEAR[id].name}">${tile(GEAR[id])}</button>`).join('')}</div>
  <p class="sub">${o.dup ? 'Spare Set: you get two copies. ' : ''}Gear goes in your team bag for the rest of the run.${o.all ? ' Tap any to take them all.' : ''}</p></div></div>`
}

// An event takes the whole screen: the story, then three options as wide rows that slide in one after another.
// Every option is a title and one line under it: a player or a piece of gear is titled by its name, and gear is
// described by its rules, unless the option gives its own title or text.
const optionRow = (o, i, card) => {
  const def = card ? CARDS[card] : o.gear ? GEAR[o.gear] : null, r = RAR[def?.rarity ?? 'Common'], off = eventPlaces(run, i)?.length === 0
  const title = o.title ?? def.name, body = o.text ?? (o.gear ? def.text : "")
  return `<button class="op" style="--i:${i};--r:${r[0]};--rs:${r[1]}" data-act="event" data-arg="${i}"${off ? ' disabled' : ''} aria-label="${title}. ${body}"><span class="gi">${card ? art(card) : icon(o.gear ? GEAR[o.gear].icon : o.icon ?? 'cash')}</span>
    <span class="ot"><b>${title}</b><span class="gr" style="color:${r[3]}">${card ? `${def.rarity} ${def.arch}` : def?.rarity ?? ''}</span><p>${rich(body)}</p></span></button>`
}
const picking = () => run.events?.[0]?.picking
const eventHTML = ev => {
  const e = EVENTS[ev.id]
  return `<div class="modal evt" role="dialog" aria-modal="true" aria-labelledby="eh"><p class="kick">${e.when === 'vote' ? 'AFTER THE VOTE' : 'DAY ' + run.day}</p><h1 id="eh">${e.name}</h1><p class="flavor">${e.text}</p>
  <div class="ops">${e.options.map((o, i) => optionRow(o, i, o.card === true ? ev.cards[i] : o.card)).join('')}</div>
  <p class="hint">Pick one. Players join your bench if there is room.</p></div>`
}

// Keyword help in the zoomed card view: [matches the card's stats, targets or ability, color key, title, text].
const GLOSS = [
  [/shoot|shot/i, 'shoot', 'Shoot', 'Damages the other net meter, Block first. Empty the meter to score a goal; it then resets to full.'],
  [/\bpass(?!ive)/i, 'pass', 'Pass', 'Adds to the shot of every adjacent player.'],
  [/pressure/i, 'pressure', 'Pressure', 'Stacks on the other net. Each second the net takes damage equal to the stacks, then one stack goes away. A goal clears it.'],
  [/rattle/i, 'rattle', 'Rattled', "Fills a meter on the other team. When it's full, their next skater to act sits 6 s in the box, and your shots deal 40% more while he's there. Each penalty takes more to fill than the last."],
  [/power play|shorthanded/i, 'shoot', 'Power play', 'While the other team has a skater in the box, your shots deal 40% more.'],
  [/block/i, 'block', 'Block', 'A shield on your net. Shots and Pressure hit the shield before the net, until it is used up. A goal clears it.'],
  [/refill/i, 'refill', 'Refill', 'Restores your net meter, up to full.'],
  [/sooner/i, 'haste', 'Acts sooner', 'Their next action comes early by that much. Only that one action is sped up.'],
  [/cooldown/i, 'haste', 'Cooldown', 'The seconds between acts. A drop is a share of the cooldown as it stands, so each one takes off a little less. It can reach 0.5 s, no lower.'],
  [/rebound/i, 'rebound', 'Rebound', 'Acts that many additional times: their other stats happen again.'],
  [/for this battle/i, 'net', 'For this battle', 'The gain lasts until the final horn.'],
  [/permanently/i, 'net', 'Permanently', 'The gain stays for the rest of the run. A merge keeps the best gain any copy had.'],
  [/level/i, 'net', 'Levels', 'Three Rookies make a Pro, two Pros a Star. A Pro doubles every number on the card, a Star doubles it again.'],
  [/\bacts\.?$/im, 'net', 'Acts', 'Does their stats and On act abilities right now; their cooldown keeps counting.'],
  [/later/i, 'haste', 'Acts later', 'Their next action is pushed back by that much. Only that one action is delayed.'],
  [/Net meter/, 'net', 'Net meter', `Goalie composure, doubled at Pro and doubled again at Star. Shots that empty it score. With no goalie it's an empty net of ${EMPTY_NET}.`],
  [/adjacent|\bpass(?!ive)/i, 'net', 'Adjacent', 'The players next to him in the lineup. The tabs on his card point at them.'],
  [/game start/i, 'net', 'On game start', 'Happens once before anyone acts.'],
  [/On period/, 'net', 'On period', 'Happens at the end of each period, three times a game.'],
  [/On act/, 'net', 'On act', 'Happens every time this player acts, right after their stats.'],
  [/Passive/, 'net', 'Passive', 'Always on while this player is on the ice.'],
  [/each new period/i, 'net', 'On each new period', 'Happens at the start of the 2nd and the 3rd period.'],
  [/for this game/i, 'net', 'For this game', 'The gain lasts until the final horn.'],
  [/faster/i, 'haste', 'Acts faster', 'Their cooldown is that much shorter while it holds.'],
]
const gloss = c => {
  const said = [...c.pills.map(p => `${STAT[p[0]][1]} ${p[2] ?? ''}`), c.pos === 'G' ? 'Net meter' : '', ...c.abilities.flatMap(a => [head(a), a.text])].join(' ')
  return GLOSS.filter(([re]) => re.test(said)).map(([, k, title, text]) => `<div><b style="color:${STAT[k][0]}">${title}</b><p>${text}</p></div>`)
}

// Tapping a card (in the shop, the big card or the Hall of Fame) opens it full size with keyword help and level toggles. Any other tap closes it.
// More than three keywords split the help across both sides of the card.
const zoomHTML = ({ id, lv }) => { const g = gloss(EVERY[id]), half = g.length > 3 ? Math.ceil(g.length / 2) : g.length
  return `<div class="modal zm" data-act="unzoom"><div class="zoomv" role="dialog" aria-modal="true" aria-label="${EVERY[id].name} details">
  <div class="gloss">${g.slice(0, half).join('')}</div>
  <div class="zcol"><div class="zcard">${face(id, lv)}</div>
    <div class="lvls"><span>SEE LEVEL UPS</span>${[1, 2, 3].map(n => `<button data-act="lv" data-arg="${n}" aria-pressed="${n === lv}">LV ${n}</button>`).join('')}</div>
    <span class="znote">3 Rookies make a Pro · 2 Pros make a Star · Tap anywhere to close</span></div>
  <div class="gloss r">${g.slice(half).join('')}</div>
</div></div>` }

// Off-position or a skater in net: key into TAG.
const tagOf = (p, o) => { const pos = CARDS[o.id].pos; return p === 'G' ? pos !== 'G' && 'x' : p[0] !== 'B' && GROUP[p] !== pos && pos !== ANY && 'off' }

// What on a card reaches its neighbours, as [stat, target]: a pass pill (teal), an ability aimed at them (`to`, gold:
// acts sooner) or one that listens to them (`of`, in the colour of what it listens for). Null when seating is moot.
const LISTEN = { hit: 'rattle', block: 'block', shot: 'shoot' }
function reach(c) {
  const p = c.pills.find(p => p[0] === 'pass' && p[2] !== 'your Snipers')
  if (p) return ['pass', p[2] ?? 'adjacent']
  const a = c.abilities.find(a => a.to || a.of === 'adjacent')
  return a ? (a.to ? ['haste', a.to] : [LISTEN[a.on], 'adjacent']) : null
}
// The seats a card would reach from a seat, as the team stands (so Line Blender counts): empty seats reach nobody.
function reaches(id, seat) {
  const r = reach(CARDS[id])
  return r ? TARGETS[r[1]](newGame(myTeam(run), {}, 1, false), { slot: seat, side: 0 }).map(m => m.slot).filter(s => s !== seat) : []
}
// The edge of a seat that faces another: the axis the two are further apart on.
const edge = (a, b) => { const dx = SEAT[b][0] - SEAT[a][0], dy = SEAT[b][1] - SEAT[a][1]; return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : dy > 0 ? 'b' : 't' }
// A tab on each edge of a seated card that faces a seat it reaches, in the colour of what reaches it.
const tabs = (id, seat) => { const r = reach(CARDS[id]); return r ? [...new Set(reaches(id, seat).map(s => edge(seat, s)))].map(d => `<svg class="tab ${d}" viewBox="0 0 14 20" style="--c:${STAT[r[0]][0]}"><path d="M0 1H6L13 10L6 19H0Z"/></svg>`).join('') : '' }
// Light the seats the card at a seat (or a card held over it) reaches, in place.
function light(id, seat) {
  app.querySelectorAll('.mini.tgt').forEach(x => x.classList.remove('tgt'))
  if (id && SEAT[seat]) for (const s of reaches(id, seat)) app.querySelector(`.mini[data-arg="${s}"]`)?.classList.add('tgt')
}

// still: a plain tile in flow for the end screen, not a button in its shop seat.
function mini(p, still) {
  still = still === true // .map(mini) passes an index as the second argument
  const o = at(run, p), lit = sel?.place && SEAT[sel.place] && at(run, sel.place) && reaches(at(run, sel.place).id, sel.place).includes(p)
  const s = (sel?.place === p ? ' sel' : '') + (lit ? ' tgt' : '') + (picking() !== undefined && eventPlaces(run, picking()).includes(p) ? ' over' : '')
  const seat = !still && SEAT[p] ? `position:absolute;left:${SEAT[p][0]}px;top:${SEAT[p][1]}px;` : '', T = still ? 'span' : 'button', act = still ? '' : ` data-act="place" data-arg="${p}"`
  if (!o) return `<${T} class="mini empty${s}" style="${seat}"${act} aria-label="Empty ${p[0] === 'B' ? 'bench spot' : p}">${p[0] === 'B' ? 'EMPTY' : p}</${T}>`
  const c = CARDS[o.id], tag = tagOf(p, o)
  return `<${T} class="mini${s}" style="${seat}border-color:${RAR[c.rarity][0]}"${act} aria-label="${c.name}, level ${o.level}, ${p[0] === 'B' ? 'bench' : p}">
    <span class="lv">LV ${o.level}</span><span class="slot">${p[0] === 'B' ? short(c.pos) : p}</span>${hallCup(mark(o.id))}
    ${art(o.id)}${tag ? `<span class="tag">${TAG[tag][0]}</span>` : ''}
    <span class="pills">${pillRow(...fielded(p))}</span>${seat ? tabs(o.id, p) : ''}
  </${T}>`
}

function boardCard(id, i) {
  if (!id) return '<div class="ph">SIGNED</div>'
  const c = CARDS[id], r = RAR[c.rarity], cost = price(run, id)
  // A card you own a copy of that can still merge glints; one that completes a merge says what it becomes.
  const owned = PLACES.some(p => at(run, p)?.id === id && at(run, p).level < 3), lv = rookies(id) === 2 ? (PLACES.some(p => at(run, p)?.id === id && at(run, p).level === 2) ? 3 : 2) : 0
  return `<button class="bc${sel?.board === i ? ' sel' : ''}${owned ? ' glint' : ''}${cost > run.cash ? ' poor' : ''}" style="border-color:${r[0]};background:${archBg(c, 2, 115)}" data-act="board" data-arg="${i}" aria-label="${c.name}, ${c.rarity} ${c.arch}, ${cost ? '$' + cost : 'free'}${lv ? `, makes level ${lv}` : owned ? ', you have one' : ''}">
    <span class="body">${art(id)}<span class="pills">${pillRow(...solo(c, 1))}</span><span class="pos">${short(c.pos)}</span>${lv ? `<span class="lvup">LV ${lv}</span>` : ''}</span>
    <span class="strip" style="background:${r[1]}"><b>${hallCup(mark(id))}${c.name}</b><span>${cost ? '$' + cost : 'FREE'}</span></span>
  </button>`
}

const zoomable = (id, lv, u, g, sell) => `<button class="zoombtn" data-act="zoom" data-arg="${id}:${lv}" aria-label="Show ${CARDS[id].name} full size">${face(id, lv, u && [u, g], sell)}</button>`
const rookies = id => PLACES.filter(p => at(run, p)?.id === id && at(run, p).level === 1).length

function detail() {
  if (picking() !== undefined) {
    const ev = EVENTS[run.events[0].id]
    return `<section class="panel info"><h2>${ev.name}</h2><p class="res">Tap a player</p><p class="msg">${rich(ev.options[picking()].text)}</p><p class="hint">The players it can go to are lit up.</p></section>
      <button class="act navy" data-act="unpick">BACK TO THE CHOICES</button>`
  }
  if (sel?.item && run.item) {
    const d = ITEMS[run.item], ok = canBuyItem(run), cost = itemPrice(run, run.item)
    return `<div class="zcard">${tile({ ...d, cost })}</div><span class="note${ok ? '' : ' off'}">${ok ? 'ONE ITEM A DAY. IT WORKS RIGHT AWAY' : run.cash < cost ? `CAN'T AFFORD $${cost}` : 'NOTHING FOR IT TO DO RIGHT NOW'}</span>
      <button class="act gold" data-act="buy"${ok ? '' : ' disabled'}>BUY ${cost ? '$' + cost : 'FREE'}</button>`
  }
  if (sel?.board !== undefined) {
    const id = run.board[sel.board], cost = price(run, id), n = rookies(id)
    const hint = n === 2 ? 'SIGN TO MAKE A PRO' : n ? `${n + 1} OF 3 FOR A PRO` : ''
    return `${zoomable(id, 1)}${hint ? `<span class="note">${hint}</span>` : ''}
      <span class="note${cost > run.cash ? ' off' : ''}">${cost > run.cash ? `CAN'T AFFORD $${cost}` : `DRAG ONTO YOUR TEAM TO SIGN ${cost ? '$' + cost : 'FREE'}`}</span>`
  }
  if (sel?.place) {
    const o = at(run, sel.place), tag = tagOf(sel.place, o)
    return `${zoomable(o.id, o.level, ...fielded(sel.place), releaseValue(o))}${tag ? `<span class="note off">${TAG[tag][1]}</span>` : '<span class="note">DRAG TO ANOTHER SPOT TO MOVE</span>'}
      <span class="note">DROP ON THE SHOP ROW TO RELEASE +$${releaseValue(o)}</span>`
  }
  const L = run.last
  return `<section class="panel info"><h2>${L ? 'Last game' : 'Day 1'}</h2>
    ${L ? `<p class="res ${L.won ? 'won' : 'lost'}">Day ${L.day}: ${L.won ? 'won' : 'lost'} ${L.score[0]}–${L.score[1]}${L.ot ? ' in OT' : ''}</p>
      ${L.cost ? `<p class="cost">Owner patience −${L.cost}</p>` : ''}
      ${L.vote ? '<p class="vote">Vote of confidence: patience back to 1. One more chance.</p>' : ''}`
    : '<p class="res">Welcome, coach</p><p class="msg">Sign a goalie and some skaters, then drop the puck. Win 10 games before the owner runs out of patience.</p>'}
    <p class="hint">Tap a card for full details. Drag a scouted player onto your team to sign them, or drag your players to move them, or onto the shop row to release them.</p></section>
    ${L?.box ? '<button class="act navy" data-act="laststats">STATS</button>' : ''}`
}

// --- Screens ---

const heart = (w, fill = '#ff3b4a') => `<svg width="${w}" height="${Math.round(w * 7 / 8)}" viewBox="0 0 8 7" shape-rendering="crispEdges" aria-hidden="true"><path d="M1 0h2v1h2V0h2v1h1v3H7v1H6v1H5v1H3V6H2V5H1V4H0V1h1z" fill="${fill}"/></svg>`
const HEART = heart(32)
const cup = (n, fill = '#ffc43d') => `<svg width="${n}" height="${n}" viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true"><path d="M1 0h6v1h1v2H7v1H6v1H5v1h1v1h1v1H1V7h1V6h1V5H2V4H1V3H0V1h1zM1 1v2h1V1zM6 1v2h1V1z" fill="${fill}" fill-rule="evenodd"/></svg>`
// The Hall of Fame mark on a player: silver once they won a cup, gold once one was won with them as a Star. n is
// hall[id][1] ? 2 : 1, or 0 for none.
const hallCup = n => n ? `<span class="hc">${cup(13, n > 1 ? '#ffc43d' : '#d5dde5')}</span>` : ''
const mark = id => hall[id] ? (hall[id][1] ? 2 : 1) : 0
const LOCK = '<svg width="16" height="18" viewBox="0 0 8 9" shape-rendering="crispEdges" aria-hidden="true"><path d="M2 0h4v1h1v3h1v5H0V4h1V1h1zM2 1v3h4V1z" fill="currentColor" fill-rule="evenodd"/></svg>'
// Full screen only where the browser (and, in an iframe, the host page) allows it. CSS picks the icon by :fullscreen.
const FS = document.fullscreenEnabled ? '<button class="iconbtn fs" data-act="fs" aria-label="Toggle full screen"><svg class="in" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9db1c8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg><svg class="out" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9db1c8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5"/></svg></button>' : ''
const EXIT = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ff6b75" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9"/></svg>'
const DECO = `<div class="deco" style="left:1060px;top:150px;width:200px;height:200px;border-radius:50%;border:10px solid rgba(255,255,255,.06)"></div>
  <div class="deco" style="left:1150px;top:240px;width:20px;height:20px;border-radius:50%;background:rgba(212,32,44,.35)"></div>
  <div class="deco" style="left:640px;top:0;width:6px;height:720px;background:rgba(212,32,44,.22)"></div>`

const QUIT = `<div class="modal"><div class="dialog" role="dialog" aria-modal="true" aria-labelledby="qh"><h2 id="qh">QUIT THIS RUN?</h2>
    <p>Your save is cleared and you go back to the main menu. This can't be undone.</p>
    <div class="btns"><button class="big navy" data-act="quitno">KEEP PLAYING</button><button class="big red" data-act="quityes">QUIT RUN</button></div></div></div>`

// The title: PLAY, or CONTINUE and NEW RUN when there is a run, with the account in the bottom right corner.
const HOME_DECO = `<div class="deco" style="left:440px;top:160px;width:400px;height:400px;border-radius:50%;border:10px solid rgba(255,255,255,.06)"></div>
  <div class="deco" style="left:0;top:357px;width:1280px;height:6px;background:rgba(212,32,44,.22)"></div>
  <div class="deco" style="left:20px;top:20px;width:200px;height:200px;border-radius:50%;border:10px solid rgba(255,255,255,.05)"></div>
  <div class="deco" style="left:1060px;top:500px;width:200px;height:200px;border-radius:50%;border:10px solid rgba(255,255,255,.05)"></div>`
const GOOGLE = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>'
const esc = t => String(t).replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`)
// Who is signed in, or the button. One piece, so a settings menu can show it too.
function accountHTML() {
  const u = user(), name = u && (firstName() || 'you')
  if (u) return `<div class="acct"><span class="av">${esc(name[0].toUpperCase())}</span><span>Signed in as ${esc(name)}</span><button data-act="signout">Sign out</button></div>
    <button class="switch" role="switch" aria-checked="${flag('hab-showname')}" data-act="showname"><i></i>Show my name to opponents</button>`
  return loaded() ? `<button class="gsi" data-act="signin">${GOOGLE}<span>Sign in with Google</span></button><p class="cap">Optional. Keep your progress on <b>any device</b>.</p>` : ''
}
const homeHTML = () => `${HOME_DECO}${FS && '<p class="fscall">Tap for full screen</p>'}
  <h1 class="logo">HOCKEY<br>AUTO BATTLER</h1>
  <p class="sub">Win 10 games before the owner runs out of patience.</p>
  <div class="stack">${loading ? '<p class="cap">Loading…</p>' : run
    ? `<button class="big gold go" data-act="go">CONTINUE<small>${PACKS[PACK].name} · ${run.over ? 'Season over' : `Day ${run.day} · ${run.wins}/10 wins`}</small></button><button class="big navy again" data-act="quit">NEW RUN</button>${HOF_BTN}`
    : `<button class="big red go" data-act="go">PLAY</button>${HOF_BTN}`}</div>
  ${loading ? '' : `<div class="corner">${accountHTML()}</div>`}
  ${quitting ? QUIT : ''}`
const HOF_BTN = '<button class="big navy again hofbtn" data-act="hof">HALL OF FAME</button>'

// The Hall of Fame: the eight players with the most cups hang as banners (the rarer card first on a tie), over every
// card by archetype, grey until it wins a cup and gold once it won one at level 3 or more. One pack at a time: it opens
// on the pack being played, and ‹ › step through the others, the dots counting them.
function hallHTML() {
  const CARDS = PACKS[hof].cards, hall = hallOf(hof), packs = Object.keys(PACKS)
  const ids = Object.keys(CARDS), won = ids.filter(id => hall[id]), stars = won.filter(id => hall[id][1]).length, rows = {}
  // Goalies sharing the skaters' archetypes (pack two) get their own last row; pack one's goalie archetypes keep theirs.
  const own = id => CARDS[id].pos === 'G' && ids.some(o => CARDS[o].pos !== 'G' && CARDS[o].arch === CARDS[id].arch)
  for (const id of ids) if (!own(id)) (rows[CARDS[id].arch] ??= []).push(id)
  if (ids.some(own)) rows.Goalies = ids.filter(own)
  const top = won.sort((a, b) => hall[b][0] - hall[a][0] || RARITIES.indexOf(CARDS[b].rarity) - RARITIES.indexOf(CARDS[a].rarity)).slice(0, 8)
  const step = packs.length < 2 ? '' : `<div class="step"><button class="arr" data-act="hofstep" data-arg="-1" aria-label="Previous pack">‹</button>
    <div class="pname"><b>${PACKS[hof].name}</b><span class="dots" aria-label="Pack ${packs.indexOf(hof) + 1} of ${packs.length}">${packs.map(n => `<i${n === hof ? ' class="on"' : ''}></i>`).join('')}</span></div>
    <button class="arr" data-act="hofstep" data-arg="1" aria-label="Next pack">›</button></div>`
  const tile = id => {
    const c = CARDS[id], [cups, gold] = hall[id] ?? [], [first, ...rest] = c.name.split(' ')
    return `<button class="ht${!cups ? ' no' : gold ? ' gold' : ''}" style="border-color:${RAR[c.rarity][0]}" data-act="zoom" data-arg="${id}:1" aria-label="${c.name}, ${cups ? `${cups} cup${cups > 1 ? 's' : ''}${gold ? ', one as a Star' : ''}` : 'no cup yet'}">${art(id)}
      <span class="nm">${first}<b>${rest.join(' ')}</b></span>${cups ? `${gold ? '<span class="st">★★★</span>' : ''}<span class="cups">${hallCup(gold ? 2 : 1)}${cups > 1 ? '×' + cups : ''}</span>` : ''}</button>`
  }
  return `<div class="top"><h1>HALL OF FAME</h1>${step}
    <div class="count"><span aria-label="${won.length} of ${ids.length} players have won a cup">${cup(22)}${won.length}/${ids.length}</span><span class="g" aria-label="${stars} won as a Star">★★★ ${stars}</span></div>
    <button class="iconbtn" data-act="nohof" aria-label="Back to the title">${EXIT}</button></div>
  <div class="rafters">${top.length ? top.map(id => `<button class="bn" style="--rc:${archBg(CARDS[id])}" data-act="zoom" data-arg="${id}:1" aria-label="${CARDS[id].name}, ${hall[id][0]} cups">${art(id)}<b>${CARDS[id].name.split(' ').slice(1).join(' ') || CARDS[id].name}</b><i>${cup(18)}×${hall[id][0]}</i></button>`).join('')
    : '<p>Win the cup and the players in your final game hang their banners here.</p>'}</div>
  <div class="grid">${Object.entries(rows).map(([a, list]) => `<div class="row"><div class="arch" style="background:${ARCH[a]?.[0] ?? '#1b7a43'}">${a}<small>${list.filter(id => hall[id]).length}/${list.length} won</small></div><div class="cards">${list.map(tile).join('')}</div></div>`).join('')}</div>
  ${zoom ? zoomHTML(zoom) : ''}`
}

const packHTML = () => `${DECO}
  <h1 class="title">HOCKEY AUTO BATTLER</h1>
  <h2 class="label up">PICK YOUR PACK</h2>
  <div class="packs">${Object.entries(PACKS).map(([n, p]) => `<button data-act="pack" data-arg="${n}"><span class="pf">${art(p.face)}</span><span class="pn">${p.name}</span></button>`).join('')}</div>`

const pickHTML = () => `${DECO}
  <h1 class="title">HOCKEY AUTO BATTLER</h1>
  <p class="sub">Sign players, set your lines, then watch them play. Win 10 games before the owner runs out of patience.</p>
  <h2 class="label">PICK YOUR COACH</h2>
  <div class="coaches">${offerCoaches().map(id => [id, COACHES[id]]).map(([id, c]) => `<button class="coach" data-act="coach" data-arg="${id}">
    <span class="ch">${c.name}</span><span class="frame">${art(id)}</span><span class="txt"><span>${rich(c.text)}</span></span></button>`).join('')}</div>`

function shopHTML() {
  const coach = COACHES[run.coach], g = run.lineup.G, goalie = g && CARDS[g.id].pos === 'G'
  const net = goalie ? CARDS[g.id].composure * mult(g.level) : EMPTY_NET, free = run.freeRescouts
  return `${DECO}
  <header class="topbar">
    <div class="left"><span class="brand">HOCKEY<br>AUTO BATTLER</span></div>
    <div class="mid">
      <div class="stat" aria-label="Patience ${run.patience} of 10">${HEART}<span>${run.patience}</span></div>
      <span class="day">DAY ${run.day}</span>
      <div class="stat wins" aria-label="Wins ${run.wins} of 10">${cup(30)}<span>${run.wins}/10</span></div>
      <button class="iconbtn bagbtn" data-act="bag" aria-label="Team bag, ${run.gear.length} gear"><span class="gi">${icon('bag')}</span><span>${run.gear.length}</span></button>
    </div>
    <div class="right"><button class="iconbtn" data-act="menu" aria-label="Main menu">${EXIT}</button></div>
  </header>
  <section class="panel coachp"><h2>${coach.name}</h2><div class="frame">${art(run.coach)}</div><p class="txt"><span>${rich(coach.text)}</span></p></section>
  <div class="netbar${goalie ? '' : ' empty'}" aria-label="Net meter ${net}"><span>NET</span><b>${goalie ? net : `EMPTY NET ${net}`}</b></div>
  <section class="panel team"><h2 class="red">MY TEAM</h2><div class="boards">${BENCH.map(mini).join('')}<span class="blabel">BENCH</span></div>
    <div class="ice">${ICE}${Object.keys(SEAT).map(mini).join('')}</div></section>
  <div class="odds" aria-label="Scouting odds"><b>${TIERS[run.tier - 1]}</b>${ODDS[run.tier - 1].map((pct, i) => `<span style="color:${RAR[RARITIES[i]][3]}" title="${RARITIES[i]}"><i style="background:${RAR[RARITIES[i]][0]}"></i>${pct}%</span>`).join('')}</div>
  <div class="cash" aria-label="Cash ${run.cash} dollars, ${income(run)} more tomorrow">$${run.cash}<small>+$${income(run)}</small></div>
  <button class="lock${run.locked ? ' on' : ''}" data-act="lock" aria-pressed="${!!run.locked}">${LOCK}<span>${run.locked ? 'SHOP LOCKED' : 'LOCK SHOP'}</span></button>
  <section class="panel shoprow${run.locked ? ' locked' : ''}">${run.board.map(boardCard).join('')}${itemCard()}<div class="sellzone" data-arg="sell"></div></section>
  <button class="big gold rescout" data-act="rescout"><span>RE-SCOUT</span><b>${free ? `FREE ×${free}` : '$' + rescoutCost(run)}</b></button>
  <button class="big red puck" data-act="play"${waiting ? ' disabled' : ''}><span>${waiting ? 'FINDING AN' : 'DROP THE'}</span><span>${waiting ? 'OPPONENT' : 'PUCK!'}</span></button>
  <div class="detail">${detail()}</div>
  ${zoom ? zoomHTML(zoom) : ''}
  ${bagOpen ? bagHTML() : ''}
  ${lastStats && run.last?.box ? statsHTML(run.last.box, run.last.names, 'nolast', 'Close') : ''}
  ${run.offer ? offerHTML(run.offer) : run.events?.length && picking() === undefined ? eventHTML(run.events[0]) : ''}`
}

// The season box score: the record and the dressed six on a board, every game as a strip, three sheets, then the equipment.
const AWARDS = [['Top scorer', 'goal', 'goals', 'Nobody scored'], ['The wall', 'block', 'blocked', 'Nobody blocked a shot'], ['Enforcer', 'hit', 'rattled', 'Nobody rattled anyone']]
function endHTML() {
  const games = run.games, won = g => g[0] > g[1], w = games.filter(won).length, l = games.length - w
  const sum = i => games.reduce((n, g) => n + g[i], 0), ot = games.filter(g => g[2]), otw = ot.filter(won).length
  let streak = 0, best = 0
  for (const g of games) { streak = won(g) ? streak + 1 : 0; best = Math.max(best, streak) }
  const bigI = games.reduce((bi, g, i) => (won(g) && (bi < 0 || g[0] - g[1] > games[bi][0] - games[bi][1]) ? i : bi), -1)
  const counts = [...run.gear.reduce((m, id) => m.set(id, (m.get(id) ?? 0) + 1), new Map())]
  const row = (label, n, red) => `<div>${label}<b${red ? ' class="red"' : ''}>${n}</b></div>`
  const award = ([what, type, unit, none]) => {
    const [id, n] = Object.entries(run.tally).reduce((top, [id, t]) => ((t[type] ?? 0) > top[1] ? [id, t[type]] : top), [null, 0])
    return id ? `<div class="award">${art(id)}<div class="t"><span>${what}</span><b>${CARDS[id].name}</b></div><span class="n">${n}<small>${unit}</small></span></div>`
      : `<div class="award none"><span class="art"></span><div class="t"><span>${what}</span><b>${none}</b></div></div>`
  }
  return `<header class="topbar">
    <div class="left"><div class="ctag">${art(run.coach)}<b>${COACHES[run.coach].name}</b></div></div>
    <div class="mid">
      <div class="stat" aria-label="Patience ${run.patience} of 10">${HEART}<span>${run.patience}</span></div>
      <span class="day">DAY ${run.day}</span>
      <div class="stat wins" aria-label="Wins ${run.wins} of 10">${cup(30)}<span>${run.wins}/10</span></div>
    </div>
    <div class="right"><b>SEASON OVER</b></div>
  </header>
  <div class="board">
    <div class="rec"><span>Final record</span><b>${w} – ${l}</b></div>
    <div class="six">${['LW', 'C', 'RW', 'LD', 'RD', 'G'].map(p => mini(p, true)).join('')}</div>
    <div class="badge${run.won ? '' : ' lost'}">${run.won ? cup(30) + 'CUP WON' : 'RUN OVER'}</div>
  </div>
  <div class="games">${games.map((g, i) => `<div class="${won(g) ? 'w' : 'l'}"><small>Day ${i + 1}</small><b>${won(g) ? 'W' : 'L'}</b><span>${g[0]}–${g[1]}</span>${g[2] ? '<em>OT</em>' : ''}</div>`).join('')}</div>
  <section class="panel sheet" style="left:24px"><h2>ON THE ICE</h2><div class="rows">
    ${row('Goals for', sum(0))}${row('Goals against', sum(1), true)}${row('Overtime record', `${otw}–${ot.length - otw}`)}
    ${row('Longest win streak', best)}${row('Biggest win', bigI < 0 ? 'None' : `${games[bigI][0]}–${games[bigI][1]} · day ${bigI + 1}`)}</div></section>
  <section class="panel sheet" style="left:440px"><h2>FRONT OFFICE</h2><div class="rows">
    ${row('Players signed', run.signed)}${row('Level-ups', run.levelUps)}${row('Re-scouts', run.rescouts)}
    ${row('Cash earned', '$' + earned(run))}${row('Cash spent', '$' + run.spent, true)}${row('Scouting reached', TIERS[run.tier - 1])}</div></section>
  <section class="panel sheet" style="left:856px"><h2 class="red">AWARDS</h2><div class="list">${AWARDS.map(award).join('')}</div></section>
  <button class="panel kit${counts.length > 12 ? ' many' : ''}" data-act="bag" aria-label="Equipment, ${run.gear.length} pieces. Open the team bag"><span class="h">EQUIPMENT · ${run.gear.length}</span>
    <span class="chips">${counts.map(([id, n]) => { const d = GEAR[id], r = RAR[d.rarity]; return `<span><span class="gear" style="--r:${r[0]};--rs:${r[1]}"><span class="gi">${icon(d.icon)}</span>${n > 1 ? `<i>×${n}</i>` : ''}</span><span class="nm">${d.name}</span></span>` }).join('') || '<span class="none">No equipment this run.</span>'}</span></button>
  <button class="big red newrun" data-act="newrun">MAIN MENU</button>
  ${bagOpen ? bagHTML() : ''}`
}

// --- Battle ---

const TREES = [[-20, 70, 100], [40, 50, 120], [105, 80, 90], [160, 40, 130], [230, 75, 95], [290, 55, 115], [470, 70, 100], [800, 60, 110], [990, 45, 125], [1050, 80, 90], [1110, 50, 120], [1175, 70, 100], [1230, 40, 130]]
const SNOW = [[60, 30, 4], [210, 128, 3], [330, 20, 5], [470, 140, 3], [610, 132, 4], [700, 136, 3], [860, 126, 5], [960, 132, 3], [1210, 20, 4], [1150, 140, 3], [20, 300, 4], [1255, 420, 5], [25, 560, 3], [1250, 600, 4], [300, 640, 3], [800, 700, 4], [960, 650, 3], [520, 690, 4]]
const RINK = `<div class="sky"></div>
  ${TREES.map(([x, y, h]) => `<div class="tree" style="left:${x}px;top:${y + 40 - (h - 100)}px;width:${Math.round(h * 0.62)}px;height:${h}px"><i></i><i></i><i></i></div>`).join('')}
  ${SNOW.map(([x, y, s]) => `<div class="flake" style="left:${x}px;top:${y}px;width:${s}px;height:${s}px"></div>`).join('')}
  <div class="rink">
    <i style="left:589px;top:0;width:6px;height:100%;background:rgba(212,32,44,.6)"></i>
    <i style="left:542px;top:172px;width:100px;height:100px;border-radius:50%;border:3px solid rgba(27,79,160,.35)"></i>
    <i style="left:442px;top:0;width:10px;height:100%;background:rgba(27,79,160,.55)"></i>
    <i style="left:742px;top:0;width:10px;height:100%;background:rgba(27,79,160,.55)"></i>
    <i style="left:58px;top:0;width:3px;height:100%;background:rgba(212,32,44,.5)"></i>
    <i style="left:1123px;top:0;width:3px;height:100%;background:rgba(212,32,44,.5)"></i>
    <i style="left:61px;top:192px;width:30px;height:60px;border-radius:0 30px 30px 0;background:#bfe0f5"></i>
    <i style="left:1093px;top:192px;width:30px;height:60px;border-radius:30px 0 0 30px;background:#bfe0f5"></i>
    <i style="left:36px;top:206px;width:22px;height:32px;border:3px solid #d4202c;border-right:0;background:repeating-linear-gradient(0deg,transparent 0 4px,rgba(20,20,31,.15) 4px 5px)"></i>
    <i style="left:1126px;top:206px;width:22px;height:32px;border:3px solid #d4202c;border-left:0;background:repeating-linear-gradient(0deg,transparent 0 4px,rgba(20,20,31,.15) 4px 5px)"></i>
    ${[[187, 125], [187, 325], [1003, 125], [1003, 325]].map(([x, y]) => circle(x, y, 47)).join('')}
  </div>`

const unitHTML = u => {
  const [x, y] = SPOT[u.side][u.slot]
  return `<button class="unit s${u.side}" id="u${u.side}${u.slot}" style="left:${x - 48}px;top:${y - 56}px" data-act="peek" data-arg="${u.side}${u.slot}" aria-label="${u.card.name}, ${u.slot}, level ${u.level}, ${u.side ? 'ghost' : 'yours'}">
    <i class="ring"></i><span class="lv">LV ${u.level}</span>${hallCup(u.side ? B.cups[idOf.get(u.card)] : mark(idOf.get(u.card)))}<span class="cd"><i></i></span>
    ${art(idOf.get(u.card))}<span class="pills">${pillRow(u, B.g)}</span><span class="inbox">IN<br>BOX</span>
  </button>`
}

// A tapped unit's card opens over the other half of the rink, so the unit stays in view. Any tap on it closes it.
const peekHTML = u => {
  const note = u.slot === 'G' && u.card.pos !== 'G' ? TAG.x[1] : u.off ? TAG.off[1] : ''
  return `<div class="peek s${1 - u.side}" data-act="peek" role="dialog" aria-label="${u.card.name} details">
    <div class="gloss">${gloss(u.card).join('')}</div>
    <div class="zcol">${face(idOf.get(u.card), u.level, [u, B.g])}${note ? `<span class="note off">${note}</span>` : ''}<span class="znote">Tap to close</span></div>
  </div>`
}

const hudHTML = side => `<div class="hud s${side}">
  <div class="who"><b>${side ? 'GHOST' : 'YOU'}</b><span>${side ? `${teamName(1)}, day ${run.day}` : teamName(0)}</span></div>
  <div class="meter"><span>NET</span><div class="bar" id="nb${side}"><i id="nf${side}"></i><b id="nn${side}"></b></div><svg class="shield" id="bk${side}" viewBox="0 0 34 38" aria-hidden="true"><path d="M17 2 31 7v11c0 8.5-6.5 15-14 18C9.5 33 3 26.5 3 18V7Z"/><text x="17" y="22"></text></svg></div>
  <div class="chips"><span class="chip" id="pr${side}" style="background:#b34d00"></span><span class="chip" id="rt${side}" style="background:#6f35a8"></span></div>
</div>`

const battleHTML = () => `${RINK}
  ${B.g.teams.flat().map(unitHTML).join('')}
  <div class="layer" id="fx" aria-hidden="true"></div>
  ${hudHTML(0)}${hudHTML(1)}
  <div class="glboard" id="bd0"></div><div class="glboard r" id="bd1"></div>
  <div class="score"><div class="line"><span class="sc" id="s0"></span><div class="mid"><span class="per" id="per"></span><span class="clock" id="clock"></span></div><span class="sc" id="s1"></span></div><span class="pp" id="pp"></span></div>
  <div class="feed" id="feed"></div>
  <div class="pbox"><h2>PENALTY BOX</h2><div id="pbox"></div></div>
  <div class="speed" role="group" aria-label="Playback speed"><button data-act="speed" data-arg="0" aria-pressed="${B.speed === 0}" aria-label="Pause"><svg viewBox="0 0 10 12" width="14" height="17" aria-hidden="true"><path d="M1 0h3v12H1zM6 0h3v12H6z" fill="currentColor"/></svg></button><button data-act="speed" data-arg="1" aria-pressed="${B.speed === 1}" aria-label="Play"><svg viewBox="0 0 10 12" width="14" height="17" aria-hidden="true"><path d="M1 0l9 6-9 6z" fill="currentColor"/></svg></button><button data-act="speed" data-arg="5" aria-pressed="${B.speed === 5}" aria-label="Fast forward"><svg viewBox="0 0 16 12" width="22" height="17" aria-hidden="true"><path d="M0 0l8 6-8 6zM8 0l8 6-8 6z" fill="currentColor"/></svg></button></div>
  <div id="peek"></div>
  <div id="result"></div>`

// The faceoff card: both coaches, their dressed six and a four-row tape, up for five seconds before the puck drops.
// A bot has no coach, so its goalie is the face of the team. The better number on each tape row is lit.
function vsHTML() {
  const g = B.g, v = B.vs, them = v.coach && COACHES[v.coach]
  const six = side => SLOTS.map(s => g.teams[side].find(u => u.slot === s)).filter(Boolean)
  const strip = side => `<div class="dressed ${side ? 'them' : 'you'}">${six(side).map((u, i) => `<span style="--i:${i}">${art(idOf.get(u.card), archBg(u.card, 2, 115))}${u.slot}<b>${u.level}</b></span>`).join('')}</div>`
  const levels = side => six(side).reduce((n, u) => n + u.level, 0)
  const row = (label, a, b, i, lowWins = false) => {
    const lit = a == null || b == null || a === b ? 0 : (a > b) !== lowWins ? 1 : 2
    return `<div style="--i:${i}"><b class="${lit === 1 ? 'lead' : ''}">${a ?? '—'}</b><span>${label}</span><b class="${lit === 2 ? 'lead' : ''}">${b ?? '—'}</b></div>`
  }
  const face = six(1).at(-1)
  return `<div class="vs vs-in" id="vs" data-act="vsskip">
    <div class="ground you"></div><div class="ground them"></div><div class="stripe"></div>
    <div class="plate you">${teamName(0)}</div><div class="mug you">${art(run.coach)}</div>${strip(0)}
    <div class="plate them">${teamName(1)}</div><div class="mug them">${them ? art(v.coach) : face ? art(idOf.get(face.card)) : ''}</div>${strip(1)}
    <div class="burst"><b>VS</b></div>
    <div class="tape">${row('Wins', run.wins, v.wins, 0)}${row('Losses', run.games.filter(([h, a]) => h < a).length, v.wins == null ? null : v.day - 1 - v.wins, 1, true)}${row('Lineup levels', levels(0), levels(1), 2)}${row('Net', g.nets[0].max, g.nets[1].max, 3)}</div>
    <button class="drop" data-act="vsskip" aria-label="Skip to the puck drop"><span>Puck drops in <b id="vsn">${v.n}</b></span><span class="day">Day ${run.day}</span><span>Tap to skip</span></button></div>`
}

// Count the card down, then wipe it and let the clock run. A tap skips straight to the wipe.
function vsTick() {
  const v = B?.vs
  if (!v || v.out) return
  if (v.n <= 0) return vsExit()
  $('vsn').textContent = v.n--
  v.timer = setTimeout(vsTick, 1000)
}
function vsExit() {
  const v = B?.vs
  if (!v || v.out) return
  v.out = true
  clearTimeout(v.timer)
  $('vs').classList.replace('vs-in', 'vs-out')
  setTimeout(() => { if (B?.vs === v) { B.vs = null; $('vs')?.remove() } }, 300)
}

function clock(t, ot) {
  if (ot && t >= REG) return ['OT', ((t - REG) / TPS).toFixed(1)]
  const p = Math.max(1, Math.ceil(t / PERIOD))
  return [ORD[p - 1], ((p * PERIOD - t) / TPS).toFixed(1)]
}
const boxLeft = (g, side) => Math.max(0, ...g.teams[side].filter(u => u.box).map(u => u.box))
const unitOf = (g, e) => g.teams[e.side].find(u => u.slot === e.slot)

function say(g, e) {
  const name = e.slot && unitOf(g, e)?.card.name
  switch (e.type) {
    case 'shot': return [`${name} shoots ${e.amount}${boxLeft(g, 1 - e.side) ? ' on the power play' : ''}`, '#ffb43c']
    case 'goal': return [e.side ? 'Ghost scores' : 'GOAL! You score', '#ffffff']
    case 'penalty': return [`${name} heads to the box`, '#ff8a92']
    case 'gain': return e.perm ? [`${name} +${e.amount} ${e.stat} for keeps`, '#ffd166'] : undefined
    case 'period': return [`End of the ${ORD[e.amount - 1]} period`, '#9db1c8']
    case 'ot': return ['Tied: sudden death. A storm batters both nets until someone scores', '#9db1c8']
  }
}

function pop(text, [x, y], color, cls = '') {
  const el = document.createElement('span')
  el.className = 'pop ' + cls
  el.textContent = text
  el.style.cssText = `left:${x}px;top:${y}px;color:${color}`
  $('fx').append(el)
  el.animate([{ transform: 'translate(-50%, 0)', opacity: 1 }, { transform: 'translate(-50%, -36px)', opacity: 0 }], { duration: 900, easing: 'ease-out' }).onfinish = () => el.remove()
}


// A goal never covers the ice: the boards behind the beaten net flash, the scorer's number on the scoreboard flashes,
// and the scorer's card glows.
const GLOW = '0 0 0 4px #ffc43d, 0 0 22px 8px rgba(255, 196, 61, .9)'
const LIT = { color: '#ffb43c', textShadow: '0 0 8px rgba(255, 180, 60, .55)' }, RED = { color: '#fff', textShadow: '0 0 14px #ff2a35, 0 0 4px #ff2a35' } // a score digit as it rests, and flashed
function goal(side, slot) {
  const net = 1 - side
  $('bd' + net).animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0.25 }, { opacity: 1 }, { opacity: 0 }], { duration: 1200 })
  $('s' + side).animate([LIT, RED, LIT, RED, LIT], { duration: 1000 })
  $('s' + side).animate([{ transform: 'scale(1)' }, { transform: 'scale(1.8)' }, { transform: 'scale(1)' }], { duration: 700, easing: 'ease-out' })
  const x = B.units.find(x => x.u.side === side && x.u.slot === slot)
  if (!x) return // a goal with no shooter (Pressure, the overtime storm)
  x.art.animate([{ boxShadow: GLOW }, { boxShadow: GLOW, offset: 0.6 }, { boxShadow: '0 0 0 0 rgba(255, 196, 61, 0)' }], { duration: 1200 })
  const [cx, cy] = SPOT[side][slot]
  pop('GOAL!', [cx, cy - 80], '#d4202c', 'goal')
}

// Read new log entries: effects and feed lines.
function readLog() {
  const g = B.g
  for (; B.seen < g.log.length; B.seen++) {
    const e = g.log[B.seen]
    if (e.type === 'shot') pop('-' + e.amount, NET_POP[1 - e.side], '#d4202c')
    if (e.type === 'block' || e.type === 'refill') pop('+' + e.amount, HUD_POP[e.side], STAT[e.type][0], 'sm')
    if (e.type === 'goal') goal(e.side, e.slot)
    // A level gained mid-game (Kurrier's center) gets the shop's LEVEL UP! and a new LV tag.
    if (e.type === 'levelup') { const x = B.units.find(x => x.u.side === e.side && x.u.slot === e.slot); if (x) { x.el.querySelector('.lv').textContent = `LV ${x.u.level}`; levelUp(x.el) } }
    const line = say(g, e)
    if (line) B.feed.unshift(`<div><time>${clock(e.t, e.t > REG).join(' ')}</time><i class="s${e.side ?? 2}"></i><span style="color:${line[1]}">${line[0]}</span></div>`)
  }
  B.feed.length = Math.min(B.feed.length, 3)
}

// A unit that acts lunges a step toward the net it attacks.
const BUMP = [18, -18].map(dx => [{ transform: 'translate(0,0)' }, { transform: `translate(${dx}px,-6px) scale(1.08)`, offset: 0.35 }, { transform: 'translate(0,0)' }])

// Events that are the unit doing something, so it glows and lunges. Faceoff, gains, penalties and goals are not.
const ACTS = new Set(['act', 'shot', 'pass', 'block', 'refill', 'pressure', 'hit', 'rebound'])

function draw() {
  const g = B.g, acting = new Set()
  for (let i = g.log.length - 1; i >= 0 && g.log[i].t === g.t; i--) if (ACTS.has(g.log[i].type)) acting.add(g.log[i].side + g.log[i].slot)
  for (const x of B.units) {
    const { u, el, fill } = x, row = pillRow(u, g)
    if (row !== x.row) { x.pills.innerHTML = row; if (x.row !== undefined) statPop(x.pills); x.row = row }
    el.classList.toggle('boxed', u.box > 0)
    el.classList.toggle('acting', acting.has(u.side + u.slot))
    if (acting.has(u.side + u.slot) && x.acted !== g.t) { x.acted = g.t; x.art.animate(BUMP[u.side], { duration: 320, easing: 'ease-out' }) }
    fill.style.height = Math.min(100, Math.max(0, 100 * (1 - u.cd / (every(u, g) * TPS)))) + '%'
  }
  g.nets.forEach((n, side) => {
    const m = Math.max(0, n.meter), f = m / n.max
    const up = n.block > 0 // a shielded net fills blue, with the block count in the shield at the far post
    Object.assign($('nf' + side).style, { width: f * 100 + '%', background: up ? '#3f7fd6' : f > 0.5 ? '#3cc760' : f > 0.25 ? '#ffc43d' : '#ff6b3d' })
    $('nn' + side).textContent = `${m}/${n.max}`
    $('nn' + side).style.color = !up && f >= 0.5 ? '#0f1d30' : '#fff'
    $('nb' + side).classList.toggle('up', up)
    $('bk' + side).classList.toggle('off', !up)
    $('bk' + side).lastElementChild.textContent = n.block || ''
    $('bk' + side).lastElementChild.style.fontSize = n.block > 99 ? '12px' : ''
    $('pr' + side).textContent = `PRESSURE ${n.pressure}`
    $('pr' + side).classList.toggle('off', !n.pressure)
    $('rt' + side).textContent = `RATTLED ${n.rattled}/${n.need}`
    $('rt' + side).classList.toggle('off', !n.rattled)
  })
  const [per, clk] = clock(g.t, g.ot)
  $('s0').textContent = g.score[0]
  $('s1').textContent = g.score[1]
  $('per').textContent = g.over ? (g.ot ? 'FINAL OT' : 'FINAL') : per
  $('clock').textContent = clk
  const b1 = boxLeft(g, 1), b0 = boxLeft(g, 0)
  $('pp').textContent = b1 ? `YOUR POWER PLAY ${(b1 / TPS).toFixed(1)}` : b0 ? `GHOST POWER PLAY ${(b0 / TPS).toFixed(1)}` : ''
  $('pp').style.visibility = (b1 || b0) && !g.over ? '' : 'hidden'
  const boxed = g.teams.flat().filter(u => u.box), ids = boxed.map(u => u.side + u.slot).join()
  if (ids !== B.boxIds) {
    B.boxIds = ids
    $('pbox').className = boxed.length > 1 ? 'many' : ''
    $('pbox').innerHTML = boxed.length
      ? boxed.map(u => `<div class="pb">${art(idOf.get(u.card))}<div><b>${u.card.name.split(' ').pop()}</b><em></em></div></div>`).join('')
      : '<span class="none">EMPTY</span>'
  }
  $('pbox').querySelectorAll('em').forEach((el, i) => (el.innerHTML = (boxed[i].box / TPS).toFixed(1) + '<small>s</small>'))
  const feed = B.feed.join('')
  if (feed !== B.shown) $('feed').innerHTML = B.shown = feed
  const peeked = B.units.find(x => x.u.side + x.u.slot === B.peek), peek = peeked ? peekHTML(peeked.u) : ''
  if (peek !== B.peekShown) $('peek').innerHTML = B.peekShown = peek
}

function frame(now) {
  if (!B || B.done) return
  if (B.vs) return requestAnimationFrame(frame) // the faceoff card is up: hold the clock
  if (B.prev) B.acc += Math.min(250, now - B.prev) * TPS * B.speed / 1000
  B.prev = now
  while (B.acc >= 1 && !B.g.over) { step(B.g); B.acc--; readLog() }
  draw()
  if (B.g.over) finish(1400) // let the last goal play out
  else requestAnimationFrame(frame)
}

// The result card mirrors the faceoff card: the two halves slam back together over the finished rink, the rink's
// scoreboard grows into the middle with the box score under it, and the lineups come back with the three stars badged
// on them. The stakes are pips in the bottom bar: a win lights the next cup, a loss puts out the hearts it costs (the run
// itself changes on CONTINUE). Coming back from the stats keeps it still, and a tap skips to the end.
function resultHTML(g, still) {
  const won = g.winner === 0, cost = won ? 0 : Math.min(lossCost(run), run.patience)
  const sums = tally(g), units = g.teams.flat()
  const total = (side, t) => Math.round(units.reduce((n, u) => n + (u.side === side ? sums.get(u)[t] ?? 0 : 0), 0))
  const inBox = [0, 0], pens = [0, 0], ppg = [0, 0]
  for (const e of g.log) {
    if (e.type === 'penalty') { inBox[e.side]++; pens[e.side]++ }
    else if (e.type === 'return') inBox[e.side]--
    else if (e.type === 'goal' && inBox[1 - e.side] > inBox[e.side]) ppg[e.side]++
  }
  // The tape: Shoot, the three other stats the game used most, then the power play as goals / chances for each side.
  const used = BOX.slice(1).map(([t, label]) => [label, total(0, t), total(1, t)]).sort((a, b) => b[1] + b[2] - a[1] - a[2]).slice(0, 3)
  const rows = [['Shoot', total(0, 'shot'), total(1, 'shot')], ...used].filter(r => r[1] + r[2])
  if (pens[0] + pens[1]) rows.push(['Power play', ppg[0], ppg[1], `${ppg[0]}/${pens[1]}`, `${ppg[1]}/${pens[0]}`])
  const tape = rows.map(([label, a, z, sa = a, sz = z], i) => `<div style="--i:${i}"><b${a > z ? ' class="lead"' : ''}>${sa}</b><span>${label}</span><b${z > a ? ' class="lead"' : ''}>${sz}</b></div>`).join('')
  // ponytail: goals weigh 30 and every other stat point a quarter; retune if the stars feel wrong
  const worth = u => (sums.get(u).goal ?? 0) * 30 + BOX.reduce((n, [t]) => n + (sums.get(u)[t] ?? 0), 0) / 4
  const stars = units.filter(u => worth(u) > 0).sort((a, b) => worth(b) - worth(a)).slice(0, 3)
  const six = side => SLOTS.map(s => g.teams[side].find(u => u.slot === s)).filter(Boolean)
  const strip = side => `<div class="dressed ${side ? 'them' : 'you'}">${six(side).map((u, i) => {
    const r = stars.indexOf(u) + 1, goals = sums.get(u).goal
    return `<span class="${r ? `star r${r}` : 'quiet'}" style="--i:${i}">${r ? `<em>★${r}</em>` : ''}${art(idOf.get(u.card), archBg(u.card, 2, 115))}${u.slot}<b>${goals ? `${goals} G` : '&nbsp;'}</b></span>`
  }).join('')}</div>`
  const face = six(1).at(-1)
  const row = (label, svg, lit, hot, cls) => `<div class="prow${label === 'WINS' ? '' : ' hp'}${hot ? ' hot' : ''}" aria-label="${label} ${lit} of 10"><span>${label}</span>${Array.from({ length: 10 }, (_, i) => `<i class="pip${i < lit ? ' on' : ''}${cls(i)}" style="--d:${run.patience - 1 - i}">${svg}</i>`).join('')}</div>`
  // The board and the tape stand as one column, centred between the coach plates (bottom 120) and the bar (top 604); the
  // board grows out of the rink scoreboard (top 10).
  const top = 120 + Math.round((484 - (244 + 18 + rows.length * 44 - 4)) / 2)
  // The stars come after the stakes: once the new cup has landed, or the last lost heart has gone grey.
  const starsAt = 1150 + (won ? 600 : (cost - 1) * 260 + 700)
  return `<div class="result fin${still ? ' still' : ''}" role="dialog" aria-labelledby="rt"><div class="vs final${still ? '' : ' fin-in'}" data-act="finskip" style="--s:${starsAt}ms">
    <div class="ground you"></div><div class="ground them"></div><div class="stripe"></div>
    <div class="plate you">${teamName(0)}</div><div class="mug you${won ? '' : ' lose'}">${art(run.coach)}</div>${strip(0)}
    <div class="plate them">${teamName(1)}</div><div class="mug them${won ? ' lose' : ''}">${B.coach ? art(B.coach) : face ? art(idOf.get(face.card)) : ''}</div>${strip(1)}
    <div class="board" style="top:${top}px;--gy:${10 - top}px"><h2 id="rt" class="${won ? '' : 'lost'}">${won ? 'WIN' : 'LOSS'}</h2>${g.ot ? '<span>OVERTIME</span>' : ''}<b style="font-size:${[72, 72, 72, 64, 54, 44][String(g.score[0]).length + String(g.score[1]).length] ?? 38}px">${g.score[0]}<i>–</i>${g.score[1]}</b>
      <div class="pips">${row('WINS', cup(20, 'currentColor'), run.wins + (won ? 1 : 0), won, i => won && i === run.wins ? ' new' : '')}
      ${row('PATIENCE', heart(20, 'currentColor'), run.patience, !won, i => i >= run.patience - cost && i < run.patience ? ' dying' : '')}</div></div>
    <div class="tape" style="top:${top + 262}px">${tape}</div>
    <div class="bar"><button class="big navy hide" data-act="finhide" aria-pressed="false">HIDE</button><button class="big navy" data-act="replay">REPLAY</button><button class="big navy" data-act="stats">STATS</button><button class="big red" data-act="cont">CONTINUE</button></div></div></div>`
}

// A shown player name takes the coach's place, on both sides. Names come from other players, so they are escaped.
const teamName = side => esc(side ? B.name ?? B.ghost ?? 'Bot team' : myName() ?? COACHES[run.coach].name)

// Every player's totals by log type: goals and acts count once, everything else adds its amount.
function tally(g) {
  const sums = new Map(g.teams.flat().map(u => [u, {}]))
  for (const e of g.log) {
    const s = e.slot && sums.get(unitOf(g, e))
    if (s) s[e.type] = (s[e.type] ?? 0) + (e.type === 'act' || e.type === 'goal' ? 1 : e.amount ?? 0)
  }
  return sums
}
const BOX = [['shot', 'Shoot'], ['pass', 'Pass'], ['block', 'Block'], ['refill', 'Refill'], ['pressure', 'Pressure'], ['hit', 'Rattle']]

// What every player did, totalled from the game log.
const TALLY = [
  ['shot', 'shoot', n => `Shot ${n}`], ['goal', 'net', n => `Scored ${n} goal${n > 1 ? 's' : ''}`], ['pass', 'pass', n => `Passed +${n}`],
  ['block', 'block', n => `Blocked ${n}`], ['refill', 'refill', n => `Refilled ${n}`], ['pressure', 'pressure', n => `Pressure ${n}`],
  ['hit', 'rattle', n => `Rattled ${n}`], ['rebound', 'rebound', n => `Rebounded ${n}x`], ['act', 'haste', n => `Acted ${n} time${n > 1 ? 's' : ''}`],
]
function statLines(sum) {
  const lines = TALLY.filter(([t]) => sum[t]).map(([t, stat, text]) => `<span style="color:${STAT[stat][0]}">${text(sum[t])}</span>`)
  return lines.join('') || '<span class="none">Did nothing</span>'
}
// Each side's players as [id, totals], which the run keeps as the last game's box score.
const boxOf = g => { const sums = tally(g); return g.teams.map(t => t.map(u => [idOf.get(u.card), sums.get(u)])) }
const statsHTML = (box, names, back, label) => `<div class="result"><div class="boxscore" role="dialog" aria-labelledby="sh"><h2 id="sh">STATS<button class="x" data-act="${back}" aria-label="${label}">✕</button></h2>
  ${box.map((team, side) => `<section><h3${side ? ' class="red"' : ''}>${names[side]}</h3><div class="tiles">${team.map(([id, sum]) => `<div class="tile">${art(id)}<div class="lines"><b>${CARDS[id].name}</b>${statLines(sum)}</div></div>`).join('')}</div></section>`).join('')}
</div></div>`

function finish(delay) {
  B.done = true
  setTimeout(() => {
    $('result').innerHTML = resultHTML(B.g)
    $('result').querySelector('.red').focus({ preventScroll: true })
  }, delay)
}

function bindBattle() {
  B.units = B.g.teams.flat().map(u => {
    const el = $(`u${u.side}${u.slot}`)
    return { u, el, fill: el.querySelector('.cd i'), pills: el.querySelector('.pills'), art: el.querySelector('.art') }
  })
  draw()
}

// --- Taps ---

function toast(text) {
  const el = $('toast')
  el.textContent = text
  el.getAnimations().forEach(a => a.cancel())
  el.animate([{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }], { duration: 2400 })
}

const ACT = {
  coach: id => { run = newRun(id, Date.now()); offered = null; try { localStorage.removeItem(OFFER) } catch {} push(run) },
  // A tap on a card puts it up in the detail panel (tap again to close); the big card there opens it full size.
  board: i => { sel = sel?.board === +i && !mouse ? null : { board: +i } },
  item: () => { sel = sel?.item && !mouse ? null : { item: true } },
  buy: () => { if (buyItem(run)) sel = null },
  bag: () => { bagOpen = true },
  nobag: () => { bagOpen = false },
  openbag: () => { if (performance.now() < settle) played = run.offer; opened = run.offer },
  pick: i => {
    flying = [...app.querySelectorAll(run.offer.all ? '.gtb' : `.gtb[data-arg="${i}"]`)].map(b => ({ html: b.innerHTML, r: b.getBoundingClientRect() }))
    pickGear(run, +i)
  },
  // An event option that asks for a player closes the screen and lights up the players it can go to.
  event: i => { if (eventPlaces(run, +i)?.length) run.events[0].picking = +i; else chooseEvent(run, +i) },
  unpick: () => { delete run.events[0].picking },
  place: p => {
    if (picking() !== undefined) { if (!chooseEvent(run, picking(), p)) toast('Tap one of the lit-up players.'); sel = null; return }
    sel = at(run, p) && !(sel?.place === p && !mouse) ? { place: p } : null
  },
  lock: () => toggleLock(run),
  rescout: () => {
    if (!rescout(run)) return toast(`Can't afford a re-scout: $${rescoutCost(run)}.`)
    if (sel?.board !== undefined) sel = null
  },
  zoom: arg => { const [id, lv] = arg.split(':'); zoom = { id, lv: +lv } },
  lv: n => { zoom.lv = +n },
  unzoom: () => { zoom = null },
  hof: () => { hof = PACK },
  hofstep: d => { const packs = Object.keys(PACKS); hof = packs[(packs.indexOf(hof) + +d + packs.length) % packs.length] },
  nohof: () => { hof = null },
  menu: () => { title = true; sel = null },
  laststats: () => { lastStats = true },
  nolast: () => { lastStats = false },
  quit: () => { quitting = true },
  quitno: () => { quitting = false },
  quityes: () => { run = null; sel = null; quitting = false; title = true; push(null) },
  // The opponent comes from the ghost pool (or is a bot), so the puck drops once it is in hand. The click handler has
  // rendered the waiting shop by then; this renders the battle. Going to the menu while waiting drops the opponent, and the run is as it was.
  play: async () => {
    if (run.offer || run.events?.length || waiting) return
    waiting = true
    const r = run.r, ghost = await opponent(run, pid(), DB, await signed(), hall)
    const name = ghost.rec?.uid ? await nameOf(ghost.rec.uid) : null
    waiting = false
    if (!run || B || title) return
    const { seed } = startGame(run, ghost.lineup)
    run.match = { r, seed, ghost: ghost.rec ?? null, name: name ?? null }
    sel = null
    save()
    resume()
  },
  // The result remembers who it was against; a run that ends goes to the run log.
  cont: () => { finishDay(run, B.g); Object.assign(run.last, { vs: B.ghost ? 'ghost' : 'bot', box: boxOf(B.g), names: [teamName(0), teamName(1)] }); run.match = null; if (run.over) post(`runs/${FOLDER}`, ending(run, pid())); if (run.won) { induct(hall, B.g); saveHall() } B = null; push(run) },
  newrun: () => { run = null; title = true; push(null) },
  // Signing in takes the account's run, and the device's waits for the sign out; an account without one takes the
  // device's run over, so it never exists twice. An unreachable account is a failed sign-in.
  signin: () => signIn().then(async u => {
    const saved = await pull(u)
    if (saved === undefined) { signOut(); throw new Error('unreachable') }
    flag('hab-signed', true)
    syncShown(u)
    if (saved) adopt(saved)
    else if (run) { push(run); try { localStorage.removeItem(KEY) } catch {} save() }
    await pullHall(u)
    if (title) render()
  }).catch(e => { if (e?.code !== 'auth/popup-closed-by-user') toast("Couldn't sign in") }),
  showname: () => { const on = !flag('hab-showname'); flag('hab-showname', on); setName(on ? firstName() : null) },
  signout: () => { flag('hab-signed', false); flag('hab-showname', false); adopt(load()); hall = loadHall(); hallSigned = false; hof = null; signOut().finally(() => title && render()) },
}
// Battle controls redraw in place instead of re-rendering the screen.
const LIVE = {
  // No render: CSS swaps the icon by :fullscreen.
  fs: () => { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {}) },
  pack: n => {
    if (n === PACK) { packing = false; return render() }
    try { sessionStorage.setItem('hab-pick', '1') } catch {}
    location.assign(packURL(n)) // the picker stays up until the other pack loads
  },
  // Into the game: the shop or the season, or the game that was on, replayed. A save from an older build can reference
  // cards that no longer exist; start fresh instead of crashing.
  go: () => { title = false; if (!run) { packing = true; return render() } try { run?.match ? resume() : render() } catch (err) { console.error(err); run = null; save(); render() } },
  finskip: () => $('result').querySelector('.fin-in')?.getAnimations({ subtree: true }).forEach(a => a.finish()),
  // HIDE takes the card away, all but its bar, to show the rink as the game ended; SHOW brings it back.
  finhide: () => { const f = $('result').querySelector('.final'), b = f.querySelector('.hide'), hid = f.classList.toggle('hid'); b.textContent = hid ? 'SHOW' : 'HIDE'; b.setAttribute('aria-pressed', hid) },
  stats: () => { $('result').innerHTML = statsHTML(boxOf(B.g), [teamName(0), teamName(1)], 'nostats', 'Back to the result'); $('result').querySelector('.x').focus() },
  nostats: () => { $('result').innerHTML = resultHTML(B.g, true); $('result').querySelector('.red').focus({ preventScroll: true }) },
  // The same matchup and seed play the same game again, straight from the puck drop.
  replay: () => { matchup(); render(); requestAnimationFrame(frame) },
  // Play or fast forward carries over to the next game; a pause does not.
  speed: s => {
    B.speed = +s
    if (B.speed) flag('hab-ff', B.speed === 5)
    app.querySelectorAll('[data-act=speed]').forEach(b => b.setAttribute('aria-pressed', b.dataset.arg === s))
  },
  peek: key => {
    B.peek = key && key !== B.peek ? key : null
    const x = B.units.find(x => x.u.side + x.u.slot === B.peek)
    B.units.forEach(y => y.el.classList.toggle('peeked', y === x))
    draw()
  },
}

// --- Drag: a scouted card onto a spot signs it there, one of yours onto another spot moves it, the item onto the team
// panel buys it. A tap only selects. ---
let drag = null, dropped = -Infinity, mouse = false
const spotAt = (e, d) => document.elementFromPoint(e.clientX, e.clientY)?.closest(d.el.dataset.act === 'item' ? '.team' : '.mini, .sellzone')

function drop(from, to) {
  if (from.act === 'item') {
    if (buyItem(run)) sel = null
    else toast(run.cash < itemPrice(run, run.item) ? `Can't afford ${ITEMS[run.item].name}: $${itemPrice(run, run.item)}.` : 'Nothing for it to do right now.')
    return
  }
  if (from.act === 'board') {
    const i = +from.arg, id = run.board[i], cost = price(run, id)
    if (sign(run, i, to)) sel = null
    else toast(run.cash < cost ? `Can't afford ${CARDS[id].name}: $${cost}.` : !fits(id, to) ? 'Goalies only play in net or sit on the bench.' : 'That spot is taken. Drop on an empty one.')
  } else if (to === 'sell') {
    release(run, from.arg)
    sel = null
  } else if (from.arg !== to) {
    if (move(run, from.arg, to)) sel = null
    else toast('Goalies only play in net or sit on the bench.')
  }
}

app.addEventListener('pointerdown', e => {
  const el = e.target.closest('.bc, .mini:not(.empty)')
  if (el && !B && !zoom && !quitting && e.isPrimary) drag = { el, x: e.clientX, y: e.clientY }
})
addEventListener('pointermove', e => {
  if (!drag) return
  if (!drag.ghost) {
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 8) return
    const r = drag.el.querySelector('.art, .gi').getBoundingClientRect()
    drag.ghost = Object.assign(document.createElement('div'), { className: 'ghost', innerHTML: drag.el.querySelector('.art, .gi').outerHTML })
    drag.ghost.style.width = drag.ghost.style.height = r.width * 1.3 + 'px'
    document.body.append(drag.ghost)
    drag.el.classList.add('lifted')
    if (drag.el.dataset.act === 'place') { // one of your own players is in the air: the shop row becomes a release zone
      app.querySelector('.sellzone').innerHTML = `DRAG HERE TO RELEASE <b>+$${releaseValue(at(run, drag.el.dataset.arg))}</b>`
      app.classList.add('selling')
    }
  }
  drag.ghost.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`
  const over = spotAt(e, drag)
  if (over !== drag.over) {
    drag.over?.classList.remove('over'); over?.classList.add('over'); drag.over = over
    // Held over a seat, the card shows where its pass (or nudge) would go from there.
    const { act, arg } = drag.el.dataset
    light(over?.dataset.act === 'place' && (act === 'board' ? run.board[+arg] : act === 'place' ? at(run, arg)?.id : null), over?.dataset.arg)
  }
})
const endDrag = e => {
  const d = drag
  drag = null
  if (!d?.ghost) return
  d.ghost.remove()
  dropped = performance.now() // swallow the click this pointerup makes
  const to = e.type === 'pointerup' && spotAt(e, d)
  if (to) { drop(d.el.dataset, to.dataset.arg); save() }
  render()
}
addEventListener('pointerup', endDrag)
addEventListener('pointercancel', endDrag)

// With a mouse, pointing at a card is enough to preview it: the panel and the glow update in place, no re-render, and
// a click on the card shown keeps it up after the pointer leaves. Touch keeps tap to show, tap again to close.
app.addEventListener('pointerover', e => {
  mouse = e.pointerType === 'mouse'
  const el = mouse && !drag && run && !B && !run.over && picking() === undefined && e.target.closest('.bc, .mini:not(.empty)')
  if (!el || el.classList.contains('sel')) return
  const { act, arg } = el.dataset
  sel = { ...(act === 'item' ? { item: true } : act === 'board' ? { board: +arg } : { place: arg }), hover: true }
  app.querySelectorAll('.sel').forEach(x => x.classList.remove('sel'))
  el.classList.add('sel')
  light(act === 'place' && at(run, arg)?.id, arg)
  app.querySelector('.detail').innerHTML = detail()
})

// Leaving the card a hover put up brings the last game back; a clicked card stays up (the item's BUY lives there).
// The wait lets the pointer cross to the next card without the last game flashing up in between.
app.addEventListener('pointerout', e => {
  const el = sel?.hover && !drag && e.target.closest('.bc, .mini'), was = sel
  if (!el || el.contains(e.relatedTarget)) return
  setTimeout(() => {
    if (sel !== was || !app.querySelector('.detail')) return
    sel = null
    el.classList.remove('sel')
    light()
    app.querySelector('.detail').innerHTML = detail()
  }, 150)
})

app.addEventListener('click', e => {
  if (performance.now() - dropped < 500) return
  const b = e.target.closest('[data-act]')
  if (!b || b.disabled) return
  const { act, arg } = b.dataset
  if (LIVE[act]) return LIVE[act](arg)
  ACT[act](arg)
  save()
  render()
})

// Pops: a card that levels up boings, sparks and has LEVEL UP sweep across it; a stat row that changes swells.
const BOING = [{ transform: 'scale(1)' }, { transform: 'scale(1.3, .7)', offset: 0.14 }, { transform: 'scale(.82, 1.4) translateY(-14px)', boxShadow: '0 0 0 6px rgba(255, 196, 61, .95), 0 0 30px 12px rgba(255, 196, 61, .7)', offset: 0.34 }, { transform: 'scale(1.14, .88)', offset: 0.54 }, { transform: 'scale(.96, 1.05)', offset: 0.74 }, { transform: 'scale(1)' }]
const STAT_POP = [{ transform: 'scale(1)' }, { transform: 'scale(1.4)', offset: 0.35 }, { transform: 'scale(1)' }]
const statPop = el => el.animate(STAT_POP, { duration: 320, easing: 'ease-out' })
// Stage pixels: how big one is on screen, and where an element's centre sits on the 1280x720 stage.
const scale = () => stage.getBoundingClientRect().width / 1280
const onStage = r => { const a = app.getBoundingClientRect(), s = scale(); return [(r.left + r.width / 2 - a.left) / s, (r.top + r.height / 2 - a.top) / s] }
function levelUp(el) {
  const [x, y] = onStage(el.getBoundingClientRect())
  el.style.transformOrigin = '50% 100%'
  el.animate(BOING, { duration: 760, easing: 'linear' })
  for (let i = 0; i < 14; i++) {
    const p = Object.assign(document.createElement('i'), { className: 'spark' }), k = (i / 14) * 2 * Math.PI, d = 100 + Math.random() * 60
    p.style.cssText = `left:${x - 6}px;top:${y - 6}px;background:${['#ffc43d', '#fff', '#f2b705'][i % 3]}`
    app.append(p)
    p.animate([{ transform: 'none' }, { transform: `translate(${Math.cos(k) * d}px, ${Math.sin(k) * d}px) scale(.3)`, opacity: 0 }], { duration: 750, easing: 'ease-out' }).onfinish = () => p.remove()
  }
  const t = Object.assign(document.createElement('div'), { className: 'lvtext', textContent: 'LEVEL UP!' })
  app.append(t)
  const w = t.offsetWidth, left = Math.max(10, Math.min(1270 - w, x - w / 2))
  t.style.top = y - 32 + 'px'
  t.animate([{ transform: 'translateX(1300px)' }, { transform: `translateX(${left - 18}px)`, offset: 0.22, easing: 'cubic-bezier(.2, 1.6, .4, 1)' }, { transform: `translateX(${left}px)`, offset: 0.3 }, { transform: `translateX(${left + 10}px)`, offset: 0.78 }, { transform: `translateX(${-w - 40}px)` }], { duration: 1500, easing: 'ease-in-out' }).onfinish = () => t.remove()
}
// Picked gear flies from its tile into the team bag button, which pops.
function bagIn(list) {
  const to = app.querySelector('.bagbtn')?.getBoundingClientRect(), s = scale()
  if (!to) return
  for (const { html, r } of list) {
    const g = Object.assign(document.createElement('div'), { className: 'ghost', innerHTML: html })
    g.style.transformOrigin = '0 0'
    document.body.append(g)
    g.animate([
      { transform: `translate(${r.left}px, ${r.top}px) scale(${s})` },
      { transform: `translate(${r.left}px, ${r.top - 30 * s}px) scale(${s * 1.1})`, offset: 0.25 },
      { transform: `translate(${to.left + to.width / 2 - r.width * 0.06}px, ${to.top + to.height / 2 - r.height * 0.06}px) scale(${s * 0.12})`, opacity: 0.9 },
    ], { duration: 620, easing: 'cubic-bezier(.5, 0, .75, 0)' }).onfinish = () => { g.remove(); app.querySelector('.bagbtn')?.animate(STAT_POP, { duration: 380, easing: 'ease-out' }) }
  }
}
// What each shop place showed last render, so the next render can see what changed.
let shown = {}

function render() {
  if (!B?.vs) stage.querySelector('#vs')?.remove() // a run quit while the faceoff card was up
  lifted = !!run && run.levelUps > seenUps
  seenUps = run?.levelUps ?? 0
  app.className = B ? 'battle' : hof ? 'hof arena' : title ? 'home arena' : !run ? 'pick arena' : run.over ? 'end arena' : 'shop arena'
  app.innerHTML = FS + (B ? battleHTML() : hof ? hallHTML() : title ? homeHTML() : packing ? packHTML() : !run ? pickHTML() : run.over ? endHTML() : shopHTML())
  if (B) bindBattle()
  const next = {}
  if (!B && !title && run && !run.over) for (const el of app.querySelectorAll('.mini[data-arg]')) {
    const p = el.dataset.arg, o = at(run, p), was = shown[p]
    next[p] = o && { o, id: o.id, level: o.level, row: el.querySelector('.pills')?.innerHTML ?? '' }
    if (!o || !was) continue
    // Only a real level up (the run counted one) boings; a merge leaves a new card where a copy was. A stat row swells
    // only on the card that was already there, so swapping two copies of a player shows neither.
    if (lifted && was.id === o.id && o.level > was.level) levelUp(el)
    else if (was.o === o && next[p].row !== was.row) statPop(el.querySelector('.pills'))
  }
  shown = next
  if (flying) bagIn(flying)
  flying = null
  app.querySelector('.dialog .navy, .duffel[data-act], .offer .gtb:not([disabled]), .evt .op:not([disabled]), .lvls [aria-pressed=true]')?.focus()
}

addEventListener('keydown', e => {
  if (e.key !== 'Escape') return
  if (B?.peek) return LIVE.peek()
  if (!(zoom || quitting || bagOpen || hof || lastStats)) return
  if (zoom) zoom = null
  else lastStats = hof = quitting = bagOpen = false
  render()
})

// A game in progress is saved as its matchup, so a reload replays the same game instead of drawing a new opponent: the
// ghost's pool record, or the dice the bot was rolled with (a copy of the run, so the run's own dice stay put).
function matchup() {
  const { r, seed, ghost } = run.match, bot = () => botTeam({ ...run, r })
  let g = ghost && parse(ghost, run.day, pid()), game
  // A ghost the game can't start against plays as the bot instead: a bad pool record never costs anyone their run.
  try { game = newGame(myTeam(run), g?.lineup ?? bot(), seed) } catch { g = null; game = newGame(myTeam(run), bot(), seed) }
  B = { g: game, ghost: g ? COACHES[g.coach].name : null, name: g ? run.match.name ?? null : null, coach: g?.coach ?? null, cups: g?.cups ?? {}, speed: flag('hab-ff') ? 5 : 1, acc: 0, prev: 0, seen: 0, feed: [], done: false }
  return g
}
function resume() {
  const g = matchup()
  B.vs = { coach: g?.coach ?? null, wins: g?.wins ?? null, day: g?.rec?.day ?? run.day, n: 5 }
  // The faceoff card lives on the stage, outside the screens, so it slides in over the shop and the battle renders
  // behind it only once its halves meet: the rink never shows through the slide.
  stage.insertAdjacentHTML('beforeend', vsHTML())
  $('vs').addEventListener('click', vsExit)
  const b = B
  setTimeout(() => { if (B === b) { render(); requestAnimationFrame(frame) } }, 220)
  vsTick()
}

// The switch takes the account's setting; an unreachable database leaves it as it was.
function syncShown(u) {
  nameOf(u.uid).then(n => { if (n !== undefined) { flag('hab-showname', !!n); if (title) render() } })
}

// Put a run on the title in place of the one there, quietly, and keep it in the save slot for who is signed in.
function adopt(saved) {
  run = fresh(saved)
  seenUps = run?.levelUps ?? 0
  save()
  if (run && (run.pack ?? '1') !== PACK && Object.hasOwn(PACKS, run.pack)) location.replace(packURL(run.pack)) // the account's run is another pack's
}

if (!away) land(), render() // a page leaving for its run's pack draws nothing
// The account's run counts only while the title still says Loading; after 3 s the device's run stands.
setTimeout(() => { if (loading) { loading = false; if (title) land(), render() } }, 3000)
ready.then(async u => {
  if (away) return // a page leaving for its run's pack leaves the save and the account alone
  if (!u && loaded() && flag('hab-signed')) { flag('hab-signed', false); adopt(load()) } // signed out elsewhere: the device's run
  if (u) { syncShown(u); pullHall(u).then(() => hof && render()) }
  if (u && loading) { const saved = await pull(u); if (saved !== undefined && loading) adopt(saved) }
  loading = false
  if (title) land(), render()
})
