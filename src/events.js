// Events: a screen of three choices, dealt before the shop on days 3, 6 and 9 and when the vote of confidence fires.
// One event is drawn from the pool for that day (when). Each is modelled on a Batomon encounter (named in the comment).
// An option: title and text (the description), value (what a bot thinks it is worth, on the gear scale) and use(run, kit, { card, place }), plus
// what it shows: card (an id, or true for one the event rolls when dealt: cards(run, kit)[i]), gear (an id), cash (a
// number) or icon. pick(run, kit) lists the places the player must choose one of first; place is that choice.
import { CARDS, PACK } from './cards.js'
import { is } from './sim.js'

// Events that hand you a named player hand the pack's nearest match when the run plays a pack without him.
const SUBS = { 2: { shutdown: 'seabrick', pureShooter: 'sizzlanne', hammer: 'ottrage', towerD: 'longwall', franchiseD: 'spinvard' } }
const pc = id => SUBS[PACK]?.[id] ?? id

const skater = c => c.pos !== 'G'
const cash = n => ({ title: 'Cash', text: `+$${n}`, cash: n, value: n / 10, use: run => { run.cash += n } })
const gear = (id, value) => ({ gear: id, value, use: (run, kit) => kit.gear(id) })
const main = o => CARDS[o.id].pills[0][0] // the card's first stat
const nextRarity = (r, all) => all[Math.min(all.length - 1, all.indexOf(r) + 1)]
// The archetype most of your dressed skaters share, or any.
const topArch = kit => {
  const n = {}
  for (const [, o] of kit.dressed()) if (skater(CARDS[o.id])) for (const a of [CARDS[o.id].arch, CARDS[o.id].arch2]) if (a) n[a] = (n[a] ?? 0) + 1
  return Object.keys(n).sort((a, b) => n[b] - n[a])[0]
}

export const EVENTS = {
  // --- Day 3 ---
  juniorCamp: { // Bug Collector
    name: 'Junior Camp', when: 3, text: 'A junior camp wraps up down the road. The coach there owes you one and lets you sign a graduate.',
    options: [
      { text: 'Joins as a Pro.', card: pc('shutdown'), value: 1.6, use: (run, kit) => kit.addCard(pc('shutdown'), 2) },
      { text: 'Shoot +3 permanently.', card: pc('pureShooter'), value: 1.4, use: (run, kit) => kit.addCard(pc('pureShooter'), 1, { shoot: 3 }) },
      { text: 'Cooldown −15% permanently.', card: pc('hammer'), value: 1.4, use: (run, kit) => kit.addCard(pc('hammer'), 1, { haste: 15 }) },
    ],
  },
  equipmentRoom: { // Dragon's Nest
    name: 'Unlocked Equipment Room', when: 3, text: "The pro team's equipment room is open and nobody is around. Grab something before the manager gets back.",
    options: [
      gear('proSticks', 2.0),
      { title: 'Draft pick', text: 'A Legendary player joins your bench on day 7, if there is room.', icon: 'ticket', value: 2.4, use: run => { run.draftDay = 7 } },
      cash(10),
    ],
  },
  luckyBounce: { // Rainbow Berry
    name: 'Lucky Bounce', when: 3, text: 'A puck takes a wild bounce off the glass and lands at your feet. The rink rats say it is a lucky one.',
    options: [
      { title: 'Give it to a player', text: '+3 to his first stat permanently.', icon: 'puck', value: 1.4, pick: (run, kit) => kit.dressed().map(([p]) => p), use: (run, kit, { place }) => kit.perm(kit.at(place), main(kit.at(place)), 3) },
      { title: 'Two Lucky Pucks', gear: 'luckyPuck', value: 1.8, use: (run, kit) => kit.gear('luckyPuck', 2) },
      cash(10),
    ],
  },
  agentsCall: { // Traveling Merchant
    name: "Agent's Call", when: 3, text: 'An agent calls with an offer from out of town. He has three things on his desk.',
    cards: (run, kit) => [kit.rollCard('Rare', skater)],
    options: [
      { card: true, value: 1.5, use: (run, kit, { card }) => kit.addCard(card) },
      gear('oddManOut', 1.6),
      gear('insurance', 1.4),
    ],
  },
  // --- Day 6 ---
  lostRookie: { // Baby Basilisk
    name: 'Lost Rookie', when: 6, text: 'A rookie cut from another team turns up at your rink with his bag, asking for a tryout.',
    cards: (run, kit) => { const a = topArch(kit); return [kit.rollCard('Rare', c => skater(c) && (!a || is(c, a)))] },
    options: [
      { card: true, value: 1.8, use: (run, kit, { card }) => kit.addCard(card) },
      { title: 'Rare gear', text: 'Help him find his team, then pick 1 of 3.', icon: 'bag', value: 2.0, use: (run, kit) => kit.offer('Rare') },
      cash(15),
    ],
  },
  gameTape: { // Fossil Discovery
    name: 'Old Game Tape', when: 6, text: 'A reel of old game tape turns up in the rink attic. The defenseman on it is a monster.',
    options: [
      { card: pc('towerD'), value: 2.6, use: (run, kit) => kit.addCard(pc('towerD')) },
      gear('blockerPads', 1.6),
      cash(15),
    ],
  },
  zamboniBreakdown: { // Meteor Crash
    name: 'Zamboni Breakdown', when: 6, text: 'The Zamboni dies mid-flood. Practice is off and the players have an hour to fill.',
    options: [
      { title: 'Run a scrimmage', text: 'Level up a Rookie of your choice.', icon: 'weight', value: 2.2, pick: (run, kit) => kit.rookies(false), use: (run, kit, { place }) => kit.levelUp(place) },
      gear('meatAndPotatoes', 1.5),
      cash(15),
    ],
  },
  rinkRat: { // Pond Fairy
    name: "Rink Rat's Favor", when: 6, text: 'The old rink rat who has been here forever says he can pull one string for you.',
    cards: (run, kit) => [, , kit.rollCard('Super Rare', skater)],
    options: [
      { title: 'Two Agents', gear: 'agent', value: 2.4, use: (run, kit) => kit.gear('agent', 2) },
      gear('bigSponsor', 2.2),
      { card: true, value: 2.2, use: (run, kit, { card }) => kit.addCard(card) },
    ],
  },
  // --- Day 9 ---
  freeAgentFrenzy: { // Dragon Tamer
    name: 'Free Agent Frenzy', when: 9, text: 'Three Legendary free agents are shopping for a contract, and your rink is the first stop.',
    cards: (run, kit) => { const out = []; while (out.length < 3) { const id = kit.rollCard('Legendary', c => skater(c) && !out.some(x => CARDS[x] === c)); if (!out.includes(id)) out.push(id) } return out },
    options: [0, 1, 2].map(() => ({ text: '+3 to his first stat permanently.', card: true, value: 3.6, use: (run, kit, { card }) => kit.addCard(card, 1, { [CARDS[card].pills[0][0]]: 3 }) })),
  },
  hallOfFame: { // Dryad Statue
    name: 'Hall of Fame', when: 9, text: 'The bus stops at the Hall of Fame. The curator, a fan of yours, says you can take one thing home.',
    options: [
      { card: pc('franchiseD'), value: 3.4, use: (run, kit) => kit.addCard(pc('franchiseD')) },
      gear('franchiseSticks', 4.0),
      cash(20),
    ],
  },
  madEquipmentManager: { // Genius Inventor
    name: 'Mad Equipment Manager', when: 9, text: 'An equipment manager with wild hair wants your team to test his inventions.',
    options: [
      { title: 'The Recombobulator', text: 'Every dressed player becomes a random player one rarity higher, same level.', icon: 'box', value: 2.8, use: (run, kit) => kit.rebuild(nextRarity, true) },
      { title: 'The Shock Skates', text: 'Your dressed skaters cooldown −10% permanently.', icon: 'skate', value: 3.0, use: (run, kit) => kit.dressed().filter(([, o]) => skater(CARDS[o.id])).forEach(([, o]) => kit.perm(o, 'haste', 10)) },
      gear('goldenWhistle', 3.6),
    ],
  },
  oldCoach: { // Professor
    name: 'The Old Coach', when: 9, text: 'Your old coach drops by the rink, asks how the kids are, and whether there is anything you need.',
    options: [
      { title: 'Advice on a player', text: 'Level up a player of your choice.', icon: 'whistle', value: 3.2, pick: (run, kit) => kit.players(o => o.level < 3), use: (run, kit, { place }) => kit.levelUp(place) },
      { title: 'Treasure Map and Greedy Gloves', text: 'Your next gear picks are one rarity higher. Take all three at your next gear pick. Both used up then.', gear: 'treasureMap', value: 2.4, use: (run, kit) => { kit.gear('treasureMap'); kit.gear('greedyGloves') } },
      cash(20),
    ],
  },
  // --- Vote of confidence ---
  secondChance: { // Second Chance
    name: 'Second Chance', when: 'vote', text: "The owner's oldest friend pulls you aside after the vote. 'Don't quit now. Take this.'",
    cards: (run, kit) => [, kit.rollCard('Super Rare', skater)],
    options: [
      { title: 'Super Rare gear', text: 'Pick 1 of 3.', icon: 'bag', value: 2.6, use: (run, kit) => kit.offer('Super Rare') },
      { text: 'Joins as a Pro.', card: true, value: 2.8, use: (run, kit, { card }) => kit.addCard(card, 2) },
      gear('ironNet', 2.8),
    ],
  },
}
