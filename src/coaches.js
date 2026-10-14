// A run picks one coach from three on offer. Each is modelled on a Batomon trainer (named in the comment).
// Run logic reads these fields directly:
//   freeRescouts, freeArch, freeFirst, tierBonus, startCash, gearBump, itemBump, itemDiscount, penaltyCash
//   prepare(lineup)   adjusts the dressed lineup the sim gets (Superstar System)
//   start(run, kit)   once, on day 1;  onDay(run, kit) each day after the shop rolls;  onWin(run, kit) after a win
//   abilities(run)    sim hooks in the gear format, so a coach can buff the team on the ice
import { CARDS } from './cards.js'
import { is } from './sim.js'

const skater = u => u.slot !== 'G'
const arch = a => u => is(u.card, a)
const uncommonSkater = kit => kit.rollCard('Uncommon', c => c.pos !== 'G')

export const COACHES = {
  headScout: { name: 'Head Scout', text: '3 free re-scouts each day', freeRescouts: 3 }, // Youngster
  lunchPail: { name: 'Lunch-Pail Coach', text: 'The first Grinder you sign each day is free', freeArch: 'Grinder' }, // Bug Catcher
  bigMarket: { name: 'Big-Market Owner', text: 'Scouting tier +1 and $10 to start', tierBonus: 1, startCash: 10 }, // Rich Lady
  superstar: { // Musician
    name: 'Superstar System', text: 'When exactly one Sniper dresses, they play one level higher',
    prepare: lineup => {
      const out = Object.fromEntries(Object.entries(lineup).map(([slot, e]) => [slot, { ...e }]))
      const snipers = Object.values(out).filter(e => is(e.card, 'Sniper'))
      if (snipers.length === 1) snipers[0].level = (snipers[0].level ?? 1) + 1
      return out
    },
  },
  oldMoney: { name: 'Old Money', text: 'The first player you sign each day is free', freeFirst: true }, // Gentleman
  twins: { name: 'The Twins', text: 'Start with two copies of a random Uncommon skater', start: (run, kit) => { const id = uncommonSkater(kit); kit.addCard(id); kit.addCard(id) } }, // Twins
  farmDirector: { // Monster Ranger
    name: 'Farm Director', text: 'Start with an Uncommon skater, and another copy of him joins every 2 days',
    start: (run, kit) => { run.farm = uncommonSkater(kit); kit.addCard(run.farm) },
    onDay: (run, kit) => { if (run.day > 1 && run.day % 2 === 1) kit.addCard(run.farm) },
  },
  draftGuru: { name: 'Draft Guru', text: 'On day 4, a Pro Super Rare player joins your bench', onDay: (run, kit) => { if (run.day === 4) kit.addCard(kit.rollCard('Super Rare'), 2) } }, // Egg Breeder
  lotteryWinner: { name: 'Lottery Winner', text: 'On day 8, a Legendary player joins your bench and you gain $30', onDay: (run, kit) => { if (run.day === 8) { kit.addCard(kit.rollCard('Legendary')); run.cash += 30 } } }, // Gamer
  hardNosed: { name: 'Hard-Nosed Coach', text: 'On win, your Enforcers Rattle +1 permanently', onWin: (run, kit) => kit.dressed().filter(([, o]) => is(CARDS[o.id], 'Enforcer')).forEach(([, o]) => kit.perm(o, 'rattle', 1)) }, // Redhead
  systemsCoach: { name: 'Systems Coach', text: 'Your Shutdowns Block +1, and +1 more each time a player levels up', abilities: run => [{ on: 'passive', add: ['block', 1 + run.levelUps], who: arch('Shutdown') }] }, // Chemist
  equipmentManager: { name: 'Equipment Manager', text: 'Your gear picks are one rarity higher', gearBump: 1 }, // Treasure Hunter
  proShopOwner: { name: 'Pro Shop Owner', text: 'Items are one rarity higher and $1 cheaper', itemBump: 1, itemDiscount: 1 }, // Shopkeeper
  skatingAcademy: { name: 'Skating Academy', text: 'A random Puck-mover joins your bench each day, if there is room', onDay: (run, kit) => { if (kit.room()) kit.addCard(kit.rollCard(undefined, c => is(c, 'Puck-mover'))) } }, // Swim Coach
  bookie: { name: 'Bookie', text: 'Gain $2 each time the other team takes a penalty', penaltyCash: 2 }, // Scavenger
  shootingCoach: { name: 'Shooting Coach', text: 'Your skaters Shoot +1', abilities: () => [{ on: 'passive', add: ['shoot', 1], who: skater }] }, // Black Belt
  rebuild: { name: 'The Rebuild', text: 'On day 7, your dressed players become random Rookie Super Rares', onDay: (run, kit) => { if (run.day === 7) kit.rebuild('Super Rare') } }, // Mad Scientist
}
