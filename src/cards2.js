import { is, TPS, cast, gain, onIce, adjacent, pass, mult, amount, plan, adds, log, sendOff, periodOf, ANY, refill, pressure, block, hit, shoot, TARGETS } from './sim.js'

// Pack two: 46 players on the archetype wheel (Block -> Pressure -> Rattle -> Shoot -> Pass -> Block), eight per
// archetype with a Super Rare hybrid of it and the next one clockwise, plus six Puck-movers who play any seat and bridge
// the archetypes across the wheel. The card format is cards.js's; what's new here:
//   arch2      a hybrid's second archetype: it counts as both wherever a card asks for an archetype
//   head       the trigger line as the card prints it, when the event name alone doesn't say it
//   aura       on a passive: [stat, (source, unit, g) => n], raising a teammate's stat (base units, or percent for haste)
//   negate, save, twice, spend, pierce, screen, pin
//              passive rules the sim reads by name (see sim.js): no penalty for him, a saved goal once a period,
//              Block lands twice, his shot takes your net's Block, his shot goes through Block, no Refill under
//              Pressure, Pressure stays while they're shorthanded
// An ability with no text is the hidden half of one that has text.
// `period` fires at the end of the 1st, the 2nd and regulation; "each new period" cards skip the last (amount 3).

const W = 'W', C = 'C', D = 'D', A = ANY
const mine = (g, u, arch) => g.teams[u.side].filter(m => is(m.card, arch))
const sooner = (units, s) => units.forEach(m => m && (m.cd -= s * TPS))
const pp = (u, g) => g.teams[1 - u.side].some(m => m.box) // a rival is in the box (4-on-4 too), as a When's if(u, g)
const boxed = (g, side) => g.teams[side].filter(m => m.box).length
// The first of a card's copies on the ice, so an effect that does not stack comes from one of them.
const first = (g, m) => g.teams[m.side].find(x => x.card === m.card && onIce(x)) === m
const isD = u => u.slot === 'LD' || u.slot === 'RD'
// A haste aura that every player of an archetype gets while a condition holds.
const rush = (arch, holds, pct) => ['haste', (m, u, g) => (is(u.card, arch) && holds(m, g) ? pct * mult(m.level) : 0)]

export const CARDS2 = {
  // --- Shutdowns: Block your net, and take Pressure and Rattle off your team ---
  seabrick: {
    name: 'Brent Seabrick', pos: D, arch: 'Shutdown', rarity: 'Common', every: 4, pills: [['block', 5], ['shoot', 1]],
    abilities: [{
      on: 'passive', to: 'adjacent D', text: 'Adjacent defensemen gain Block equal to half of Brent Seabrick’s Block (except another Brent Seabrick).',
      aura: ['block', (m, u, g) => (u.card !== m.card && isD(u) && adjacent(g, m).includes(u) ? amount(m, 5 + (m.gain.block ?? 0), g) / 2 / mult(u.level) : 0)],
    }],
  },
  kopistop: {
    name: 'Anze Kopistop', pos: C, arch: 'Shutdown', rarity: 'Common', stats: 1, every: 4, pills: [['block', 3], ['pass', 2]],
    // Printed Block less printed Pass tops his Pass up to his Block; every Block he gains after that follows.
    abilities: [{ on: 'passive', text: 'His Pass equals his Block.', add: ['pass', (u, g) => u.card.pills[0][1] - u.card.pills[1][1] + adds(u, g, 'block')] }],
  },
  carbonnope: {
    name: 'Guy Carbonnope', pos: C, arch: 'Shutdown', rarity: 'Uncommon', scaler: true, every: 5, pills: [['block', 5], ['shoot', 2]],
    abilities: [
      { on: 'passive', negate: true, text: 'If Guy Carbonnope would take a penalty, instead no penalty is called and Rattle is reset to 0.' },
      { on: 'win', of: 'team', text: 'Block +{1} permanently.', run: (u, g) => gain(g, u, 'block', 1, true) },
    ],
  },
  calmonen: {
    name: 'Kimmo Calmonen', pos: D, arch: 'Shutdown', rarity: 'Uncommon', every: 4, pills: [['block', 5], ['shoot', 3]],
    abilities: [{
      on: 'act', text: 'Clears a third of the Pressure on your net and the Rattle on your team.',
      run: (u, g) => { const n = g.nets[u.side]; n.pressure -= Math.floor(n.pressure / 3); n.rattled -= Math.floor(n.rattled / 3) },
    }],
  },
  boomfrion: {
    name: 'Bernie Boomfrion', pos: W, arch: 'Shutdown', rarity: 'Rare', every: 7, pills: [['shoot', 6], ['block', 11]],
    abilities: [{ on: 'passive', spend: true, text: 'His shots take all the Block on your net and add it to the shot.' }],
  },
  blockade: {
    name: 'Rob Blockade', pos: D, arch: 'Shutdown', rarity: 'Rare', every: 5, pills: [['block', 5], ['shoot', 6]],
    abilities: [{ on: 'passive', save: true, head: 'Once a period, not in overtime', text: 'The shot that would score on you is stopped, and its damage becomes Block on your net (this effect does not stack).' }],
  },
  grindamour: {
    name: "Rod Grind'Amour", pos: W, arch: 'Shutdown', arch2: 'Grinder', rarity: 'Super Rare', every: 4, pills: [['block', 5], ['pressure', 3]],
    abilities: [{
      // Evens the two out: a wall becomes a burn (spent, so it can't grow), a burn adds a wall (half, copied).
      on: 'act', text: 'If your net’s Block is higher than your Pressure on their net, move half your Block onto their net as Pressure. Otherwise, gain Block equal to half your Pressure on their net.',
      run: (u, g) => {
        const mine = g.nets[u.side], theirs = g.nets[1 - u.side]
        if (mine.block > theirs.pressure) { const n = Math.floor(mine.block / 2); mine.block -= n; theirs.pressure += n; log(g, 'pressure', u, n) }
        else { const n = Math.floor(theirs.pressure / 2); if (n) { mine.block += n; log(g, 'block', u, n) } }
      },
    }],
  },
  longwall: {
    name: 'Rod Longwall', pos: D, arch: 'Shutdown', rarity: 'Legendary', every: 4, pills: [['block', 11], ['shoot', 4]],
    abilities: [{ on: 'passive', twice: true, text: 'Every other player’s Block lands twice, on both teams.' }],
  },

  // --- Grinders: wear them down, strongest in the 3rd period ---
  grindby: {
    name: 'Kirk Grindby', pos: W, arch: 'Grinder', rarity: 'Common', scaler: true, every: 3, pills: [['pressure', 2]],
    abilities: [{ on: 'period', of: 'all', head: 'On each new period', text: 'Pressure +{1} for this game.', run: (u, g, e) => e.amount < 3 && gain(g, u, 'pressure', 1) }],
  },
  scraper: {
    name: 'Kris Scraper', pos: C, arch: 'Grinder', rarity: 'Common', scaler: true, every: 4, pills: [['pressure', 2], ['shoot', 1]],
    abilities: [{ on: 'goal', of: 'all', head: 'On every goal, either team’s', text: 'Pressure +{1} for this game, up to +{3}.', run: (u, g) => (u.gain.pressure ?? 0) < 3 && gain(g, u, 'pressure', 1) }],
  },
  byfoulien: {
    name: 'Dustin Byfoulien', pos: D, arch: 'Grinder', rarity: 'Uncommon', every: 5, pills: [['pressure', 3], ['block', 3]],
    abilities: [{ on: 'when', cond: 'a rival is in the box', head: 'While a rival is in the box', if: pp, text: 'His Pressure doubles.', pills: [['pressure', 3]] }],
  },
  screenmonds: {
    name: 'Wayne Screenmonds', pos: W, arch: 'Grinder', rarity: 'Uncommon', every: 4, pills: [['pressure', 2], ['shoot', 4]],
    abilities: [{ on: 'passive', screen: true, text: 'Their net can’t Refill while it has Pressure.' }],
  },
  mccrashy: {
    name: 'Darren McCrashy', pos: W, arch: 'Grinder', rarity: 'Rare', every: 6, pills: [['shoot', 7], ['pressure', 3]],
    abilities: [{
      on: 'period', of: 'all', head: 'On each new period', text: 'Their net shrinks by {3}.',
      run: (u, g, e) => {
        if (e.amount >= 3) return
        const n = g.nets[1 - u.side], by = 3 * mult(u.level)
        n.max = Math.max(1, n.max - by)
        n.meter = Math.min(n.meter, n.max)
        log(g, 'shrink', u, by)
      },
    }],
  },
  orpicks: {
    name: 'Brooks Orpicks', pos: D, arch: 'Grinder', rarity: 'Rare', every: 6, pills: [['pressure', 3], ['shoot', 6]],
    abilities: [{
      on: 'passive', text: 'Every Grinder you dress gets Pressure +{1} in the 2nd period and +{2} in the 3rd.',
      aura: ['pressure', (m, u, g) => (is(u.card, 'Grinder') ? (periodOf(g) * mult(m.level)) / mult(u.level) : 0)],
    }],
  },
  clobber: {
    name: 'Wendel Clobber', pos: W, arch: 'Grinder', arch2: 'Enforcer', rarity: 'Super Rare', every: 5, pills: [['pressure', 3], ['rattle', 4], ['shoot', 3]],
    abilities: [{ on: 'passive', pin: true, text: 'While a rival is in the box, the Pressure on their net doesn’t go down.' }],
  },
  grilmour: {
    name: 'Doug Grilmour', pos: C, arch: 'Grinder', rarity: 'Legendary', every: 5, pills: [['pressure', 4], ['shoot', 5]],
    // 50% of the cooldown as it stands: 5 s, then 2.5 s in the 2nd, 1.25 s in the 3rd. The same at every level.
    abilities: [{ on: 'period', of: 'all', head: 'On each new period', text: 'Doug Grilmour’s cooldown drops 50% for this game.', run: (u, g, e) => e.amount < 3 && gain(g, u, 'haste', 50) }],
  },

  // --- Enforcers: put the other team in the box and cash in on the power play ---
  bashear: {
    name: 'Donald Bashear', pos: W, arch: 'Enforcer', rarity: 'Common', every: 6, pills: [['rattle', 5], ['shoot', 4]],
    abilities: [{
      on: 'act', head: 'Once a period', text: 'Donald Bashear and the next rival to act both go to the box.',
      run: (u, g) => {
        const rivals = g.teams[1 - u.side].filter(m => onIce(m) && m.slot !== 'G')
        if (u.fought === periodOf(g) || !rivals.length || boxed(g, 0) >= 2 || boxed(g, 1) >= 2) return
        u.fought = periodOf(g)
        sendOff(g, rivals.reduce((a, b) => (b.cd < a.cd ? b : a)))
        sendOff(g, u)
      },
    }],
  },
  slamuelsson: {
    name: 'Ulf Slamuelsson', pos: D, arch: 'Enforcer', rarity: 'Common', every: 3, pills: [['rattle', 3], ['block', 2]],
    abilities: [{
      on: 'passive', head: 'While your team has Rattle or your net has Pressure', text: 'Ulf Slamuelsson’s Rattle counts double.',
      add: ['rattle', (u, g) => (g.nets[u.side].rattled > 0 || g.nets[u.side].pressure > 0 ? 3 + (u.gain.rattle ?? 0) : 0)],
    }],
  },
  aggravery: {
    name: 'Sean Aggravery', pos: C, arch: 'Enforcer', rarity: 'Uncommon', every: 4, pills: [['rattle', 2], ['shoot', 5]],
    abilities: [{ on: 'passive', head: 'While a rival is in the box', text: 'Sean Aggravery acts {20}% faster.', add: ['haste', (u, g) => (pp(u, g) ? 20 * mult(u.level) : 0)] }],
  },
  ottrage: {
    name: 'Steve Ottrage', pos: C, arch: 'Enforcer', rarity: 'Uncommon', every: 4, pills: [['rattle', 4], ['shoot', 4]],
    abilities: [{ on: 'when', cond: 'two rivals are in the box', if: (u, g) => boxed(g, 1 - u.side) >= 2, text: 'Shoot triples.', pills: [['shoot', 8]] }],
  },
  faneuff: {
    name: 'Dion Faneuff', pos: D, arch: 'Enforcer', rarity: 'Rare', every: 5, pills: [['rattle', 6], ['block', 5], ['shoot', 1]],
    // The power-play burst: it counts the Enforcers on the ice, so a deck that splashes one or two gets a fraction of it.
    abilities: [{ on: 'penalty', of: 'rival', text: 'Every Enforcer you dress shoots {3}.', run: (u, g) => mine(g, u, 'Enforcer').filter(onIce).forEach(m => shoot(g, m, 3)) }],
  },
  marchmenace: {
    name: 'Bryan Marchmenace', pos: D, arch: 'Enforcer', rarity: 'Rare', scaler: true, every: 5, pills: [['rattle', 5], ['shoot', 3]],
    abilities: [{ on: 'penalty', of: 'rival', text: 'Shoot +{1} for this game.', run: (u, g) => gain(g, u, 'shoot', 1) }],
  },
  shanahammer: {
    name: 'Brendan Shanahammer', pos: W, arch: 'Enforcer', arch2: 'Sniper', rarity: 'Super Rare', every: 4, pills: [['rattle', 4], ['shoot', 6]],
    abilities: [{
      on: 'penalty', of: 'rival', text: 'Every Sniper you dress acts (except another Brendan Shanahammer).', casts: 'Sniper',
      run: (u, g) => mine(g, u, 'Sniper').filter(m => m.card !== u.card && onIce(m)).forEach(m => cast(g, m)),
    }],
  },
  againla: {
    name: 'Jarome Againla', pos: W, arch: 'Enforcer', rarity: 'Legendary', every: 6, pills: [['rattle', 10], ['shoot', 10]],
    abilities: [{ on: 'when', cond: 'a rival is in the box', head: 'While a rival is in the box', if: pp, text: 'Rebound +{1}.', pills: [['rebound', 1]] }],
  },

  // --- Snipers: Shoot and Rebound ---
  sizzlanne: {
    name: 'Teemu Sizzlanne', pos: W, arch: 'Sniper', rarity: 'Common', every: 4, pills: [['shoot', 6]],
    abilities: [{ on: 'when', cond: 'a rival is in the box', head: 'While a rival is in the box', if: pp, text: 'Teemu Sizzlanne gains Pass equal to his Shoot.', pills: [['pass', 6]] }],
  },
  wristkic: {
    name: 'Joe Wristkic', pos: C, arch: 'Sniper', rarity: 'Common', every: 3, pills: [['shoot', 4]],
    abilities: [{ on: 'when', head: 'On every 3rd act', cond: 'every 3rd act', if: u => (u.acts + 1) % 3 === 0, text: 'Rebound {2}.', pills: [['rebound', 2]] }],
  },
  kesselrun: {
    name: 'Phil Kesselrun', pos: W, arch: 'Sniper', rarity: 'Uncommon', every: 4, pills: [['shoot', 7]],
    abilities: [{ on: 'when', cond: 'he’s your only Sniper', if: (u, g) => mine(g, u, 'Sniper').length === 1, text: 'Shoot doubles.', pills: [['shoot', 7]] }],
  },
  weblast: {
    name: 'Shea Weblast', pos: D, arch: 'Sniper', rarity: 'Uncommon', every: 6, pills: [['shoot', 12]],
    abilities: [{ on: 'passive', pierce: true, text: 'Shea Weblast’s shots go through Block.' }],
  },
  laser: {
    name: 'Patrik Laser', pos: W, arch: 'Sniper', rarity: 'Rare', every: 5, pills: [['shoot', 10]],
    abilities: [{ on: 'passive', text: 'Pass bonuses he receives count triple.', bonus: b => b * 3 }],
  },
  clutchews: {
    name: 'Jonathan Clutchews', pos: C, arch: 'Sniper', rarity: 'Rare', every: 4, pills: [['shoot', 8]],
    abilities: [{ on: 'when', cond: 'you’re behind', if: (u, g) => g.score[u.side] < g.score[1 - u.side], text: 'Rebound {2}.', pills: [['rebound', 2]] }],
  },
  burnz: {
    name: 'Brent Burnz', pos: D, arch: 'Sniper', arch2: 'Playmaker', rarity: 'Super Rare', every: 4, pills: [['shoot', 5], ['pass', 2]],
    abilities: [{
      on: 'act', text: 'Brent Burnz gets the same pass bonus himself.',
      run: (u, g) => { const p = plan(u, g).find(p => p[0] === 'pass'); if (p) u.bonus += amount(u, p[1], g) },
    }],
  },
  bossshot: {
    name: 'Mike Bossshot', pos: W, arch: 'Sniper', rarity: 'Legendary', every: 4, pills: [['shoot', 12]],
    abilities: [
      {
        on: 'goal', of: 'team', head: 'Every 3rd goal your team scores', text: 'Every Sniper you dress gets Rebound {1} until your team scores again (this effect does not stack).',
        run: (u, g) => { (g.frenzy ??= [false, false])[u.side] = g.score[u.side] % 3 === 0 },
      },
      { on: 'passive', aura: ['rebound', (m, u, g) => (g.frenzy?.[m.side] && first(g, m) && is(u.card, 'Sniper') ? 1 : 0)] },
    ],
  },

  // --- Playmakers: pass and adjacency, for the players around them and for themselves ---
  hubberdough: {
    name: 'Jonathan Hubberdough', pos: W, arch: 'Playmaker', rarity: 'Common', every: 3, pills: [['pass', 2], ['shoot', 1]],
    abilities: [{ on: 'when', cond: 'adjacent to a Sniper', if: (u, g) => adjacent(g, u).some(m => is(m.card, 'Sniper')), text: 'Pass +{2}.', pills: [['pass', 2]] }],
  },
  sedtwin: {
    name: 'Daniel Sedtwin', pos: W, arch: 'Playmaker', rarity: 'Common', every: 4, pills: [['shoot', 3], ['pass', 2]],
    abilities: [{ on: 'passive', text: 'Daniel Sedtwin’s Pass +{1} for each adjacent Playmaker.', add: ['pass', (u, g) => adjacent(g, u).filter(m => is(m.card, 'Playmaker')).length] }],
  },
  feedch: {
    name: 'Brian Feedch', pos: D, arch: 'Playmaker', rarity: 'Uncommon', every: 5, pills: [['shoot', 2], ['pass', 2, 'your whole team']],
    abilities: [{ on: 'passive', text: 'Brian Feedch’s pass reaches every skater you dress, not just adjacent ones.' }],
  },
  zuboost: {
    name: 'Sergei Zuboost', pos: D, arch: 'Playmaker', rarity: 'Uncommon', every: 4, pills: [['shoot', 2], ['pass', 2]],
    abilities: [{ on: 'goal', of: 'all', head: 'On every goal, either team’s', to: 'adjacent', text: 'Pass {4}.', run: (u, g) => pass(g, u, adjacent(g, u), 4) }],
  },
  lariovision: {
    name: 'Igor Lariovision', pos: C, arch: 'Playmaker', rarity: 'Rare', every: 4, pills: [['shoot', 2], ['pass', 2]],
    // Never another Lariovision: two side by side would hand it back and forth forever.
    abilities: [{
      on: 'act', to: 'adjacent', casts: 'adjacent', text: 'The adjacent player holding the biggest pass bonus acts right away.',
      run: (u, g) => { const c = adjacent(g, u).filter(m => m.card !== u.card && m.slot !== 'G' && m.bonus > 0); if (c.length) cast(g, c.reduce((a, b) => (b.bonus > a.bonus ? b : a))) },
    }],
  },
  kurrier: {
    name: 'Jari Kurrier', pos: W, arch: 'Playmaker', rarity: 'Rare', every: 4, pills: [['shoot', 3], ['pass', 4]],
    abilities: [{
      on: 'period', of: 'all', head: 'On each new period', to: 'adjacent C', text: 'The adjacent center goes up a level for this game (up to Star).',
      run: (u, g, e) => { const c = adjacent(g, u).find(m => m.slot === 'C'); if (e.amount < 3 && c && c.level < 3) { c.level++; log(g, 'levelup', c) } },
    }],
  },
  needamayer: {
    name: 'Scott Needamayer', pos: D, arch: 'Playmaker', arch2: 'Shutdown', rarity: 'Super Rare', every: 4, pills: [['block', 7], ['pass', 2]],
    abilities: [{ on: 'block', of: 'team', head: 'On team block', to: 'adjacent', text: 'Pass {1}.', run: (u, g) => pass(g, u, adjacent(g, u), 1) }],
  },
  forceberg: {
    name: 'Peter Forceberg', pos: C, arch: 'Playmaker', rarity: 'Legendary', every: 5, pills: [['shoot', 6], ['pass', 3]],
    abilities: [{ on: 'act', to: 'adjacent', text: 'Double every adjacent player’s pass bonus.', run: (u, g) => adjacent(g, u).forEach(m => (m.bonus *= 2)) }],
  },

  // --- Puck-movers: any seat; each bridges two archetypes across the wheel, the Legendary rewards a mix ---
  foxtrot: {
    name: 'Adam Foxtrot', pos: A, arch: 'Puck-mover', rarity: 'Rare', every: 3, pills: [['shoot', 7]],
    abilities: [{ on: 'passive', head: 'While your net has 10+ Block', text: 'Your Snipers act {25}% faster.', aura: rush('Sniper', (m, g) => g.nets[m.side].block >= 10, 25) }],
  },
  gartfast: {
    name: 'Mike Gartfast', pos: A, arch: 'Puck-mover', rarity: 'Rare', every: 4, pills: [['shoot', 9]],
    abilities: [{ on: 'penalty', of: 'rival', text: 'Your Shutdowns act {2} s sooner.', run: (u, g) => sooner(mine(g, u, 'Shutdown'), 2 * mult(u.level)) }],
  },
  machkinnon: {
    name: 'Nathan Mach-Kinnon', pos: A, arch: 'Puck-mover', rarity: 'Rare', every: 3, pills: [['shoot', 7]],
    abilities: [{ on: 'passive', head: 'While their net has Pressure', text: 'Your Playmakers act {25}% faster.', aura: rush('Playmaker', (m, g) => g.nets[1 - m.side].pressure > 0, 25) }],
  },
  hyperman: {
    name: 'Zach Hyperman', pos: A, arch: 'Puck-mover', rarity: 'Rare', every: 4, pills: [['shoot', 9]],
    abilities: [{ on: 'rebound', of: 'team', head: 'When a teammate gets a Rebound', text: 'Your Grinders act {2} s sooner.', run: (u, g) => sooner(mine(g, u, 'Grinder'), 2 * mult(u.level)) }],
  },
  hasteling: {
    name: 'Carl Hasteling', pos: A, arch: 'Puck-mover', rarity: 'Rare', every: 3, pills: [['shoot', 6]],
    abilities: [{ on: 'passive', head: 'While a teammate holds a pass bonus', text: 'Your Enforcers act {15}% faster.', aura: rush('Enforcer', (m, g) => g.teams[m.side].some(x => x !== m && x.bonus > 0), 15) }],
  },
  spinvard: {
    name: 'Denis Spinvard', pos: A, arch: 'Puck-mover', rarity: 'Legendary', every: 3, pills: [['shoot', 8]],
    abilities: [{
      on: 'passive', text: 'Your team acts {3}% faster for each different archetype you dress.',
      aura: ['haste', (m, u, g) => (first(g, m) ? 3 * mult(m.level) * new Set(g.teams[m.side].filter(x => x.card.pos !== 'G').flatMap(x => [x.card.arch, x.card.arch2].filter(Boolean))).size : 0)],
    }],
  },

  // --- Goalies: one for each archetype (two Common, three Uncommon), one for each hybrid (four Rare, one Super Rare),
  // a Legendary Puck-mover, spread over the rarities like pack one's so early shops aren't full of goalies. Each works his own net
  // through his archetype's resource. An amount the text doesn't put in {} stays as it is at every level, so the base is
  // divided back down before amount() doubles it. ---
  quiet: {
    name: 'Jonathan Quiet', pos: 'G', arch: 'Shutdown', rarity: 'Uncommon', every: 4, composure: 75, pills: [['refill', 2], ['block', 1]],
    abilities: [{ on: 'blocked', of: 'team', head: 'When your Block stops a shot', text: 'Refill half of what it stopped.', run: (u, g, e) => e.shot && refill(g, u, Math.floor(e.amount / 2) / mult(u.level)) }],
  },
  thomauler: {
    name: 'Tim Thomauler', pos: 'G', arch: 'Grinder', rarity: 'Uncommon', every: 4, composure: 75, pills: [['refill', 3]],
    abilities: [{ on: 'act', text: 'Pressure {1} in the 1st period, {2} in the 2nd and {3} in the 3rd.', run: (u, g) => pressure(g, u, periodOf(g) + 1) }],
  },
  hexkill: {
    name: 'Ron Hexkill', pos: 'G', arch: 'Enforcer', rarity: 'Common', every: 4, composure: 70, pills: [['refill', 2], ['block', 1]],
    abilities: [{ on: 'penalty', of: 'team', head: 'When one of yours goes to the box', text: 'Block {6}.', run: (u, g) => block(g, u, 6) }],
  },
  ricochet: {
    name: 'Mike Ricochet', pos: 'G', arch: 'Sniper', rarity: 'Uncommon', every: 4, composure: 75, pills: [['refill', 3]],
    // Each shot back is a quarter of the last, so two of him trade ever smaller shots until one rounds to nothing.
    abilities: [{
      on: 'shot', of: 'rival', head: 'When a rival’s shot fails to score', text: 'Mike Ricochet shoots a quarter of it back.',
      run: (u, g, e) => {
        const net = g.nets[u.side], back = Math.floor(e.amount / 4)
        if (back >= 1 && e.amount - Math.min(net.block, e.amount) < net.meter) shoot(g, u, back / mult(u.level))
      },
    }],
  },
  playnte: {
    name: 'Jacques Playnte', pos: 'G', arch: 'Playmaker', rarity: 'Common', every: 4, composure: 70, pills: [['refill', 2], ['pass', 1]],
    abilities: [{ on: 'shot', of: 'team', head: 'When a teammate spends a pass bonus', text: 'Refill {2}.', run: (u, g, e) => e.bonus > 0 && refill(g, u, 2) }],
  },
  millstone: {
    name: 'Ryan Millstone', pos: 'G', arch: 'Shutdown', arch2: 'Grinder', rarity: 'Super Rare', every: 4, composure: 90, pills: [['refill', 4]],
    abilities: [{
      on: 'period', of: 'all', head: 'On each new period', text: 'Ryan Millstone’s net grows by {8} for this game. Block {8}.',
      run: (u, g, e) => {
        if (e.amount >= 3) return
        const n = g.nets[u.side], by = 8 * mult(u.level)
        n.max += by
        n.meter += by
        log(g, 'grow', u, by)
        block(g, u, 8)
      },
    }],
  },
  snowplow: {
    name: 'Garth Snowplow', pos: 'G', arch: 'Grinder', arch2: 'Enforcer', rarity: 'Rare', every: 4, composure: 80, pills: [['refill', 3], ['rattle', 1]],
    abilities: [{ on: 'act', text: 'Rattle equal to a quarter of the Pressure on their net.', run: (u, g) => { const n = Math.floor(g.nets[1 - u.side].pressure / 4); if (n) hit(g, u, n / mult(u.level)) } }],
  },
  brodscore: {
    name: 'Martin Brodscore', pos: 'G', arch: 'Enforcer', arch2: 'Sniper', rarity: 'Rare', every: 4, composure: 80, pills: [['refill', 4]],
    abilities: [{ on: 'when', cond: 'a rival is in the box', head: 'While a rival is in the box', if: pp, text: 'Shoot {6}.', pills: [['shoot', 6]] }],
  },
  outlettinger: {
    name: 'Jake Outlettinger', pos: 'G', arch: 'Sniper', arch2: 'Playmaker', rarity: 'Rare', every: 4, composure: 80, pills: [['refill', 4]],
    abilities: [{ on: 'act', to: 'your Snipers', text: 'Pass {2} to every Sniper you dress.', run: (u, g) => pass(g, u, TARGETS['your Snipers'](g, u), 2) }],
  },
  saucos: {
    name: 'Juuse Saucos', pos: 'G', arch: 'Playmaker', arch2: 'Shutdown', rarity: 'Rare', every: 4, composure: 80, pills: [['refill', 3], ['block', 1]],
    abilities: [{
      on: 'blocked', of: 'team', head: 'When your Block stops a shot', text: 'Both your D get a pass bonus of half what it stopped.',
      run: (u, g, e) => { const n = Math.floor(e.amount / 2); if (e.shot && n) pass(g, u, g.teams[u.side].filter(isD), n / mult(u.level)) },
    }],
  },
  turbo: {
    name: 'Marty Turbo', pos: 'G', arch: 'Puck-mover', rarity: 'Legendary', every: 4, composure: 100, pills: [['refill', 5]],
    abilities: [{
      on: 'act', casts: 'your team', text: 'The teammate with the longest wait acts right away.',
      run: (u, g) => { const mates = g.teams[u.side].filter(m => m !== u && m.slot !== 'G' && onIce(m)); if (mates.length) cast(g, mates.reduce((a, b) => (b.cd > a.cd ? b : a))) },
    }],
  },
}
for (const [id, c] of Object.entries(CARDS2)) { c.abilities ??= [] }
