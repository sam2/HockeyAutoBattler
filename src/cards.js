import { is, TPS, hit, gain, cast, rand, onIce, adjacent, pressure, block, refill, TARGETS, mult } from './sim.js'
import { CARDS2 } from './cards2.js'

// A card: pos (W, C, D or G), every (cooldown in s), pills (what it does each time it acts, at level 1:
// [stat, amount, target?], done in order; plan() in sim.js runs them) and abilities. Names parody hockey legends.
// An ability is { on, text, ... }, where on is its trigger:
//   when     if(u, g) is checked as the card acts; while it holds the card adds its pills to its own. cond names it
//   passive  always on: defend(u, shooter, d, g) adjusts shots at your net, bonus(b) this card's pass bonus,
//            add: [stat, (u, g) => extra] raises that pill's base (or 'haste': percent off the cooldown)
//   <event>  any other on is an event name from sim.js (start, act, shot, blocked, block, pass, pressure, hit,
//            penalty, goal, period, win...) and run(u, g, e) fires when one happens. of says whose: self (default),
//            team, adjacent, rival or all. An ability aimed at neighbours names its reach in `to` (adjacent, or adjacent
//            forwards), as a pass pill does in its target, so the shop can draw it. gain() raises a stat for this
//            battle or permanently; cast() makes a unit act now:
//            an ability that casts names the archetype it casts in `casts`, and sim.test.js proves those archetype
//            links never form a cycle, the way Batomon's trigger cards are gated by type. That is all that stops loops.
// Never condition on the rival's lineup: the player faces random teams and can't plan for it. {n} scales with level,
// and so must the number in the code (mult(u.level); the sim scales passive adds itself): two Rookies never beat a Pro.
//
// Balance: every skater archetype has four roles (generator makes its resource, scaler grows with it, payoff cashes
// it in, tempo speeds it up) across the rarities, and abilities only ever read your own side's resources.
// budget.test.js checks each card's printed stats against its rarity's points-per-second budget: a card with no
// abilities gets the whole budget, one with abilities 70%, a scaler (scaler: true) 50% because it grows, and
// stats: n overrides that share when the ability is the card (Kucherough's neighbour acting).

// The other team is shorthanded, exactly as the sim counts it.
const pp = (g, u) => g.teams[1 - u.side].some(m => m.box)
const dressed = (g, u, arch) => g.teams[u.side].filter(m => is(m.card, arch))
const others = (g, u, arch) => dressed(g, u, arch).filter(m => m !== u)
const sooner = (units, s) => units.forEach(m => m && (m.cd -= s * TPS))
const later = (units, s) => sooner(units, -s)
const pick = (g, list) => list[Math.floor(rand(g) * list.length)]
const wingers = (g, u) => g.teams[u.side].filter(m => (m.slot === 'LW' || m.slot === 'RW') && onIce(m))
const yourC = (g, u) => g.teams[u.side].filter(m => m.slot === 'C' && onIce(m))
const bothD = (g, u) => g.teams[u.side].filter(m => (m.slot === 'LD' || m.slot === 'RD') && onIce(m))
const smother = { on: 'passive', text: 'Shots at your net deal {10}% less.', defend: (u, shooter, d) => d * (1 - 0.1 * mult(u.level)) }
const slow = { on: 'act', text: 'Every rival acts {0.15} s later.', run: (u, g) => later(g.teams[1 - u.side], 0.15 * mult(u.level)) }

const PACK1 = {
  // --- Snipers: shoot, and turn pass bonuses into goals ---
  snapShooter: {
    name: 'Joe Snapic', pos: 'W', arch: 'Sniper', rarity: 'Common', role: 'scaler', scaler: true, every: 4, pills: [['shoot', 4]],
    abilities: [{ on: 'win', of: 'team', text: 'Shoot +{1} permanently.', run: (u, g) => gain(g, u, 'shoot', 1, true) }],
  },
  pureShooter: {
    name: 'Pavel Burst', pos: 'W', arch: 'Sniper', rarity: 'Common', role: 'generator', every: 3, pills: [['shoot', 5]],
  },
  sniper: {
    name: 'Brett Hurl', pos: 'W', arch: 'Sniper', rarity: 'Uncommon', role: 'payoff', every: 5, pills: [['shoot', 9]],
    abilities: [{ on: 'when', cond: 'their net has Pressure', if: (u, g) => g.nets[1 - u.side].pressure > 0, text: 'Shoot +{4}.', pills: [['shoot', 4]] }],
  },
  shootFirstCenter: {
    name: 'Steven Slamkos', pos: 'C', arch: 'Sniper', rarity: 'Uncommon', role: 'generator', every: 4, pills: [['shoot', 3], ['rebound', 1]],
    abilities: [{ on: 'start', of: 'team', text: 'Your Snipers Shoot +{1} for this battle.', run: (u, g) => dressed(g, u, 'Sniper').forEach(m => gain(g, m, 'shoot', mult(u.level) / mult(m.level))) }],
  },
  ppSniper: {
    name: 'Alex Ovechuckin', pos: 'W', arch: 'Sniper', rarity: 'Rare', role: 'payoff', every: 4, pills: [['shoot', 8]],
    abilities: [{ on: 'when', cond: 'on the power play', if: (u, g) => pp(g, u), text: 'Shoot +{5}.', pills: [['shoot', 5]] }],
  },
  hotHand: {
    name: 'Connor McDrive', pos: 'C', arch: 'Sniper', rarity: 'Rare', role: 'scaler', scaler: true, every: 3, pills: [['shoot', 4]],
    abilities: [{ on: 'goal', of: 'team', text: 'Shoot +{1} for this battle.', run: (u, g) => gain(g, u, 'shoot', 1) }],
  },
  captainSniper: {
    name: 'Sidney Crossby', pos: 'C', arch: 'Sniper', rarity: 'Super Rare', role: 'tempo', every: 4, pills: [['shoot', 11]],
    abilities: [{ on: 'act', text: 'Your other Snipers act {1} s sooner.', run: (u, g) => sooner(others(g, u, 'Sniper'), mult(u.level)) }],
  },
  franchiseSniper: {
    name: 'Mario Lemissile', pos: 'W', arch: 'Sniper', rarity: 'Legendary', role: 'payoff', every: 6, pills: [['shoot', 15]],
    abilities: [
      { on: 'passive', text: 'Pass bonuses on his shots count half again.', bonus: b => Math.floor(b * 1.5) },
      { on: 'shot', text: 'Keeps a third of the pass bonus he just used.', run: (u, g, e) => { u.bonus += Math.floor(e.bonus / 3) } },
    ],
  },

  // --- Playmakers: pass bonuses onto the next shots of others ---
  setupMan: {
    name: 'Adam Oatmeal', pos: 'W', arch: 'Playmaker', rarity: 'Common', role: 'generator', every: 3, pills: [['shoot', 2], ['pass', 3]],
  },
  bigCenter: {
    name: 'Joe Thorntown', pos: 'C', arch: 'Playmaker', rarity: 'Common', role: 'generator', every: 4, pills: [['pass', 3]],
  },
  saucerPasser: {
    name: 'Henrik Saucedin', pos: 'W', arch: 'Playmaker', rarity: 'Uncommon', role: 'scaler', every: 4, pills: [['shoot', 4], ['pass', 2]],
    abilities: [{ on: 'pass', text: 'Pass +{0.5} for this battle.', run: (u, g) => gain(g, u, 'pass', 0.5) }], // half: every pass now reaches two
  },
  twoWayCenter: {
    name: 'Steve Twozerman', pos: 'C', arch: 'Playmaker', rarity: 'Uncommon', role: 'tempo', every: 5, pills: [['shoot', 2], ['pass', 3]],
    abilities: [{ on: 'start', of: 'team', text: "Both wingers' cooldown drops 25% for this battle.", run: (u, g) => wingers(g, u).forEach(m => gain(g, m, 'haste', 25)) }],
  },
  rushingD: {
    name: 'Paul Coffeey', pos: 'D', arch: 'Playmaker', rarity: 'Rare', role: 'tempo', every: 4, pills: [['shoot', 4], ['pass', 3, 'adjacent forwards']],
    abilities: [{ on: 'act', text: 'Your Playmakers act {0.5} s sooner.', run: (u, g) => sooner(others(g, u, 'Playmaker'), 0.5 * mult(u.level)) }],
  },
  shootingPasser: {
    name: 'Jaromir Jagger', pos: 'W', arch: 'Playmaker', rarity: 'Rare', role: 'scaler', every: 5, pills: [['shoot', 5], ['pass', 4]],
    abilities: [{ on: 'pass', text: 'Shoot +{1} for this battle, up to +{5}.', run: (u, g) => (u.gain.shoot ?? 0) < 5 && gain(g, u, 'shoot', 1) }],
  },
  elitePlaymaker: {
    name: 'Wayne Assistzky', pos: 'C', arch: 'Playmaker', rarity: 'Super Rare', role: 'payoff', every: 5, pills: [['pass', 3], ['pass', 4, 'your Snipers']],
    abilities: [{ on: 'act', text: 'Then one of your Snipers acts.', casts: 'Sniper', run: (u, g) => cast(g, pick(g, dressed(g, u, 'Sniper').filter(onIce))) }],
  },
  franchisePlaymaker: {
    name: 'Nikita Kucherough', pos: 'W', arch: 'Playmaker', rarity: 'Legendary', role: 'payoff', stats: 0.5, every: 6, pills: [['shoot', 4], ['pass', 5]],
    // Any archetype can be next to him, so `casts` names the reach, not an archetype. He never picks another
    // Kucherough: two of them alone together would pass it back and forth forever.
    abilities: [{ on: 'pass', text: 'Then an adjacent player acts (except another Kucherough).', casts: 'adjacent', run: (u, g) => cast(g, pick(g, adjacent(g, u).filter(m => m.card !== u.card))) }],
  },

  // --- Grinders: stack Pressure on their net ---
  mucker: {
    name: 'Milan Muckic', pos: 'W', arch: 'Grinder', rarity: 'Common', role: 'scaler', scaler: true, every: 4, pills: [['shoot', 2], ['pressure', 2]],
    abilities: [{ on: 'act', text: 'Shoot +{1} for this battle, up to +{2}.', run: (u, g) => (u.gain.shoot ?? 0) < 2 && gain(g, u, 'shoot', 1) }],
  },
  checkingCenter: {
    name: 'Mark Messyer', pos: 'C', arch: 'Grinder', rarity: 'Common', role: 'tempo', every: 4, pills: [['shoot', 3], ['pressure', 2]],
    abilities: [{ on: 'act', text: 'Your other Grinders act {0.3} s sooner.', run: (u, g) => sooner(others(g, u, 'Grinder'), 0.3 * mult(u.level)) }],
  },
  netFront: {
    name: 'Phil Netposito', pos: 'W', arch: 'Grinder', rarity: 'Uncommon', role: 'generator', every: 3, pills: [['shoot', 2], ['pressure', 2]],
    abilities: [{ on: 'passive', text: '+{1} Pressure for every 2 other Grinders you dress.', add: ['pressure', (u, g) => Math.floor(others(g, u, 'Grinder').length / 2)] }],
  },
  pestD: {
    name: 'Esa Tikkanoying', pos: 'D', arch: 'Grinder', rarity: 'Uncommon', role: 'generator', every: 5, pills: [['pressure', 4], ['block', 4]],
  },
  creaseCrasher: {
    name: 'Tomas Hellstorm', pos: 'W', arch: 'Grinder', rarity: 'Rare', role: 'payoff', every: 5, pills: [['shoot', 8]],
    abilities: [{ on: 'when', cond: 'their net has 2+ Pressure', if: (u, g) => g.nets[1 - u.side].pressure >= 2, text: 'Shoot +{11}.', pills: [['shoot', 11]] }],
  },
  relentless: {
    name: 'Bobby Clarkhound', pos: 'C', arch: 'Grinder', rarity: 'Rare', role: 'scaler', scaler: true, every: 4, pills: [['shoot', 3], ['pressure', 2]],
    abilities: [{ on: 'period', of: 'all', text: 'Pressure +{2} for this battle.', run: (u, g) => gain(g, u, 'pressure', 2) }],
  },
  powerForward: {
    name: 'Gordie Plow', pos: 'W', arch: 'Grinder', rarity: 'Super Rare', role: 'payoff', every: 5, pills: [['shoot', 5], ['pressure', 3], ['rattle', 1]],
    abilities: [{ on: 'passive', text: 'Shoot +{1} for each Pressure on their net.', add: ['shoot', (u, g) => g.nets[1 - u.side].pressure] }],
  },
  rocket: {
    name: 'Maurice Richarge', pos: 'W', arch: 'Grinder', rarity: 'Legendary', role: 'generator', every: 4, pills: [['shoot', 6], ['pressure', 3]],
    abilities: [{ on: 'goal', of: 'team', text: 'Pressure {5} on their net.', run: (u, g) => pressure(g, u, 5) }],
  },

  // --- Enforcers: Rattle the rival into penalties, and carry enough Shoot to cash them in ---
  enforcer: {
    name: 'Bob Probrawl', pos: 'W', arch: 'Enforcer', rarity: 'Common', role: 'scaler', scaler: true, every: 5, pills: [['rattle', 3], ['shoot', 2]],
    abilities: [{ on: 'win', of: 'team', text: 'Rattle +{1} permanently.', run: (u, g) => gain(g, u, 'rattle', 1, true) }],
  },
  bruiser: {
    name: 'Marty McSockley', pos: 'D', arch: 'Enforcer', rarity: 'Common', role: 'tempo', every: 4, pills: [['rattle', 4], ['block', 2]],
    abilities: [{ on: 'hit', of: 'adjacent', text: 'Acts {1} s sooner.', run: u => sooner([u], mult(u.level)) }],
  },
  pest: {
    name: 'Tie Domino', pos: 'C', arch: 'Enforcer', rarity: 'Uncommon', role: 'generator', every: 3, pills: [['rattle', 4], ['shoot', 3]],
  },
  hammer: {
    name: 'Dave Schultzhammer', pos: 'W', arch: 'Enforcer', rarity: 'Uncommon', role: 'payoff', every: 5, pills: [['rattle', 3], ['shoot', 4]],
    abilities: [{ on: 'penalty', of: 'rival', text: 'Acts {1} s sooner.', run: u => sooner([u], mult(u.level)) }],
  },
  agitator: {
    name: 'Brad Marchtaunt', pos: 'W', arch: 'Enforcer', rarity: 'Rare', role: 'payoff', every: 5, pills: [['rattle', 6], ['shoot', 3]],
    abilities: [{ on: 'when', cond: 'on the power play', if: (u, g) => pp(g, u), text: 'Shoot +{1}.', pills: [['shoot', 1]] }],
  },
  heavyweight: {
    name: 'Scott Stunnens', pos: 'D', arch: 'Enforcer', rarity: 'Rare', role: 'generator', every: 5, pills: [['rattle', 6], ['shoot', 5]],
    abilities: [{ on: 'passive', text: '+{1} Rattle for each other Enforcer you dress.', add: ['rattle', (u, g) => others(g, u, 'Enforcer').length] }],
  },
  boogeyman: {
    name: 'Derek Boogeyman', pos: 'D', arch: 'Enforcer', rarity: 'Super Rare', role: 'tempo', every: 5, pills: [['rattle', 5], ['block', 2], ['shoot', 4]],
    abilities: [{ on: 'penalty', of: 'rival', text: 'Your whole team acts {0.5} s sooner.', run: (u, g) => sooner(g.teams[u.side], 0.5 * mult(u.level)) }],
  },
  powerEnforcer: {
    name: 'Cam Kneely', pos: 'W', arch: 'Enforcer', rarity: 'Legendary', role: 'scaler', every: 4, pills: [['shoot', 7], ['rattle', 6]],
    abilities: [{ on: 'penalty', of: 'rival', text: 'Shoot +{1} and Rattle +{1} for this battle.', run: (u, g) => { gain(g, u, 'shoot', 1); gain(g, u, 'rattle', 1) } }],
  },

  // --- Shutdowns: Block on your net ---
  shutdown: {
    name: 'Chris Stronger', pos: 'D', arch: 'Shutdown', rarity: 'Common', role: 'scaler', scaler: true, every: 3, pills: [['shoot', 1], ['block', 2]],
    abilities: [{ on: 'blocked', of: 'team', text: 'Block +{1} for this battle, up to +{2}.', run: (u, g) => (u.gain.block ?? 0) < 2 && gain(g, u, 'block', 1) }],
  },
  stayAtHome: {
    name: 'Rod Stayway', pos: 'D', arch: 'Shutdown', rarity: 'Common', role: 'generator', every: 5, pills: [['shoot', 3], ['block', 4]],
    abilities: [{ on: 'when', cond: 'your net is below half', if: (u, g) => g.nets[u.side].meter < g.nets[u.side].max / 2, text: 'Block +{6}.', pills: [['block', 6]] }],
  },
  shotBlocker: {
    name: 'Larry Blockinson', pos: 'D', arch: 'Shutdown', rarity: 'Uncommon', role: 'generator', every: 2, pills: [['shoot', 1], ['block', 2]],
    abilities: [{ on: 'passive', text: '+{2} Block for each other Shutdown you dress.', add: ['block', (u, g) => 2 * others(g, u, 'Shutdown').length] }],
  },
  twoWayWinger: {
    name: 'Bob Gainsey', pos: 'W', arch: 'Shutdown', rarity: 'Uncommon', role: 'payoff', every: 4, pills: [['shoot', 2], ['block', 4]],
    abilities: [{ on: 'block', of: 'team', text: 'Shoot +{1} for this battle, up to +{2}.', run: (u, g) => (u.gain.shoot ?? 0) < 2 && gain(g, u, 'shoot', 1) }],
  },
  shutdownCenter: {
    name: 'Patrice Blockeron', pos: 'C', arch: 'Shutdown', rarity: 'Rare', role: 'tempo', every: 2, pills: [['shoot', 2], ['block', 3]],
    abilities: [slow],
  },
  clearer: {
    name: 'Zdeno Clearra', pos: 'D', arch: 'Shutdown', rarity: 'Rare', role: 'payoff', scaler: true, every: 5, pills: [['shoot', 6]],
    abilities: [{ on: 'passive', text: 'Shoot +{1} for every 2 Block on your net.', add: ['shoot', (u, g) => g.nets[u.side].block / 2] }],
  },
  lockdown: {
    name: 'Nicklas Lockstrom', pos: 'D', arch: 'Shutdown', rarity: 'Super Rare', role: 'tempo', every: 2, pills: [['shoot', 2], ['block', 4]],
    abilities: [smother, { on: 'block', of: 'adjacent', text: 'Acts {1} s sooner.', run: (u, g) => sooner([u], mult(u.level)) }],
  },
  towerD: {
    name: 'Victor Headman', pos: 'D', arch: 'Shutdown', rarity: 'Legendary', role: 'generator', every: 4, pills: [['block', 7], ['shoot', 7]],
    abilities: [{ on: 'period', of: 'all', text: 'Block {14}.', run: (u, g) => block(g, u, 14) }],
  },

  // --- Puck-movers: haste, for the C and the line ---
  puckMover: {
    name: 'Erik Carrylsson', pos: 'D', arch: 'Puck-mover', rarity: 'Common', role: 'tempo', every: 4, pills: [['shoot', 5]],
    abilities: [{ on: 'act', text: "Your C's cooldown drops {1}% for this battle.", run: (u, g) => yourC(g, u).forEach(c => gain(g, c, 'haste', mult(u.level))) }],
  },
  dangler: {
    name: 'Pavel Dekesyuk', pos: 'W', arch: 'Puck-mover', rarity: 'Common', role: 'generator', every: 2, pills: [['shoot', 3], ['pass', 1]],
  },
  stretchPasser: {
    name: 'Brian Stretch', pos: 'D', arch: 'Puck-mover', rarity: 'Uncommon', role: 'tempo', every: 4, pills: [['shoot', 6]],
    abilities: [
      { on: 'act', text: 'Adjacent forwards act {0.2} s sooner.', to: 'adjacent forwards', run: (u, g) => sooner(TARGETS['adjacent forwards'](g, u), 0.2 * mult(u.level)) },
      { on: 'shot', of: 'adjacent', text: 'Acts {0.2} s sooner.', run: u => sooner([u], 0.2 * mult(u.level)) },
    ],
  },
  skatingCenter: {
    name: 'Sergei Fedorocket', pos: 'C', arch: 'Puck-mover', rarity: 'Uncommon', role: 'tempo', every: 3, pills: [['shoot', 4]],
    abilities: [{ on: 'act', text: 'Both your D act {0.2} s sooner.', run: (u, g) => sooner(bothD(g, u), 0.2 * mult(u.level)) }],
  },
  ppQuarterback: {
    name: 'Al MacBlastis', pos: 'D', arch: 'Puck-mover', rarity: 'Rare', role: 'payoff', every: 5, pills: [['shoot', 12]],
    abilities: [{ on: 'when', cond: 'on the power play', if: (u, g) => pp(g, u), text: 'Shoot +{8}.', pills: [['shoot', 8]] }],
  },
  mentor: {
    name: 'Larry Robinsooner', pos: 'D', arch: 'Puck-mover', rarity: 'Rare', role: 'scaler', scaler: true, every: 5, pills: [['shoot', 6]],
    abilities: [
      { on: 'period', of: 'all', text: "Your skaters' cooldowns drop {5}% for this battle.", run: (u, g) => g.teams[u.side].filter(m => m.slot !== 'G').forEach(m => gain(g, m, 'haste', 5 * mult(u.level))) },
      { on: 'win', of: 'team', text: "Your C's cooldown drops {3}% permanently.", run: (u, g) => yourC(g, u).forEach(c => gain(g, c, 'haste', 3 * mult(u.level), true)) },
    ],
  },
  speedster: {
    name: 'Cale Makarena', pos: 'D', arch: 'Puck-mover', rarity: 'Super Rare', role: 'scaler', scaler: true, every: 3, pills: [['shoot', 5]],
    abilities: [{ on: 'act', text: 'His cooldown drops {2}% for this battle.', run: (u, g) => gain(g, u, 'haste', 2 * mult(u.level)) }],
  },
  franchiseD: {
    name: 'Bobby Soar', pos: 'D', arch: 'Puck-mover', rarity: 'Legendary', role: 'tempo', every: 2, pills: [['shoot', 6]],
    abilities: [{ on: 'act', text: 'Adjacent players act {0.4} s sooner.', to: 'adjacent', run: (u, g) => sooner(adjacent(g, u), 0.4 * mult(u.level)) }],
  },

  // --- Goalies: composure is the net meter at level 1 ---
  butterfly: {
    name: 'Glenn Sprawl', pos: 'G', arch: 'Butterfly', rarity: 'Common', every: 4, composure: 70, pills: [['refill', 4]],
  },
  hybrid: { // the Enforcer goalie: the box fills his net
    name: 'Terry Stopchuk', pos: 'G', arch: 'Hybrid', rarity: 'Common', every: 3, composure: 70, pills: [['refill', 1], ['block', 1]],
    abilities: [{ on: 'penalty', of: 'rival', text: 'Refill {4}.', run: (u, g) => refill(g, u, 4) }],
  },
  puckhandler: { // the Puck-mover and Playmaker goalie: he moves the puck
    name: 'Martin Broadpass', pos: 'G', arch: 'Hybrid', rarity: 'Uncommon', every: 4, composure: 70, pills: [['refill', 2], ['pass', 1]],
    abilities: [{ on: 'act', text: 'Your Puck-movers act {0.3} s sooner.', run: (u, g) => sooner(dressed(g, u, 'Puck-mover'), 0.3 * mult(u.level)) }],
  },
  acrobat: { // the comeback goalie
    name: 'Dominik Hashek', pos: 'G', arch: 'Butterfly', rarity: 'Uncommon', every: 5, composure: 80, pills: [['refill', 4]],
    abilities: [{ on: 'when', cond: 'your net is below half', if: (u, g) => g.nets[u.side].meter < g.nets[u.side].max / 2, text: 'Refill +{3}.', pills: [['refill', 3]] }],
  },
  cheater: { // the Grinder goalie, on the Precise pattern
    name: 'Gerry Cheatvers', pos: 'G', arch: 'Hybrid', rarity: 'Uncommon', every: 4, composure: 75, pills: [['refill', 3]],
    abilities: [{ on: 'passive', text: '+{1} refill for each Grinder you dress.', add: ['refill', (u, g) => dressed(g, u, 'Grinder').length] }],
  },
  runAndGun: { // the Sniper goalie: your goals keep him fresh
    name: 'Grant Fury', pos: 'G', arch: 'Hybrid', rarity: 'Rare', every: 4, composure: 80, pills: [['refill', 4]],
    abilities: [{ on: 'goal', of: 'team', text: 'Refill {7}.', run: (u, g) => refill(g, u, 7) }],
  },
  hacker: { // the Enforcer goalie who swings the stick
    name: 'Billy Smite', pos: 'G', arch: 'Butterfly', rarity: 'Rare', every: 4, composure: 80, pills: [['refill', 4], ['rattle', 2]],
  },
  positional: {
    name: 'Carey Precise', pos: 'G', arch: 'Butterfly', rarity: 'Rare', every: 4, composure: 80, pills: [['refill', 4]],
    abilities: [{ on: 'passive', text: '+{1} refill for each Shutdown you dress.', add: ['refill', (u, g) => dressed(g, u, 'Shutdown').length] }],
  },
  brickWall: {
    name: 'Ken Drywall', pos: 'G', arch: 'Butterfly', rarity: 'Super Rare', every: 6, composure: 100, pills: [['refill', 7]],
    abilities: [{ on: 'when', cond: 'your net is full', if: (u, g) => g.nets[u.side].meter >= g.nets[u.side].max, text: 'Block +{7}.', pills: [['block', 7]] }],
  },
  franchiseG: {
    name: 'Patrick Royal', pos: 'G', arch: 'Hybrid', rarity: 'Legendary', every: 4, composure: 115, pills: [['refill', 3], ['block', 2]],
    abilities: [{ on: 'goal', of: 'rival', text: 'Your whole team acts {1} s sooner.', run: (u, g) => sooner(g.teams[u.side], mult(u.level)) }],
  },
}
for (const c of Object.values(PACK1)) c.abilities ??= []

// Every pack a run can play, in the order the pack picker shows them: its name, the player on its card and its cards, goalies included. block is what a point of Block costs in the card budget (see budget.js). Each pack's
// runs meet only that pack's teams (see FOLDER in ghost.js).
export const PACKS = {
  1: { name: 'Pack 1', face: 'elitePlaymaker', cards: PACK1, block: 1 },
  2: { name: 'Pack 2', face: 'spinvard', cards: CARDS2, block: 0.75 },
}
// Which pack this page plays: ?pack=2 in the address, or PACK=2 for node (the tests and the lab); anything else is pack
// one. A run, its opponents and its Hall of Fame never mix packs.
const asked = (typeof location !== 'undefined' && new URLSearchParams(location.search).get('pack')) || globalThis.process?.env?.PACK
export const PACK = Object.hasOwn(PACKS, asked ?? '') ? asked : '1'
export const CARDS = PACKS[PACK].cards
