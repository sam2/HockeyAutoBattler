// Gear: a team bag of run-long effects, picked one of three when a card levels up. Duplicates stack.
// Each piece is modelled on a Batomon trinket (named in the comment). Two kinds of hook live on a piece:
//   abilities  sim hooks in the card-ability format, fired for the team as a whole:
//              { on: <event>, of: team|rival|all, run(g, side, e, src) }   an event on that side
//              { on: 'passive', add: [stat, n], who(u, g), flat }          raises that stat's base for the units who passes (flat: levels don't multiply it)
//              { on: 'passive', big|shot|perm: factor, who }               multiplies stats, shots, permanent gains
//              { on: 'passive', net, netMult, level(u), blend, encore }     net size, levels, adjacency, game start repeats
//   run hooks  read by run.js: pay, interest, tier, freeCommon, signGain, firstSign, levelGain, winCash, onLose,
//              onPick, bag, itemDiscount, noItems, signLevel
// value is what a bot thinks a piece is worth; needs names an archetype the bot must have dressed for it to count.
import { is, gain, every, rand, onIce, GROUP } from './sim.js'

const skater = u => u.slot !== 'G'
const C = u => u.slot === 'C'
const left = u => u.slot[0] === 'L'
const right = u => u.slot[0] === 'R'
const D = u => GROUP[u.slot] === 'D'
const arch = a => u => is(u.card, a)
const cheap = u => u.card.rarity === 'Common'
const lone = (u, g) => skater(u) && !g.teams[u.side].some(m => m !== u && m.card.arch === u.card.arch)
const slow = (u, g) => skater(u) && every(u, g) >= 5
const skaters = (g, side) => g.teams[side].filter(u => skater(u) && onIce(u))
const add = (stat, n, who) => ({ on: 'passive', add: [stat, n], who, flat: stat === 'rebound' }) // a Rebound is flat, or a Star C would act five times
const drop = run => ({ on: 'start', of: 'team', run })

export const GEAR = {
  // --- Common ---
  tapedSticks: { name: 'Taped Sticks', rarity: 'Common', icon: 'stick', value: 1, text: 'Your skaters Shoot +1.', abilities: [add('shoot', 1, skater)] }, // Wood Sword
  centreStick: { name: "Centre's Stick", rarity: 'Common', icon: 'stick', value: 0.9, text: 'Your C Shoot +2.', abilities: [add('shoot', 2, C)] }, // Power Crown
  leftWingLock: { name: 'Left-wing Lock', rarity: 'Common', icon: 'skate', value: 0.8, text: 'Your left side (LW and LD) cooldown −4%.', abilities: [add('haste', 4, left)] }, // Quick Flag
  trainingWeights: { name: 'Training Weights', rarity: 'Common', icon: 'weight', value: 0.8, text: 'Net +10.', abilities: [{ on: 'passive', net: 10 }] }, // Training Weights
  goalieTape: { name: 'Goalie Tape', rarity: 'Common', icon: 'tape', value: 0.6, text: 'Goalies you sign have Refill +1 permanently.', signGain: ['refill', 1, c => c.pos === 'G'] }, // Sapphire Ring
  luckyPuck: { name: 'Lucky Puck', rarity: 'Common', icon: 'puck', value: 1.2, text: 'On team win, a random skater Shoot +1 permanently.', abilities: [{ on: 'win', of: 'team', run: (g, side) => { const s = skaters(g, side); if (s.length) gain(g, s[Math.floor(rand(g) * s.length)], 'shoot', 1, true) } }] }, // Boxing Glove
  warmUp: { name: 'Warm-up', rarity: 'Common', icon: 'skate', value: 0.5, text: "On game start, a random skater's cooldown −4% this battle.", abilities: [drop((g, side) => { const s = skaters(g, side); if (s.length) gain(g, s[Math.floor(rand(g) * s.length)], 'haste', 4) })] }, // Tempo Charm
  sponsorPatch: { name: 'Sponsor Patch', rarity: 'Common', icon: 'cash', value: 0.9, text: 'Pay +$1 a day.', pay: 1 }, // Gold Nugget
  gameBonus: { name: 'Game Bonus', rarity: 'Common', icon: 'cash', value: 0.9, text: 'On team win, +$3.', winCash: 3 }, // Gold Trophy
  rookieContract: { name: 'Rookie Contract', rarity: 'Common', icon: 'clipboard', value: 0.8, unique: true, text: 'The first Common you sign each day is free.', freeCommon: true }, // Bargain Bin
  treasureMap: { name: 'Treasure Map', rarity: 'Common', icon: 'map', value: 0.9, text: 'Your next gear picks are one rarity higher. Used up then.', bag: 'map' }, // Treasure Map
  spareSet: { name: 'Spare Set', rarity: 'Common', icon: 'bag', value: 0.9, text: 'Your next gear pick comes as two copies. Used up then.', bag: 'dup' }, // Mini Duplicator
  lostAndFound: { name: 'Lost and Found', rarity: 'Common', icon: 'box', value: 0.7, text: "Losing a game gives a random gear of the scouting tier's rarity.", onLose: 'tierGear' }, // Locked Box
  // --- Uncommon ---
  grinderGloves: { name: "Grinder's Gloves", rarity: 'Uncommon', icon: 'glove', value: 1.6, needs: 'Grinder', text: 'Your Grinders Pressure +1.', abilities: [add('pressure', 1, arch('Grinder'))] }, // Fire Orb
  heavyKnuckles: { name: 'Heavy Knuckles', rarity: 'Uncommon', icon: 'glove', value: 1.6, needs: 'Enforcer', text: 'Your Enforcers Rattle +1.', abilities: [add('rattle', 1, arch('Enforcer'))] }, // Poison Orb
  blockerPads: { name: 'Shot-blocker Pads', rarity: 'Uncommon', icon: 'pad', value: 1.6, needs: 'Shutdown', text: 'Your Shutdowns Block +1.', abilities: [add('block', 1, arch('Shutdown'))] }, // Winged Fossil
  playmakerBlade: { name: "Playmaker's Blade", rarity: 'Uncommon', icon: 'stick', value: 1.6, needs: 'Playmaker', text: 'Your Playmakers Pass +1.', abilities: [add('pass', 1, arch('Playmaker'))] }, // type orb
  rallyFlag: { name: 'Rally Flag', rarity: 'Uncommon', icon: 'flag', value: 1.3, text: 'On game start, your left side (LW and LD) Shoot +2 this battle.', abilities: [drop((g, side) => skaters(g, side).filter(left).forEach(u => gain(g, u, 'shoot', 2)))] }, // Rally Flag
  defensiveCrest: { name: 'Defensive Crest', rarity: 'Uncommon', icon: 'pad', value: 1.2, text: 'On game start, your D pair Block +1 this battle.', abilities: [drop((g, side) => skaters(g, side).filter(D).forEach(u => gain(g, u, 'block', 1)))] }, // Earth Crest
  powerBand: { name: 'Power Band', rarity: 'Uncommon', icon: 'tape', value: 1.3, text: 'The first card you sign each day gets Shoot +2 permanently.', firstSign: ['shoot', 2] }, // Power Band
  grinderScout: { name: 'Grinder Scout', rarity: 'Uncommon', icon: 'clipboard', value: 1.2, needs: 'Grinder', text: 'Grinders you sign have Pressure +2 permanently.', signGain: ['pressure', 2, c => is(c, 'Grinder')] }, // Fire Bell
  agent: { name: 'Agent', rarity: 'Uncommon', icon: 'clipboard', value: 1.5, text: 'Scouting tier +1.', tier: 1 }, // Market License
  savingsBond: { name: 'Savings Bond', rarity: 'Uncommon', icon: 'cash', value: 1.0, text: 'Interest can pay $3 more a day.', interest: 3 }, // Piggy Bank
  proShopCard: { name: 'Pro Shop Card', rarity: 'Uncommon', icon: 'ticket', value: 1.0, text: 'Items cost $2 less.', itemDiscount: 2 }, // Membership Card
  greedyGloves: { name: 'Greedy Gloves', rarity: 'Uncommon', icon: 'glove', value: 1.5, text: 'Take all three at your next gear pick. Used up then.', bag: 'all' }, // Greedy Gloves
  // --- Rare ---
  proSticks: { name: 'Pro Sticks', rarity: 'Super Rare', icon: 'stick', value: 2.0, text: 'Your skaters Shoot +2.', abilities: [add('shoot', 2, skater)] }, // Hero's Sword
  skillsCoach: { name: 'Skills Coach', rarity: 'Rare', icon: 'whistle', value: 2.0, text: 'Cards you sign get Shoot +2 permanently.', signGain: ['shoot', 2, c => c.pos !== 'G'] }, // Power Bell
  rightSideSpeed: { name: 'Right-side Speed', rarity: 'Rare', icon: 'skate', value: 1.8, text: 'Your right side (RW and RD) cooldown −12%.', abilities: [add('haste', 12, right)] }, // Speed Crest
  pregameSpeech: { name: 'Pregame Speech', rarity: 'Rare', icon: 'whistle', value: 2.0, text: 'On game start, your skaters Shoot +1 this battle.', abilities: [drop((g, side) => skaters(g, side).forEach(u => gain(g, u, 'shoot', 1)))] }, // Warhorn
  bigBody: { name: 'Big Body', rarity: 'Rare', icon: 'pad', value: 1.6, text: "On game start, your slowest skater's shots deal 50% more this battle.", abilities: [drop((g, side) => { const s = skaters(g, side); if (!s.length) return; const u = s.reduce((a, b) => (every(b, g) > every(a, g) ? b : a)); u.shotMult = (u.shotMult ?? 1) * 1.5 })] }, // Metal Bat
  meatAndPotatoes: { name: 'Meat and Potatoes', rarity: 'Rare', icon: 'stick', value: 1.5, text: 'Skaters with no abilities Shoot +3.', abilities: [add('shoot', 3, u => skater(u) && !u.card.abilities.length)] }, // Meteorite
  developmentCamp: { name: 'Development Camp', rarity: 'Rare', icon: 'clipboard', value: 1.8, text: 'A card that levels up gets cooldown −8% permanently.', levelGain: ['haste', 8] }, // Silver Watch
  oddManOut: { name: 'Odd Man Out', rarity: 'Rare', icon: 'skate', value: 1.6, text: 'A skater who shares his archetype with no teammate has cooldown −15%.', abilities: [add('haste', 15, lone)] }, // Kaleidoscope
  lineBlender: { name: 'Line Blender', rarity: 'Rare', icon: 'flag', value: 1.6, unique: true, text: 'Every skater counts as adjacent to every other.', abilities: [{ on: 'passive', blend: true }] }, // Link Cable
  bigSponsor: { name: 'Big Sponsor', rarity: 'Rare', icon: 'cash', value: 2.2, text: 'Pay +$3 a day.', pay: 3 }, // Gold Bar
  insurance: { name: 'Insurance', rarity: 'Rare', icon: 'cash', value: 1.4, text: '+$15 the next time you lose. Used up then.', onLose: 'insurance' }, // Fake Diamond
  scoutingBudget: { name: 'Scouting Budget', rarity: 'Rare', icon: 'ticket', value: 1.5, text: '5 free re-scouts, right now.', onPick: run => { run.freeRescouts += 5 }, consumed: true }, // Arcade Coins
  austerity: { name: 'Austerity', rarity: 'Rare', icon: 'cash', value: 2.0, unique: true, text: 'Pay +$6 a day. The shop stocks no items.', pay: 6, noItems: true }, // Fool's Gold
  // --- Super Rare ---
  rocketSkates: { name: 'Rocket Skates', rarity: 'Super Rare', icon: 'skate', value: 3.0, text: 'Your skaters cooldown −10%.', abilities: [add('haste', 10, skater)] }, // Haste Orb
  centreSkates: { name: "Centre's Skates", rarity: 'Super Rare', icon: 'skate', value: 2.4, text: 'Your C cooldown −20%.', abilities: [add('haste', 20, C)] }, // Haste Crown
  skatingCoach: { name: 'Skating Coach', rarity: 'Super Rare', icon: 'whistle', value: 2.6, text: 'Cards you sign get cooldown −15% permanently.', signGain: ['haste', 15, c => c.pos !== 'G'] }, // Blitz Bell
  ironNet: { name: 'Iron Net', rarity: 'Super Rare', icon: 'net', value: 2.8, text: 'Net +25%.', abilities: [{ on: 'passive', netMult: 1.25 }] }, // Mysterious Charm
  secondEffort: { name: 'Second Effort', rarity: 'Super Rare', icon: 'whistle', value: 2.2, unique: true, text: 'Your game start abilities fire twice.', abilities: [{ on: 'passive', encore: true }] }, // Repeater Charm
  sniperEdge: { name: "Sniper's Edge", rarity: 'Super Rare', icon: 'stick', value: 3.0, needs: 'Sniper', text: 'Your Snipers Rebound +1.', abilities: [add('rebound', 1, arch('Sniper'))] }, // Razor Beak
  developmentDeal: { name: 'Development Deal', rarity: 'Super Rare', icon: 'clipboard', value: 2.8, text: 'The next card you sign levels up. Used up then.', signLevel: true }, // Upgrade Disc
  // --- Legendary (unique) ---
  franchiseSticks: { name: 'Franchise Sticks', rarity: 'Legendary', icon: 'stick', value: 4.0, unique: true, text: "Your skaters' shots deal 20% more.", abilities: [{ on: 'passive', shot: 1.2, who: skater }] }, // Mysterious Gem
  heavyLine: { name: 'Heavy Line', rarity: 'Legendary', icon: 'pad', value: 3.6, unique: true, text: 'Skaters with a cooldown of 5 s or more have 70% bigger stats.', abilities: [{ on: 'passive', big: 1.7, who: slow }] }, // Giant Club
  twinBlades: { name: 'Twin Blades', rarity: 'Legendary', icon: 'stick', value: 4.2, unique: true, text: 'Your C Rebound +1.', abilities: [add('rebound', 1, C)] }, // Winged Crown
  primeYears: { name: 'Prime Years', rarity: 'Legendary', icon: 'weight', value: 3.4, unique: true, text: 'Permanent gains your players make are 80% bigger.', abilities: [{ on: 'passive', perm: 1.8 }] }, // Zenith Stone
  momentum: { name: 'Momentum', rarity: 'Legendary', icon: 'puck', value: 4.0, unique: true, text: 'When a skater acts, he gets Shoot +1 this battle, up to +3.', abilities: [{ on: 'act', of: 'team', run: (g, side, e, src) => src && skater(src) && (src.gain.shoot ?? 0) < 3 && gain(g, src, 'shoot', 1) }] }, // Metronome
  farmSystem: { name: 'Farm System', rarity: 'Legendary', icon: 'flag', value: 3.8, unique: true, text: 'Your Rookie Commons play as Pros.', abilities: [{ on: 'passive', level: u => (cheap(u) && u.level === 1 ? 2 : 0) }] }, // Candy Jar
  goldenWhistle: { name: 'Golden Whistle', rarity: 'Legendary', icon: 'whistle', value: 3.6, unique: true, text: 'On team win, +$10.', winCash: 10 }, // Holy Grail
  mysteryChest: { name: 'Mystery Chest', rarity: 'Legendary', icon: 'box', value: 3.0, unique: true, text: 'Losing a game gives a random Legendary gear.', onLose: 'legendaryGear' }, // Mysterious Chest
}
