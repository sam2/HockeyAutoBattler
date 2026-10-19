// Items: one-shot buys in the shop's item slot that resolve the moment you pay. Each is modelled on a Batomon item
// (named in the comment). can(run, kit) says whether it has anything to do; use(run, kit) does it. kit is run.js's
// toolkit (rand, dressed, perm, offer, roll, levelUp, addCard), so this file never imports run.js.
// value is what a bot thinks it is worth, in the same scale as gear.
import { CARDS } from './cards.js'
import { is } from './sim.js'

const skaterOf = ([, o]) => CARDS[o.id].pos !== 'G'
const ofArch = a => ([, o]) => is(CARDS[o.id], a)
const some = (list, kit) => list[Math.floor(kit.rand() * list.length)]
const drill = (name, arch, stat, n, icon) => ({
  name, rarity: 'Rare', cost: 2, icon, value: 1.6, needs: arch, text: `Give your ${arch}s +${n} ${cap(stat)} permanently.`,
  can: (run, kit) => kit.dressed().some(ofArch(arch)), use: (run, kit) => kit.dressed().filter(ofArch(arch)).forEach(([, o]) => kit.perm(o, stat, n)),
})
const report = (name, rarity, tier) => ({ // tickets: re-scout with every card of one rarity
  name, rarity, cost: 0, icon: 'ticket', value: 0.6 + 0.4 * tier, text: `Re-scout the shop with all ${rarity} players.`,
  can: () => true, use: (run, kit) => kit.roll(rarity),
})
const cap = s => s[0].toUpperCase() + s.slice(1)

export const ITEMS = {
  // --- Common ---
  stickTape: { name: 'Stick Tape', rarity: 'Common', cost: 1, icon: 'tape', value: 1.0, text: 'Give 2 random dressed skaters +1 Shoot permanently.', can: (run, kit) => kit.dressed().some(skaterOf), use: (run, kit) => { const s = kit.dressed().filter(skaterOf); for (const [, o] of s.sort(() => kit.rand() - 0.5).slice(0, 2)) kit.perm(o, 'shoot', 1) } }, // Cake
  freePass: { name: 'Free Pass', rarity: 'Common', cost: 0, icon: 'ticket', value: 0.6, text: 'Gain 1 free re-scout.', can: () => true, use: run => { run.freeRescouts++ } }, // Fake Coin
  teamDiscount: { name: 'Team Discount', rarity: 'Common', cost: 0, icon: 'cash', value: 0.8, text: 'Reduce the cost of players in your shop by $1 today.', can: run => !run.discount, use: run => { run.discount = 1 } }, // Coupon
  sideBet: { name: 'Side Bet', rarity: 'Common', cost: 0, icon: 'cash', value: 0.8, text: 'If you win the next game, gain $8.', can: run => !run.bet, use: run => { run.bet = 8 } }, // Gray Chip
  farmReport: { name: 'Farm Report', rarity: 'Common', cost: 0, icon: 'clipboard', value: 0.2, text: 'Lower the scouting tier for today.', can: run => run.tier > 1, use: run => { run.tier-- } }, // Basic Bait
  juniorReport: report('Junior Report', 'Common', 0), // Gray Ticket
  // --- Uncommon ---
  teamDinner: { name: 'Team Dinner', rarity: 'Uncommon', cost: 2, icon: 'dinner', value: 1.6, text: 'Give your dressed skaters +1 Shoot permanently.', can: (run, kit) => kit.dressed().some(skaterOf), use: (run, kit) => kit.dressed().filter(skaterOf).forEach(([, o]) => kit.perm(o, 'shoot', 1)) }, // Feast
  callUp: { name: 'Call-up', rarity: 'Uncommon', cost: 4, icon: 'clipboard', value: 1.4, text: 'Raise the scouting tier for today.', can: run => run.tier < 5, use: run => { run.tier++ } }, // Apex Bait
  collegeReport: report('College Report', 'Uncommon', 1), // Green Ticket
  sellTheBus: { name: 'Sell the Bus', rarity: 'Uncommon', cost: 0, icon: 'cash', value: 0.5, text: '+$8 and lose 1 patience.', can: run => run.patience > 1, use: run => { run.cash += 8; run.patience-- } }, // Red Coin
  skateSharpening: { name: 'Skate Sharpening', rarity: 'Uncommon', cost: 1, icon: 'skate', value: 1.0, text: 'Give a random dressed skater −5% cooldown permanently.', can: (run, kit) => kit.dressed().some(skaterOf), use: (run, kit) => kit.perm(some(kit.dressed().filter(skaterOf), kit)[1], 'haste', 5) }, // Nana Berry
  equipmentBag: { name: 'Equipment Bag', rarity: 'Uncommon', cost: 3, icon: 'bag', value: 1.2, text: 'Choose 1 of 3 Common gear.', can: run => !run.offer, use: (run, kit) => kit.offer('Common') }, // Dowsing Rod
  // --- Rare ---
  shootingDrill: drill('Shooting Drill', 'Sniper', 'shoot', 1, 'puck'),
  passingDrill: drill('Passing Drill', 'Playmaker', 'pass', 1, 'puck'),
  filmRoom: drill('Film Room', 'Shutdown', 'block', 1, 'clipboard'),
  heavyBag: drill('Heavy Bag', 'Enforcer', 'rattle', 1, 'glove'),
  goalieCoach: { name: 'Goalie Coach', rarity: 'Rare', cost: 2, icon: 'whistle', value: 1.4, text: 'Give your goalie +2 Refill permanently.', can: (run, kit) => kit.dressed().some(([p, o]) => p === 'G' && CARDS[o.id].pos === 'G'), use: (run, kit) => kit.perm(run.lineup.G, 'refill', 2) }, // Mystic Pearl
  trainingCamp: { name: 'Training Camp', rarity: 'Rare', cost: 6, icon: 'weight', value: 2.2, text: 'Level up a random Rookie Common or Uncommon player.', can: (run, kit) => kit.rookies(true).length > 0, use: (run, kit) => kit.levelUp(some(kit.rookies(true), kit)) }, // Basic Candy
  luckyLoonie: { name: 'Lucky Loonie', rarity: 'Rare', cost: 0, icon: 'cash', value: 1.0, text: 'Gain $5.', can: () => true, use: run => { run.cash += 5 } }, // Lucky Coin
  proReport: report('Pro Report', 'Rare', 2), // Blue Ticket
  // --- Super Rare ---
  morningSkate: { name: 'Morning Skate', rarity: 'Super Rare', cost: 2, icon: 'skate', value: 1.6, text: 'In the next game, game start abilities activate an additional time.', can: run => !run.encore, use: run => { run.encore = 1 } }, // Coffee
  tradeDeadline: { name: 'Trade Deadline', rarity: 'Super Rare', cost: 5, icon: 'box', value: 2.4, text: 'Get a random Legendary player.', can: (run, kit) => kit.room(), use: (run, kit) => kit.addCard(some(Object.keys(CARDS).filter(id => CARDS[id].rarity === 'Legendary'), kit)) }, // Lootbox
  equipmentBagPro: { name: 'Pro Equipment Bag', rarity: 'Super Rare', cost: 5, icon: 'bag', value: 2.6, text: 'Choose 1 of 3 Super Rare gear.', can: run => !run.offer, use: (run, kit) => kit.offer('Super Rare') }, // Purple Gift
  allStarReport: report('All-Star Report', 'Super Rare', 3), // Purple Ticket
  // --- Legendary ---
  prospectCamp: { name: 'Prospect Camp', rarity: 'Legendary', cost: 7, icon: 'weight', value: 3.0, text: 'Level up a random Rookie player.', can: (run, kit) => kit.rookies(false).length > 0, use: (run, kit) => kit.levelUp(some(kit.rookies(false), kit)) }, // Rare Candy
  equipmentTruck: { name: 'Equipment Truck', rarity: 'Legendary', cost: 6, icon: 'truck', value: 3.6, text: 'Choose 1 of 3 Legendary gear.', can: run => !run.offer, use: (run, kit) => kit.offer('Legendary') }, // Golden Gift
  legendReport: report('Legend Report', 'Legendary', 4), // Golden Ticket
}
