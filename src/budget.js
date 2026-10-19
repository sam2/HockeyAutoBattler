// The card budget: what a card's printed stats are worth in net points per second at level 1, and what its rarity
// allows. budget.test.js checks every card against it; the lab's drafting policies price cards with it.
import { PACK, PACKS } from './cards.js'

// Points per second a card of each rarity is worth. The curve is gentle: rarity mostly buys abilities, while levels
// (x2, x4) and permanent gains are what make a late build dwarf an early one.
export const BUDGET = { Common: 2.0, Uncommon: 2.4, Rare: 2.9, 'Super Rare': 3.5, Legendary: 4.2 }
// A goalie is one card against five, so it gets less of the budget; the net meter is the rest of its worth.
const GOALIE = 0.4
// How many net points one point of each stat is worth. Pressure n burns for n + (n-1) + ... + 1 unless a goal clears it.
// A pass bonus is fired by whoever receives it, a little late, so it is worth nearly a Shoot (the sim pays about 0.9).
// A penalty is worth a lot, but only with shooters on the ice, so Rattle is discounted a little.
const POINTS = { shoot: n => n, block: n => n, refill: n => 0.85 * n, pressure: n => (n * (n + 1)) / 2, rattle: n => 0.8 * n, pass: n => 0.9 * n }
// A point of Block costs each pack's block (see PACKS in cards.js): Block only counts when the other team shoots into it
// and never scores, so pack two prices it at 0.75 of a Shoot (at 1 the round robins had pure Shutdown last by far); pack
// one keeps 1 until its own balance pass.
// How much a pass reaches from the card's home seat (a wing, the C, a D or the net): a plain pass reaches every
// adjacent skater, nothing passes to the goalie, and a D receiver counts half, since D shoot small and a bonus is only
// worth the shot that spends it (the lab had C passers weak at full count). A D's own neighbours are his winger, the C
// and the other D.
const REACH = { adjacent: { W: 1.5, C: 3, D: 2.5, G: 1 }, 'adjacent forwards': { W: 1, C: 2, D: 2, G: 0 }, 'your Snipers': { W: 2, C: 2, D: 2, G: 2 }, 'your whole team': { W: 3.5, C: 3.5, D: 3.5, G: 3.5 } }

// Printed stats per second, before abilities. A Rebound pill repeats the others.
export function worth(card, pack = PACK) {
  const rebound = card.pills.find(p => p[0] === 'rebound')?.[1] ?? 0
  const sum = card.pills.reduce((n, [stat, base, target]) => n + (stat === 'rebound' ? 0 : POINTS[stat](base) * (stat === 'pass' ? REACH[target ?? 'adjacent'][card.pos] : stat === 'block' ? PACKS[pack].block : 1)), 0)
  return (sum * (1 + rebound)) / card.every
}
// A vanilla card gets its whole budget in stats, abilities take 30%, and a scaler starts at half because it grows.
export const share = card => (card.stats ?? (card.scaler ? 0.5 : card.abilities.length ? 0.7 : 1)) * (card.pos === 'G' ? GOALIE : 1)
