// Pixel art with no image files: portrait(id) returns SVG markup.
// One head renderer feeds two figures, so a card looks the same everywhere: bust() is a 24x24 headshot
// (coaches), sprite() a 32x32 full body in chibi proportion (cards). Both face front, so nothing is mirrored.
const OUT = '#14141f'
const SKINS = { light: '#f2c9a0', tan: '#dba875', brown: '#a9683f', dark: '#6b3f23' }
const HAIR = { blond: '#e0b44a', brown: '#5b3a1e', dark: '#2a1d17', black: '#1f1f2a', red: '#b5502a', grey: '#9a9a9a', white: '#e8e8e8', ginger: '#d9772e' }
const shade = (hex, k) => '#' + [1, 3, 5].map(i => Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * k)).toString(16).padStart(2, '0')).join('')
const luma = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).reduce((s, v, i) => s + v * [0.3, 0.59, 0.11][i], 0)
const lift = hex => (luma(hex) >= 50 ? hex : '#3d404d')
const VISOR = '#8fd0ee', CAGE = '#d6dde2', DARK = '#1a1a24', WHITE = '#ffffff', MOUTH = '#7a2a2a'
const PANTS = '#2b2e3a', BOOT = '#23232b', STEEL = '#d6dde2', TAPE = '#f4f4f4', SHAFT = '#8c96a3', WOOD = '#c8975a', PUCK = '#111118', PAD = '#f2f0e8'
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i)

function svg(rows, size) {
  const paths = {}
  rows.forEach((r, y) => r.forEach((c, x) => { if (c) paths[c] = (paths[c] ?? '') + `M${x} ${y}h1v1h-1z` }))
  return `<svg viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" aria-hidden="true" style="display:block;width:100%;height:100%">${Object.entries(paths).map(([fill, d]) => `<path fill="${fill}" d="${d}"/>`).join('')}</svg>`
}

function canvas(S) {
  const g = Array.from({ length: S }, () => Array(S).fill(null))
  const put = (x, y, c) => { if (x >= 0 && x < S && y >= 0 && y < S) g[y][x] = c }
  const box = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(x, y, c) }
  const row = (y, xs, c) => xs.forEach(x => put(x, y, c))
  const line = (x0, y0, x1, y1, c) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1; for (let i = 0; i <= n; i++) put(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), c) }
  const outline = () => { const out = g.map(r => r.slice()); for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (!g[y][x] && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g[y + dy]?.[x + dx])) out[y][x] = OUT; return svg(out, S) }
  return { g, put, box, row, line, outline, S }
}

const palette = L => ({
  skin: SKINS[L.skin ?? 'light'], hair: HAIR[L.hair ?? 'brown'], team: lift(L.team), trim: L.trim,
  helm: L.helmet ? lift(L.helmet) : lift(L.team), shell: L.mask ?? WHITE, art: L.art ?? L.trim,
})

// The head: box hx0..hx1 by hy0..hy1 (hy0 is the hairline), everything placed relative to it.
// Layers: back hair, skin, face, top hair, headgear, masks, hats.
function drawHead(C, L, P, hx0, hx1, hy0, hy1, square) {
  const { put, box, row, g } = C, F = new Set(L.f ?? []), { skin, hair, helm, shell, art, trim } = P
  const cx = Math.floor((hx0 + hx1 + 1) / 2), top = hy0, w = hx1 - hx0 + 1
  const eyes = w >= 11 ? [hx0 + 2, hx1 - 2] : [hx0 + 1, hx1 - 1], ey = top + 5
  const Y = k => top + k

  if (F.has('mullet')) { box(hx0 - 2, Y(5), hx0 - 1, hy1 + 2, hair); box(hx1 + 1, Y(5), hx1 + 2, hy1 + 2, hair) }
  if (F.has('flow')) { box(hx0 - 2, Y(1), hx0 - 1, hy1 - 1, hair); box(hx1 + 1, Y(1), hx1 + 2, hy1 - 1, hair) }
  if (F.has('afro')) { box(hx0 - 3, Y(-4), hx1 + 3, Y(5), hair); box(hx0 - 2, Y(6), hx0 - 2, Y(8), hair); box(hx1 + 2, Y(6), hx1 + 2, Y(8), hair); [[hx0 - 3, Y(-4)], [hx1 + 3, Y(-4)], [hx0 - 3, Y(5)], [hx1 + 3, Y(5)]].forEach(([x, y]) => put(x, y, null)) }
  if (F.has('braids')) for (const x of [hx0 - 2, hx0 - 1, hx1 + 1, hx1 + 2]) for (let y = Y(1); y <= hy1 + 1; y++) if ((x + y) % 2) put(x, y, hair)
  if (F.has('ponytail')) { box(hx1 + 1, Y(2), hx1 + 2, hy1 + 1, hair); put(hx1 + 2, hy1 + 2, hair) }

  box(hx0, hy0, hx1, hy1, skin)
  put(hx0, hy0, null); put(hx1, hy0, null)
  if (!square) { put(hx0, hy1, null); put(hx1, hy1, null) }
  if (L.build === 'slim') { put(hx0, hy1 - 1, null); put(hx1, hy1 - 1, null) }
  if (F.has('bald') || F.has('mohawk')) box(hx0 + 1, hy0 - 1, hx1 - 1, hy0 - 1, skin)
  if (F.has('stubble')) box(hx0 + 1, Y(8), hx1 - 1, hy1, shade(skin, 0.86))

  const browY = F.has('angry') ? Y(4) : Y(3)
  if (!F.has('shades')) eyes.forEach(x => { put(x, browY, hair); put(x + (x < cx ? 1 : -1), F.has('angry') ? browY - 1 : browY, hair) })
  if (F.has('grin') || F.has('gapGrin')) { row(Y(8), [cx - 2, cx - 1, cx, cx + 1], WHITE); row(Y(9), [cx - 2, cx - 1, cx, cx + 1], OUT); if (F.has('gapGrin')) put(cx, Y(8), OUT) }
  else row(Y(8), [cx - 1, cx], MOUTH)
  if (F.has('beard')) { box(hx0, Y(8), hx1, hy1, hair); row(Y(8), [cx - 1, cx], MOUTH) }
  if (F.has('goatee')) box(cx - 2, Y(9), cx + 1, hy1, hair)
  if (F.has('chinstrap')) { box(hx0, hy1 - 1, hx1, hy1, hair); box(hx0, Y(6), hx0, hy1, hair); box(hx1, Y(6), hx1, hy1, hair) }
  if (F.has('mustache')) row(Y(7), range(cx - 3, cx + 2), hair)
  if (F.has('handlebar')) { row(Y(7), range(cx - 4, cx + 3), hair); put(cx - 4, Y(8), hair); put(cx + 3, Y(8), hair) }
  if (F.has('scar')) { put(eyes[1] + 1, Y(6), '#c4604f'); put(eyes[1] + 1, Y(7), '#c4604f'); put(eyes[1], Y(7), '#c4604f') }
  eyes.forEach(x => put(x, ey, DARK))
  if (F.has('blackEye')) { put(eyes[1], Y(6), '#6b3a8a'); put(eyes[1] + 1, Y(6), '#6b3a8a') }
  if (F.has('shades')) { box(eyes[0] - 1, Y(4), eyes[0] + 1, Y(5), DARK); box(eyes[1] - 1, Y(4), eyes[1] + 1, Y(5), DARK); row(Y(4), [cx - 1, cx], DARK) }

  if (['short', 'flow', 'mullet', 'ponytail', 'braids', 'curly', 'slick', 'bun'].some(k => F.has(k))) {
    box(hx0 + 1, top - 2, hx1 - 1, top - 1, hair); box(hx0, top, hx1, top, hair)
    box(hx0, top + 1, hx0, top + 3, hair); box(hx1, top + 1, hx1, top + 3, hair)
  }
  if (F.has('buzz')) { box(hx0 + 1, top - 1, hx1 - 1, top - 1, shade(hair, 1.1)); box(hx0, top, hx1, top, hair) }
  if (F.has('curly')) { row(top - 3, [hx0 + 2, hx0 + 4, hx1 - 2], hair); put(hx0 - 1, top + 1, hair); put(hx1 + 1, top + 2, hair); put(hx0 - 1, top + 3, hair) }
  if (F.has('slick')) row(top - 2, [hx0 + 2, hx0 + 3, hx0 + 4], shade(hair, 1.6))
  if (F.has('afro')) box(hx0, top - 2, hx1, top, hair)
  if (F.has('bun')) box(cx - 2, top - 5, cx + 1, top - 3, hair)
  if (F.has('mohawk')) { box(cx - 1, top - 6, cx, top - 1, hair); box(cx - 1, top - 6, cx, top - 6, shade(hair, 1.2)) }
  if (F.has('ponytail')) box(hx1 + 1, top - 1, hx1 + 1, Y(2), hair)

  if (F.has('helmet')) {
    box(hx0 - 1, top - 2, hx1 + 1, top + 3, helm); put(hx0 - 1, top - 2, null); put(hx1 + 1, top - 2, null)
    box(hx0 + 1, top - 3, hx1 - 1, top - 3, helm); box(hx0 - 1, top + 4, hx0 - 1, top + 5, helm); box(hx1 + 1, top + 4, hx1 + 1, top + 5, helm)
    row(top - 1, [hx0 + 1, hx0 + 2], shade(helm, 1.3))
    if (F.has('earflaps')) { box(hx0 - 2, Y(3), hx0 - 1, Y(7), helm); box(hx1 + 1, Y(3), hx1 + 2, Y(7), helm) }
    if (F.has('strap')) { box(hx0 - 1, Y(4), hx0 - 1, Y(10), OUT); box(hx1 + 1, Y(4), hx1 + 1, Y(10), OUT) }
  }
  if (F.has('visor')) { row(Y(4), range(hx0, hx1), VISOR); row(Y(5), range(hx0, hx1), VISOR); eyes.forEach(x => put(x, ey, '#2a4a60')) }
  if (F.has('cage')) {
    for (const y of [Y(4), Y(7), Y(10)]) row(y, range(hx0 - 1, hx1 + 1), CAGE)
    for (const x of [hx0 - 1, cx - 2, cx + 1, hx1 + 1]) box(x, Y(4), x, hy1, CAGE)
    if (F.has('dangler')) box(hx0 + 1, hy1 + 1, hx1 - 1, hy1 + 2, CAGE)
  }
  if (F.has('headband')) box(hx0 - 1, top, hx1 + 1, top + 1, trim)
  const paintArt = kind => {
    if (kind === 'stripes') { box(cx - 1, top - 4, cx, top - 1, art); box(hx0 - 2, Y(3), hx0 - 1, hy1 - 1, art); box(hx1 + 1, Y(3), hx1 + 2, hy1 - 1, art) }
    if (kind === 'flames') for (const [x, y] of [[hx0 - 1, Y(7)], [hx0 - 1, Y(8)], [hx0, Y(6)], [hx0, Y(8)], [hx1 + 1, Y(7)], [hx1 + 1, Y(8)], [hx1, Y(6)], [hx1, Y(8)], [cx - 1, top - 3], [cx, top - 2], [cx + 1, top - 3]]) put(x, y, art)
    if (kind === 'bricks') for (let y = top - 4; y <= hy1 + 1; y++) for (let x = hx0 - 2; x <= hx1 + 2; x++) if (g[y]?.[x] === shell && ((y % 3 === 0) || (x + (Math.floor(y / 3) % 2) * 2) % 4 === 0)) put(x, y, art)
    if (kind === 'horns') { for (const [x, y] of [[hx0 - 2, top - 3], [hx0 - 2, top - 2], [hx0 - 1, top - 1], [hx1 + 2, top - 3], [hx1 + 2, top - 2], [hx1 + 1, top - 1]]) put(x, y, art); box(cx - 1, top - 4, cx, top - 3, art) }
    if (kind === 'bolt') for (const [x, y] of [[cx + 1, top - 3], [cx, top - 2], [cx - 1, top - 1], [cx, top], [cx - 1, top + 1], [cx - 2, top + 2]]) put(x, y, art)
  }
  if (F.has('maskFull')) {
    box(hx0 - 2, top - 3, hx1 + 2, hy1 + 1, shell); [[hx0 - 2, top - 3], [hx1 + 2, top - 3], [hx0 - 2, hy1 + 1], [hx1 + 2, hy1 + 1]].forEach(([x, y]) => put(x, y, null))
    box(hx0 + 1, top - 4, hx1 - 1, top - 4, shell)
    box(hx0, Y(3), hx1, hy1, DARK)
    for (const y of [Y(5), Y(8)]) row(y, range(hx0, hx1), CAGE)
    for (const x of [hx0 + 1, cx - 1, cx + 2, hx1 - 1]) box(x, Y(3), x, hy1, CAGE)
    paintArt(L.design ?? 'stripes')
  }
  if (F.has('maskVintage')) {
    box(hx0, top, hx1, hy1, shell); put(hx0, top, null); put(hx1, top, null); put(hx0, hy1, null); put(hx1, hy1, null)
    row(Y(4), [eyes[0], eyes[0] + 1, eyes[1] - 1, eyes[1]], DARK)
    for (let y = Y(6); y <= hy1 - 1; y++) for (let x = hx0 + 1; x <= hx1 - 1; x++) if ((x + y) % 2 === 0) put(x, y, shade(shell, 0.6))
    row(Y(7), [cx - 1, cx], shade(shell, 0.6))
    paintArt(L.design ?? 'none')
  }
  if (F.has('maskCat')) {
    box(hx0 - 1, top - 3, hx1 + 1, hy1, shell); [[hx0 - 1, top - 3], [hx1 + 1, top - 3], [hx0 - 1, hy1], [hx1 + 1, hy1]].forEach(([x, y]) => put(x, y, null))
    for (const x of eyes) { box(x - 1, Y(4), x + 1, Y(5), DARK); put(x, Y(4), CAGE); put(x, Y(5), CAGE) }
    row(Y(9), [cx - 2, cx - 1, cx, cx + 1], DARK); row(hy1, [cx - 2, cx + 1], DARK)
    paintArt(L.design ?? 'flames')
  }
  if (F.has('fedora')) { box(hx0 - 3, Y(2), hx1 + 3, Y(2), helm); box(hx0, Y(-3), hx1, Y(1), helm); put(hx0, Y(-3), null); put(hx1, Y(-3), null); box(hx0, Y(1), hx1, Y(1), shade(helm, 0.6)) }
  if (F.has('flatcap')) { box(hx0 - 1, Y(-2), hx1 + 1, Y(1), helm); put(hx0 - 1, Y(-2), null); put(hx1 + 1, Y(-2), null); box(cx, Y(2), hx1 + 3, Y(2), shade(helm, 0.7)) }
  if (F.has('tophat')) { box(hx0 - 2, Y(2), hx1 + 2, Y(2), helm); box(hx0, Y(-5), hx1, Y(1), helm); box(hx0, Y(1), hx1, Y(1), trim) }
  if (F.has('toque')) { box(hx0 - 1, Y(-3), hx1 + 1, Y(1), helm); put(hx0 - 1, Y(-3), null); put(hx1 + 1, Y(-3), null); box(hx0 - 1, Y(1), hx1 + 1, Y(2), trim); box(cx - 1, Y(-5), cx, Y(-4), trim) }
}

// --- Bust: 24x24 headshot ---
const HEADS = { slim: [8, 15, 5, 16, false], avg: [8, 15, 5, 16, false], heavy: [7, 16, 5, 17, true] }
const SHOULDERS = { slim: [[8, 15], [6, 17], [5, 18]], avg: [[7, 16], [5, 18], [4, 19]], heavy: [[6, 17], [3, 20], [2, 21]] }
function bust(L) {
  const C = canvas(24), { box, row, put } = C, P = palette(L), F = new Set(L.f ?? [])
  const [hx0, hx1, hy0, hy1, square] = HEADS[L.build ?? 'avg'], cx = 12
  const sh = SHOULDERS[L.build ?? 'avg']
  box(sh[0][0], 19, sh[0][1], 19, P.team); box(sh[1][0], 20, sh[1][1], 20, P.team); box(sh[2][0], 21, sh[2][1], 23, P.team)
  box(sh[2][0], 22, sh[2][1], 22, P.trim)
  if (L.pads) { box(sh[2][0], 19, sh[2][0] + 3, 21, shade(P.team, 0.8)); box(sh[2][1] - 3, 19, sh[2][1], 21, shade(P.team, 0.8)) }
  row(19, [cx - 3, cx - 2, cx + 1, cx + 2], P.trim)
  if (F.has('captain')) { box(sh[2][0] + 1, 21, sh[2][0] + 2, 21, P.trim); box(sh[2][0] + 1, 23, sh[2][0] + 2, 23, P.trim); put(sh[2][0] + 1, 22, P.trim) }
  if (F.has('suit')) { box(cx - 1, 19, cx, 23, WHITE); row(19, [cx - 1, cx], P.trim); box(cx - 1, 20, cx, 23, P.trim) }
  box(cx - 2, hy1, cx + 1, 18, P.skin)
  drawHead(C, L, P, hx0, hx1, hy0, hy1, square)
  return C.outline()
}

// --- Sprite: 32x32 full body ---
// 3x5 digits for the jersey number.
const DIGIT = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111']
// Three silhouettes: slim is a narrow head on a long neck and a thin torso, heavy a wide tall head on a squat wide one.
const SPRITE_HEAD = { slim: [12, 19, 7, 16, false], avg: [11, 20, 6, 16, false], heavy: [9, 22, 5, 17, true] }
const TORSO = { slim: 4, avg: 6, heavy: 8 } // half width
const NECK = { slim: 1, avg: 0, heavy: -1 } // torso top shift
// Poses: crouch drops the body, arms set each sleeve ('down' | 'out' | 'up'), stick names a stick shape.
const POSES = {
  ready: { arms: ['down', 'down'], stick: 'ready' },
  shoot: { arms: ['down', 'out'], stick: 'shoot', lean: 1, puck: true },
  pass: { arms: ['out', 'down'], stick: 'sweep', puck: true },
  fists: { arms: ['up', 'up'], fists: true },
  block: { arms: ['down', 'down'], stick: 'flat', crouch: 3 },
  check: { arms: ['out', 'up'], lean: 1, stick: 'ready' },
  cross: { arms: ['out', 'out'], stick: 'high' },
  stance: { arms: ['down', 'down'], goalie: true, stick: 'goalie' },
  butterfly: { arms: ['out', 'out'], goalie: true, butterfly: true, stick: 'goalie', crouch: 2 },
  handle: { arms: ['out', 'out'], goalie: true, stick: 'goalieOut', puck: true },
}

function sprite(L, poseName = 'ready') {
  const C = canvas(32), { box, row, put, line } = C, P = palette(L), F = new Set(L.f ?? []), pose = POSES[poseName]
  const [hx0, hx1, hy0, hy1, square] = SPRITE_HEAD[L.build ?? 'avg'], cx = 16, hw = TORSO[L.build ?? 'avg'] + (pose.goalie ? 1 : 0)
  const crouch = pose.crouch ?? 0, lean = pose.lean ?? 0
  const dark = shade(P.team, 0.78), glove = shade(P.team, 0.55)
  const top = 18 - crouch + NECK[L.build ?? 'avg'] // torso top row; crouch removes torso rows, head follows
  const tx0 = cx - hw, tx1 = cx + hw - 1
  const bottom = 24 // torso bottom row (hem)

  // Legs and skates, then pants, torso, arms, head, stick.
  const legY = 28
  if (pose.butterfly) {
    box(cx - 11, 27, cx - 1, 31, PAD); box(cx + 1, 27, cx + 11, 31, PAD)
    for (const y of [28, 30]) { row(y, range(cx - 11, cx - 1), shade(PAD, 0.85)); row(y, range(cx + 1, cx + 11), shade(PAD, 0.85)) }
    box(cx - 11, 31, cx - 9, 31, BOOT); box(cx + 9, 31, cx + 11, 31, BOOT)
  } else if (pose.goalie) {
    box(cx - 8, 24, cx - 2, 30, PAD); box(cx + 1, 24, cx + 7, 30, PAD)
    for (const y of [25, 27, 29]) { row(y, range(cx - 8, cx - 2), shade(PAD, 0.85)); row(y, range(cx + 1, cx + 7), shade(PAD, 0.85)) }
    box(cx - 7, 31, cx - 3, 31, BOOT); box(cx + 2, 31, cx + 6, 31, BOOT)
  } else {
    const spread = pose.stick === 'shoot' ? 1 : 0
    for (const s of [-1, 1]) {
      const x0 = cx + (s < 0 ? -5 - spread : 2 + spread), x1 = x0 + 2
      box(x0, legY, x1, legY + 1, P.team); row(legY + 1, range(x0, x1), P.trim) // socks with a stripe
      box(x0, 30, x1 + (s > 0 ? 1 : 0), 30, BOOT); box(x0 - (s < 0 ? 1 : 0), 31, x1 + 1, 31, STEEL)
    }
    box(cx - 6, 25, cx + 5, 27, PANTS); row(27, [cx - 6, cx + 5], shade(PANTS, 0.7))
  }
  // Torso.
  box(tx0 + lean, top, tx1 + lean, bottom, P.team)
  box(tx1 + lean - 1, top + 1, tx1 + lean, bottom, dark) // shadow side
  row(bottom, range(tx0 + lean, tx1 + lean), P.trim); row(bottom - 1, range(tx0 + lean, tx1 + lean), shade(P.trim, 0.9))
  row(top, [cx - 2 + lean, cx + 1 + lean], P.trim) // collar
  if (pose.goalie) { box(tx0 + lean, top, tx1 + lean, top + 1, shade(P.team, 0.85)) }
  if (L.num !== undefined) { // number on the chest
    const ds = String(L.num).split(''), w = ds.length * 4 - 1, x0 = cx - Math.floor(w / 2) + lean + (F.has('captain') ? 1 : 0), y0 = top + 2
    ds.forEach((d, i) => { for (let k = 0; k < 15; k++) if (DIGIT[+d][k] === '1') put(x0 + i * 4 + (k % 3), y0 + Math.floor(k / 3), WHITE) })
  }
  if (F.has('captain')) { put(tx0 + lean + 1, top + 2, P.trim); put(tx0 + lean + 1, top + 3, P.trim); put(tx0 + lean + 1, top + 4, P.trim); put(tx0 + lean + 2, top + 2, P.trim); put(tx0 + lean + 2, top + 4, P.trim) }
  // Arms: sleeves 2 wide, a trim stripe, a glove (or a fist, blocker, trapper).
  const arm = (s, how) => {
    const ax = s < 0 ? tx0 + lean - 2 : tx1 + lean + 1 // outer sleeve column start
    box(s < 0 ? tx0 + lean : tx1 + lean, top + 1, s < 0 ? tx0 + lean : tx1 + lean, top + 5, shade(P.team, 0.6))
    let hand
    if (how === 'down') { box(ax, top + 1, ax + 1, top + 6, P.team); row(top + 4, [ax, ax + 1], P.trim); hand = [ax, top + 7] }
    if (how === 'out') { const ex = s < 0 ? ax - 2 : ax + 2; box(ax, top + 1, ax + 1, top + 3, P.team); box(ex, top + 3, ex + 1, top + 5, P.team); row(top + 3, [ax, ax + 1], P.trim); hand = [ex, top + 6] }
    if (how === 'up') { box(ax, top - 3, ax + 1, top + 2, P.team); row(top, [ax, ax + 1], P.trim); hand = [ax, top - 5] }
    if (s > 0) box(ax + 1, hand[1] - 1, ax + 1, hand[1] - 1, null)
    if (pose.fists) box(hand[0], hand[1], hand[0] + 1, hand[1] + 1, P.skin)
    else if (pose.goalie && s < 0) box(hand[0] - 1, hand[1] - 1, hand[0] + 2, hand[1] + 2, PAD) // trapper
    else if (pose.goalie) box(hand[0] - 1, hand[1] - 1, hand[0] + 2, hand[1] + 3, shade(PAD, 0.9)) // blocker
    else box(hand[0], hand[1], hand[0] + 1, hand[1] + 1, glove)
    return hand
  }
  const hL = arm(-1, pose.arms[0]), hR = arm(1, pose.arms[1])
  // Neck and head.
  const hy = crouch
  box(cx - 2, hy1 - hy, cx + 1, top, P.skin)
  drawHead(C, L, P, hx0 + lean, hx1 + lean, hy0 - hy + (crouch ? 1 : 0), hy1 - hy + (crouch ? 1 : 0), square)
  // Stick, drawn over the body: a two-pixel shaft with a highlight, a taped blade, and a dark edge where it crosses the figure.
  const stickPx = new Set(), SH = '#5b6572', HI = '#aab3bf'
  const sp = (x, y, c) => { put(x, y, c); stickPx.add(y * 32 + x) }
  const sline = (x0, y0, x1, y1) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1; for (let i = 0; i <= n; i++) { const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n); sp(x, y, HI); sp(x + 1, y, SH) } }
  const blade = (x, y, dir) => { for (let i = 0; i < 4; i++) { sp(x + dir * i, y, TAPE); sp(x + dir * i, y + 1, TAPE) } }
  const puck = (x, y) => { sp(x, y, PUCK); sp(x + 1, y, PUCK) }
  if (pose.stick === 'ready') { sline(hR[0], hR[1] + 1, cx - 8, 30); blade(cx - 8, 30, -1) }
  if (pose.stick === 'shoot') { sline(hL[0], hL[1] + 1, cx + 10, 30); blade(cx + 10, 30, 1); if (pose.puck) puck(cx + 14, 31) }
  if (pose.stick === 'sweep') { sline(hL[0], hL[1] + 1, cx + 9, 29); blade(cx + 9, 29, 1); if (pose.puck) puck(cx + 13, 30) }
  if (pose.stick === 'flat') { for (let x = cx - 10; x <= cx + 7; x++) { sp(x, top + 8, HI); sp(x, top + 9, SH) } blade(cx + 8, top + 8, 1) }
  if (pose.stick === 'high') { sline(hL[0], hL[1], hR[0] + 2, hR[1] - 7); blade(hR[0] + 2, hR[1] - 8, 1) }
  if (pose.stick === 'goalie') { for (let y = hR[1] - 2; y <= 29; y++) { sp(hR[0] + 3, y, HI); sp(hR[0] + 4, y, SH) } for (let x = hR[0] + 3; x <= hR[0] + 8; x++) { sp(x, 30, DARK); sp(x, 31, DARK) } }
  if (pose.stick === 'goalieOut') { sline(hR[0] + 1, hR[1] + 2, cx + 12, 29); for (let x = cx + 11; x <= cx + 15; x++) { sp(x, 30, DARK); sp(x, 31, DARK) } if (pose.puck) puck(cx + 13, 29) }
  for (const k of stickPx) { const x = k % 32, y = Math.floor(k / 32); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (C.g[ny]?.[nx] && !stickPx.has(ny * 32 + nx)) put(nx, ny, OUT) } }
  return C.outline()
}

// build sets the shoulders and jaw; f lists features (hair, headgear, face, captain); team/trim/helmet/mask/art/hair/skin
// set the colors; pose and num dress the full-body sprite. Each look nods to the legend the card parodies.
const LOOKS = {
  // Pack two (cards2.js), seeded from the card id
  seabrick: { build: 'avg', team: '#1c4a9c', trim: '#ffffff', helmet: '#1c4a9c', hair: 'black', skin: 'brown', f: ['helmet', 'frown'], pose: 'block', num: 77 },
  kopistop: { build: 'avg', team: '#f74902', trim: '#1e1e24', helmet: '#f74902', hair: 'red', skin: 'light', f: ['helmet', 'frown'], pose: 'ready', num: 70 },
  carbonnope: { build: 'slim', team: '#556b2f', trim: '#ffffff', helmet: '#556b2f', hair: 'grey', skin: 'light', f: ['helmet', 'scar'], pose: 'cross', num: 48 },
  calmonen: { build: 'avg', team: '#00843d', trim: '#ffffff', hair: 'black', skin: 'dark', f: ['mullet', 'beard'], pose: 'cross', num: 40 },
  boomfrion: { build: 'avg', team: '#5b2d8e', trim: '#1e1e24', helmet: '#5b2d8e', hair: 'blond', skin: 'tan', f: ['helmet', 'frown'], pose: 'block', num: 23 },
  blockade: { build: 'avg', team: '#f74902', trim: '#1e1e24', hair: 'ginger', skin: 'dark', f: ['afro', 'frown'], pose: 'ready', num: 88 },
  grindamour: { build: 'avg', team: '#006d75', trim: '#041e42', hair: 'black', skin: 'light', f: ['bald'], pose: 'cross', num: 5 },
  longwall: { build: 'slim', team: '#c8102e', trim: '#041e42', hair: 'grey', skin: 'light', f: ['afro', 'frown', 'captain'], pose: 'block', num: 13 },
  grindby: { build: 'heavy', team: '#1c4a9c', trim: '#f1be48', helmet: '#1c4a9c', hair: 'black', skin: 'brown', f: ['helmet', 'angry'], pose: 'check', num: 55 },
  scraper: { build: 'heavy', team: '#556b2f', trim: '#f1be48', helmet: '#556b2f', hair: 'brown', skin: 'brown', f: ['helmet', 'gapGrin'], pose: 'cross', num: 13 },
  byfoulien: { build: 'heavy', team: '#ce1126', trim: '#c8202c', helmet: '#ce1126', hair: 'blond', skin: 'light', f: ['helmet', 'gapGrin'], pose: 'check', num: 17 },
  screenmonds: { build: 'heavy', team: '#ce1126', trim: '#f1be48', helmet: '#ce1126', hair: 'dark', skin: 'dark', f: ['helmet', 'gapGrin'], pose: 'check', num: 24 },
  mccrashy: { build: 'heavy', team: '#8fd0ee', trim: '#1e1e24', helmet: '#8fd0ee', hair: 'dark', skin: 'brown', f: ['helmet', 'angry'], pose: 'check', num: 61 },
  orpicks: { build: 'heavy', team: '#f47a38', trim: '#1e1e24', helmet: '#f47a38', hair: 'dark', skin: 'brown', f: ['helmet', 'stubble'], pose: 'check', num: 90 },
  clobber: { build: 'heavy', team: '#c8102e', trim: '#1e1e24', hair: 'grey', skin: 'tan', f: ['ponytail', 'stubble'], pose: 'cross', num: 40 },
  grilmour: { build: 'heavy', team: '#6f263d', trim: '#ffffff', helmet: '#6f263d', hair: 'grey', skin: 'brown', f: ['helmet', 'beard', 'captain'], pose: 'cross', num: 69 },
  bashear: { build: 'heavy', team: '#556b2f', trim: '#1e1e24', hair: 'dark', skin: 'light', f: ['mullet', 'blackEye', 'angry'], pose: 'check', num: 50 },
  slamuelsson: { build: 'heavy', team: '#00843d', trim: '#f1be48', hair: 'grey', skin: 'light', f: ['short', 'scar', 'angry'], pose: 'fists', num: 10 },
  aggravery: { build: 'heavy', team: '#ffb81c', trim: '#c8202c', hair: 'red', skin: 'light', f: ['buzz', 'angry'], pose: 'check', num: 12 },
  ottrage: { build: 'heavy', team: '#5b2d8e', trim: '#1e1e24', hair: 'blond', skin: 'tan', f: ['braids', 'gapGrin', 'angry'], pose: 'check', num: 77 },
  faneuff: { build: 'heavy', team: '#f74902', trim: '#041e42', hair: 'grey', skin: 'tan', f: ['afro', 'blackEye', 'angry'], pose: 'fists', num: 50 },
  marchmenace: { build: 'heavy', team: '#6f263d', trim: '#ffffff', hair: 'red', skin: 'light', f: ['braids', 'gapGrin', 'angry'], pose: 'check', num: 62 },
  shanahammer: { build: 'heavy', team: '#5b2d8e', trim: '#c8202c', hair: 'blond', skin: 'light', f: ['curly', 'blackEye', 'angry'], pose: 'check', num: 8 },
  againla: { build: 'heavy', team: '#6f263d', trim: '#f1be48', hair: 'blond', skin: 'dark', f: ['flow', 'blackEye', 'captain', 'angry'], pose: 'fists', num: 68 },
  sizzlanne: { build: 'slim', team: '#f74902', trim: '#f1be48', helmet: '#f74902', hair: 'red', skin: 'tan', f: ['helmet', 'goatee', 'visor'], pose: 'shoot', num: 97 },
  wristkic: { build: 'slim', team: '#2a9d8f', trim: '#1e1e24', hair: 'blond', skin: 'brown', f: ['mullet'], pose: 'shoot', num: 25 },
  kesselrun: { build: 'slim', team: '#006d75', trim: '#1e1e24', hair: 'ginger', skin: 'light', f: ['braids', 'goatee'], pose: 'shoot', num: 39 },
  weblast: { build: 'slim', team: '#1c4a9c', trim: '#f1be48', helmet: '#1c4a9c', hair: 'ginger', skin: 'light', f: ['helmet', 'goatee', 'visor'], pose: 'shoot', num: 86 },
  laser: { build: 'avg', team: '#8fd0ee', trim: '#041e42', helmet: '#8fd0ee', hair: 'ginger', skin: 'brown', f: ['helmet', 'goatee', 'visor'], pose: 'shoot', num: 17 },
  clutchews: { build: 'slim', team: '#006d75', trim: '#f1be48', helmet: '#006d75', hair: 'blond', skin: 'light', f: ['helmet', 'stubble', 'visor'], pose: 'shoot', num: 87 },
  burnz: { build: 'slim', team: '#0038a8', trim: '#041e42', helmet: '#0038a8', hair: 'dark', skin: 'brown', f: ['helmet', 'grin', 'visor'], pose: 'shoot', num: 77 },
  bossshot: { build: 'slim', team: '#f47a38', trim: '#f1be48', helmet: '#f47a38', hair: 'dark', skin: 'light', f: ['helmet', 'stubble', 'visor', 'captain'], pose: 'shoot', num: 41 },
  hubberdough: { build: 'avg', team: '#f47a38', trim: '#f1be48', helmet: '#f47a38', hair: 'ginger', skin: 'brown', f: ['helmet', 'grin'], pose: 'pass', num: 56 },
  sedtwin: { build: 'slim', team: '#f74902', trim: '#041e42', helmet: '#f74902', hair: 'brown', skin: 'light', f: ['helmet', 'grin'], pose: 'pass', num: 62 },
  feedch: { build: 'avg', team: '#0038a8', trim: '#c8202c', helmet: '#0038a8', hair: 'blond', skin: 'brown', f: ['helmet', 'mustache'], pose: 'pass', num: 69 },
  zuboost: { build: 'slim', team: '#f74902', trim: '#1e1e24', hair: 'blond', skin: 'tan', f: ['mullet'], pose: 'pass', num: 26 },
  lariovision: { build: 'avg', team: '#f47a38', trim: '#c8202c', helmet: '#f47a38', hair: 'ginger', skin: 'tan', f: ['helmet', 'grin'], pose: 'pass', num: 5 },
  kurrier: { build: 'slim', team: '#006d75', trim: '#ffffff', helmet: '#006d75', hair: 'brown', skin: 'brown', f: ['helmet'], pose: 'pass', num: 37 },
  needamayer: { build: 'slim', team: '#556b2f', trim: '#f1be48', helmet: '#556b2f', hair: 'dark', skin: 'tan', f: ['helmet', 'stubble'], pose: 'pass', num: 61 },
  forceberg: { build: 'slim', team: '#c8102e', trim: '#1e1e24', helmet: '#c8102e', hair: 'black', skin: 'tan', f: ['helmet', 'mustache', 'captain'], pose: 'pass', num: 93 },
  foxtrot: { build: 'slim', team: '#f47a38', trim: '#1e1e24', helmet: '#f47a38', hair: 'brown', skin: 'light', f: ['helmet'], pose: 'pass', num: 42 },
  gartfast: { build: 'slim', team: '#ffb81c', trim: '#f1be48', helmet: '#ffb81c', hair: 'grey', skin: 'light', f: ['helmet', 'headband'], pose: 'ready', num: 39 },
  machkinnon: { build: 'avg', team: '#a2aaad', trim: '#c8202c', helmet: '#a2aaad', hair: 'black', skin: 'light', f: ['helmet'], pose: 'shoot', num: 72 },
  hyperman: { build: 'slim', team: '#ce1126', trim: '#041e42', hair: 'grey', skin: 'light', f: ['ponytail', 'stubble'], pose: 'pass', num: 5 },
  hasteling: { build: 'avg', team: '#a2aaad', trim: '#f1be48', hair: 'dark', skin: 'dark', f: ['buzz'], pose: 'pass', num: 23 },
  spinvard: { build: 'slim', team: '#2a9d8f', trim: '#1e1e24', hair: 'blond', skin: 'tan', f: ['afro', 'captain'], pose: 'ready', num: 9 },
  quiet: { build: 'avg', team: '#1c4a9c', trim: '#ffffff', mask: '#1c4a9c', art: '#ffffff', pads: true, f: ['maskFull'], design: 'bricks', pose: 'stance', num: 32 },
  thomauler: { build: 'heavy', team: '#b34d00', trim: '#1e1e24', mask: '#f4f4f4', art: '#b34d00', pads: true, f: ['maskVintage'], design: 'stripes', pose: 'stance', num: 30 },
  hexkill: { build: 'heavy', team: '#5b2d8e', trim: '#f1be48', mask: '#1e1e24', art: '#5b2d8e', pads: true, f: ['maskFull', 'angry'], design: 'bolt', pose: 'handle', num: 27 },
  ricochet: { build: 'slim', team: '#c8202c', trim: '#ffffff', mask: '#f4f4f4', art: '#c8202c', pads: true, f: ['maskFull'], design: 'flames', pose: 'butterfly', num: 35 },
  playnte: { build: 'slim', team: '#2a9d8f', trim: '#ffffff', mask: '#f4f4f4', hair: 'dark', pads: true, f: ['maskVintage', 'mustache'], pose: 'handle', num: 1 },
  millstone: { build: 'heavy', team: '#a2aaad', trim: '#1c4a9c', mask: '#a2aaad', art: '#1c4a9c', pads: true, f: ['maskFull'], design: 'bricks', pose: 'butterfly', num: 30 },
  snowplow: { build: 'heavy', team: '#f4f4f4', trim: '#b34d00', mask: '#f4f4f4', art: '#5b2d8e', pads: true, f: ['maskCat'], design: 'stripes', pose: 'stance', num: 39 },
  brodscore: { build: 'avg', team: '#ce1126', trim: '#1e1e24', mask: '#1e1e24', art: '#ce1126', pads: true, f: ['maskFull'], design: 'bolt', pose: 'handle', num: 30 },
  outlettinger: { build: 'slim', team: '#006847', trim: '#ffffff', mask: '#006847', art: '#ffffff', pads: true, f: ['maskFull'], design: 'flames', pose: 'handle', num: 29 },
  saucos: { build: 'slim', team: '#041e42', trim: '#ffb81c', mask: '#ffb81c', art: '#041e42', pads: true, f: ['maskFull'], design: 'stripes', pose: 'butterfly', num: 74 },
  turbo: { build: 'avg', team: '#ffb81c', trim: '#1e1e24', mask: '#1e1e24', art: '#ffb81c', pads: true, f: ['maskFull'], design: 'bolt', pose: 'handle', num: 35 },
  // Wingers
  sniper: { build: 'slim', team: '#1c4a9c', trim: '#f1be48', helmet: '#f4f4f4', hair: 'blond', f: ['helmet', 'mullet'], pose: 'shoot', num: 99 },
  snapShooter: { build: 'avg', team: '#6f263d', trim: '#236192', hair: 'dark', f: ['helmet', 'visor', 'beard', 'gapGrin'], pose: 'shoot', num: 8 },
  ppSniper: { build: 'heavy', team: '#1e1e24', trim: '#e8b923', hair: 'black', f: ['flow', 'stubble'], pose: 'shoot', num: 68 },
  franchiseSniper: { build: 'slim', team: '#b4975a', trim: '#1e1e24', helmet: '#b4975a', hair: 'dark', f: ['helmet', 'visor', 'strap', 'stubble'], pose: 'shoot', num: 87 },
  mucker: { build: 'heavy', team: '#f74902', trim: '#1e1e24', hair: 'brown', f: ['buzz', 'beard', 'gapGrin'], pose: 'check', num: 15 },
  netFront: { build: 'heavy', team: '#c8202c', trim: '#ffffff', helmet: '#f4f4f4', hair: 'blond', f: ['helmet', 'earflaps', 'short'], pose: 'cross', num: 96 },
  powerForward: { build: 'heavy', team: '#5b2d8e', trim: '#ffffff', hair: 'black', skin: 'dark', f: ['braids', 'short', 'grin'], pose: 'check', num: 12 },
  enforcer: { build: 'heavy', team: '#a2aaad', trim: '#c8202c', hair: 'ginger', f: ['mohawk', 'blackEye', 'gapGrin', 'angry'], pose: 'fists', num: 16 },
  agitator: { build: 'slim', team: '#ffb81c', trim: '#1e1e24', helmet: '#ffb81c', hair: 'red', f: ['helmet', 'visor', 'grin'], pose: 'check', num: 63 },
  saucerPasser: { build: 'avg', team: '#154734', trim: '#ffb81c', hair: 'black', skin: 'brown', f: ['afro', 'mustache'], pose: 'pass', num: 11 },
  // Centers
  twoWayCenter: { build: 'avg', team: '#c8202c', trim: '#ffffff', helmet: '#c8202c', hair: 'brown', f: ['helmet', 'captain'], pose: 'ready', num: 19 },
  checkingCenter: { build: 'heavy', team: '#0038a8', trim: '#c8202c', hair: 'dark', f: ['bald', 'angry', 'frown', 'captain'], pose: 'check', num: 26 },
  shootFirstCenter: { build: 'avg', team: '#2d6a4f', trim: '#ffffff', helmet: '#f4f4f4', hair: 'ginger', f: ['helmet', 'strap', 'goatee'], pose: 'shoot', num: 91 },
  shutdownCenter: { build: 'avg', team: '#3a3f47', trim: '#8fd0ee', helmet: '#8fd0ee', hair: 'dark', skin: 'tan', f: ['helmet', 'beard'], pose: 'ready', num: 37 },
  elitePlaymaker: { build: 'slim', team: '#1f4e9e', trim: '#f08a24', helmet: '#f08a24', hair: 'brown', f: ['helmet', 'visor', 'grin', 'short'], pose: 'pass', num: 97 },
  // Defense
  puckMover: { build: 'slim', team: '#0ea5a0', trim: '#1e1e24', helmet: '#1e1e24', hair: 'blond', f: ['helmet', 'beard', 'ponytail'], pose: 'pass', num: 65 },
  stretchPasser: { build: 'avg', team: '#ffd166', trim: '#1b2f5e', hair: 'blond', skin: 'light', f: ['short', 'headband'], pose: 'pass', num: 5 },
  ppQuarterback: { build: 'heavy', team: '#6b3f23', trim: '#f1be48', hair: 'red', f: ['short', 'handlebar'], pose: 'shoot', num: 2 },
  mentor: { build: 'avg', team: '#c8975a', trim: '#192168', hair: 'grey', f: ['curly', 'mustache', 'captain'], pose: 'ready', num: 20 },
  franchiseD: { build: 'avg', team: '#f4f4f4', trim: '#fcb514', hair: 'brown', f: ['short', 'grin'], pose: 'ready', num: 4 },
  shutdown: { build: 'heavy', team: '#5b6b7c', trim: '#f1be48', helmet: '#5b6b7c', hair: 'blond', f: ['helmet', 'visor', 'scar', 'angry'], pose: 'cross', num: 44 },
  stayAtHome: { build: 'avg', team: '#556b2f', trim: '#ffffff', helmet: '#556b2f', hair: 'dark', skin: 'brown', f: ['helmet', 'angry', 'frown', 'stubble'], pose: 'check', num: 3 },
  shotBlocker: { build: 'heavy', team: '#006d75', trim: '#1e1e24', hair: 'brown', f: ['buzz', 'blackEye', 'scar', 'frown'], pose: 'block', num: 21 },
  clearer: { build: 'heavy', team: '#ffb81c', trim: '#1e1e24', helmet: '#1e1e24', hair: 'dark', skin: 'brown', f: ['helmet', 'visor', 'goatee', 'captain'], pose: 'cross', num: 33 },
  lockdown: { build: 'slim', team: '#1a535c', trim: '#ffffff', helmet: '#f4f4f4', hair: 'blond', skin: 'dark', f: ['helmet', 'beard'], pose: 'ready', num: 77 },
  bruiser: { build: 'avg', team: '#1e1e24', trim: '#a2aaad', helmet: '#a2aaad', hair: 'black', f: ['helmet', 'mullet', 'mustache'], pose: 'fists', num: 7 },
  heavyweight: { build: 'heavy', team: '#ce1126', trim: '#1e1e24', hair: 'dark', skin: 'tan', f: ['bald', 'chinstrap', 'blackEye', 'angry'], pose: 'fists', num: 36 },
  // Goalies
  butterfly: { build: 'avg', team: '#c8202c', trim: '#1e1e24', mask: '#f4f4f4', art: '#c8202c', pads: true, f: ['maskFull'], design: 'stripes', pose: 'butterfly', num: 31 },
  hybrid: { build: 'avg', team: '#00205b', trim: '#ffffff', mask: '#00205b', art: '#ffffff', pads: true, f: ['maskFull'], design: 'bolt', pose: 'stance', num: 35 },
  puckhandler: { build: 'heavy', team: '#6b3f23', trim: '#c8975a', mask: '#f4f4f4', hair: 'brown', pads: true, f: ['maskVintage', 'mullet', 'short'], pose: 'handle', num: 30 },
  positional: { build: 'slim', team: '#5b2d8e', trim: '#ffffff', helmet: '#5b2d8e', hair: 'dark', pads: true, f: ['helmet', 'cage', 'dangler'], pose: 'stance', num: 29 },
  brickWall: { build: 'avg', team: '#f4f4f4', trim: '#c8202c', mask: '#f4f4f4', art: '#b0b7bf', pads: true, f: ['maskCat'], design: 'bricks', pose: 'stance', num: 1 },
  acrobat: { build: 'slim', team: '#002654', trim: '#fcb514', mask: '#fcb514', art: '#002654', pads: true, f: ['maskFull'], design: 'flames', pose: 'butterfly', num: 39 },
  franchiseG: { build: 'avg', team: '#00843d', trim: '#ffffff', mask: '#f4f4f4', art: '#00843d', pads: true, f: ['maskFull'], design: 'bolt', pose: 'butterfly', num: 38 },
  cheater: { build: 'avg', team: '#e8b923', trim: '#1e1e24', mask: '#1e1e24', art: '#e8b923', pads: true, f: ['maskVintage'], design: 'stripes', pose: 'stance', num: 40 },
  runAndGun: { build: 'slim', team: '#ff4c00', trim: '#041e42', mask: '#041e42', art: '#ff4c00', pads: true, f: ['maskFull'], design: 'flames', pose: 'butterfly', num: 32 },
  hacker: { build: 'heavy', team: '#00539b', trim: '#f47d30', mask: '#f4f4f4', art: '#00539b', pads: true, f: ['maskVintage', 'angry'], design: 'bolt', pose: 'handle', num: 41 },
  // Balance-pass additions
  pureShooter: { build: 'slim', team: '#00843d', trim: '#ffffff', helmet: '#00843d', hair: 'black', skin: 'dark', f: ['helmet', 'visor', 'short', 'grin'], pose: 'shoot', num: 10 },
  hotHand: { build: 'slim', team: '#2a9d8f', trim: '#ffffff', helmet: '#2a9d8f', hair: 'ginger', skin: 'tan', f: ['helmet', 'visor', 'flow', 'stubble'], pose: 'shoot', num: 98 },
  captainSniper: { build: 'avg', team: '#f4f4f4', trim: '#1e1e24', helmet: '#1e1e24', hair: 'dark', f: ['helmet', 'visor', 'captain', 'stubble'], pose: 'shoot', num: 71 },
  setupMan: { build: 'slim', team: '#c8102e', trim: '#ffffff', hair: 'blond', skin: 'tan', f: ['curly', 'mustache'], pose: 'pass', num: 88 },
  bigCenter: { build: 'heavy', team: '#e76f51', trim: '#1b2f5e', hair: 'brown', skin: 'tan', f: ['flow', 'beard', 'grin'], pose: 'pass', num: 90 },
  rushingD: { build: 'avg', team: '#f47a38', trim: '#041e42', hair: 'blond', f: ['flow', 'mustache'], pose: 'shoot', num: 27 },
  shootingPasser: { build: 'heavy', team: '#7b3fb0', trim: '#ffffff', helmet: '#7b3fb0', hair: 'black', f: ['helmet', 'mullet', 'stubble'], pose: 'pass', num: 72 },
  franchisePlaymaker: { build: 'slim', team: '#002868', trim: '#ffffff', helmet: '#002868', hair: 'dark', skin: 'brown', f: ['helmet', 'visor', 'short'], pose: 'pass', num: 86 },
  pestD: { build: 'avg', team: '#a0522d', trim: '#ffffff', helmet: '#f4f4f4', hair: 'blond', f: ['helmet', 'mullet', 'gapGrin'], pose: 'check', num: 25 },
  creaseCrasher: { build: 'heavy', team: '#00b4d8', trim: '#1e1e24', helmet: '#00b4d8', hair: 'dark', f: ['helmet', 'visor', 'goatee', 'grin'], pose: 'cross', num: 56 },
  relentless: { build: 'avg', team: '#4a1942', trim: '#ffb81c', hair: 'blond', skin: 'brown', f: ['curly', 'gapGrin', 'captain'], pose: 'check', num: 42 },
  rocket: { build: 'avg', team: '#af1e2d', trim: '#192168', hair: 'black', f: ['slick', 'angry'], pose: 'shoot', num: 9 },
  pest: { build: 'heavy', team: '#4a4e69', trim: '#ea7200', hair: 'ginger', skin: 'tan', f: ['buzz', 'blackEye', 'scar', 'gapGrin'], pose: 'fists', num: 28 },
  hammer: { build: 'heavy', team: '#9b1b5a', trim: '#ffffff', hair: 'blond', f: ['flow', 'beard', 'angry'], pose: 'fists', num: 34 },
  boogeyman: { build: 'heavy', team: '#1e1e24', trim: '#a6192e', helmet: '#1e1e24', hair: 'white', f: ['helmet', 'chinstrap', 'scar', 'angry'], pose: 'fists', num: 24 },
  powerEnforcer: { build: 'heavy', team: '#3b2a7a', trim: '#fcb514', helmet: '#fcb514', hair: 'grey', f: ['helmet', 'short', 'mustache', 'angry'], pose: 'check', num: 18 },
  twoWayWinger: { build: 'avg', team: '#9bc53d', trim: '#1b2f5e', helmet: '#1b2f5e', hair: 'brown', skin: 'tan', f: ['helmet', 'short', 'frown'], pose: 'block', num: 23 },
  towerD: { build: 'heavy', team: '#ffffff', trim: '#002868', helmet: '#002868', hair: 'brown', skin: 'brown', f: ['helmet', 'visor', 'beard'], pose: 'cross', num: 55 },
  dangler: { build: 'slim', team: '#d94f8a', trim: '#ffffff', helmet: '#f4f4f4', hair: 'dark', f: ['helmet', 'visor', 'short', 'grin'], pose: 'pass', num: 13 },
  skatingCenter: { build: 'slim', team: '#8fd0ee', trim: '#1b2f5e', helmet: '#1b2f5e', hair: 'red', f: ['helmet', 'strap', 'short'], pose: 'ready', num: 93 },
  speedster: { build: 'slim', team: '#c77dff', trim: '#1b2f5e', helmet: '#c77dff', hair: 'brown', skin: 'tan', f: ['helmet', 'visor', 'short'], pose: 'shoot', num: 14 },
  // Coaches
  headScout: { build: 'avg', team: '#5b6b7c', trim: '#1b4fa0', helmet: '#1b4fa0', hair: 'brown', f: ['fedora', 'suit', 'shades'] },
  lunchPail: { build: 'heavy', team: '#3a3f47', trim: '#c8202c', helmet: '#2d2f36', hair: 'grey', f: ['flatcap', 'short', 'stubble'] },
  bigMarket: { build: 'avg', team: '#14141f', trim: '#e8b923', helmet: '#14141f', hair: 'white', f: ['tophat', 'suit', 'mustache'] },
  superstar: { build: 'slim', team: '#1b2f5e', trim: '#d4202c', hair: 'black', f: ['slick', 'suit', 'grin'] },
  oldMoney: { build: 'avg', team: '#2b2e3a', trim: '#e8b923', hair: 'white', f: ['slick', 'suit', 'mustache'] },
  twins: { build: 'slim', team: '#c8202c', trim: '#ffffff', hair: 'brown', f: ['curly', 'grin'] },
  farmDirector: { build: 'heavy', team: '#5b6b3a', trim: '#c8975a', helmet: '#5b6b3a', hair: 'ginger', f: ['flatcap', 'beard'] },
  draftGuru: { build: 'avg', team: '#1e1e24', trim: '#8fd0ee', hair: 'grey', f: ['short', 'shades', 'suit'] },
  lotteryWinner: { build: 'heavy', team: '#ffb81c', trim: '#1e1e24', hair: 'brown', f: ['mullet', 'gapGrin', 'stubble'] },
  hardNosed: { build: 'heavy', team: '#6f263d', trim: '#ffffff', hair: 'dark', f: ['buzz', 'angry', 'frown', 'scar'] },
  systemsCoach: { build: 'slim', team: '#2c5f9e', trim: '#ffffff', hair: 'black', skin: 'tan', f: ['short', 'headband', 'suit'] },
  equipmentManager: { build: 'avg', team: '#3a3f47', trim: '#f2b705', helmet: '#3a3f47', hair: 'brown', f: ['toque', 'goatee'] },
  proShopOwner: { build: 'avg', team: '#154734', trim: '#ffb81c', hair: 'red', f: ['bun', 'grin'] },
  skatingAcademy: { build: 'slim', team: '#8fd0ee', trim: '#1b2f5e', hair: 'blond', skin: 'light', f: ['ponytail', 'grin'] },
  bookie: { build: 'heavy', team: '#14141f', trim: '#d4202c', helmet: '#14141f', hair: 'black', f: ['fedora', 'suit', 'handlebar'] },
  shootingCoach: { build: 'avg', team: '#c8102e', trim: '#f1be48', hair: 'brown', skin: 'brown', f: ['afro', 'stubble', 'captain'] },
  rebuild: { build: 'slim', team: '#8b3fd6', trim: '#c79bff', hair: 'white', f: ['flow', 'shades', 'suit', 'grin'] },
}

const cache = new Map()

export function portrait(id) {
  if (cache.has(id)) return cache.get(id)
  const L = LOOKS[id]
  if (!L) throw new Error(`No portrait for ${id}`)
  const out = L.pose ? sprite(L, L.pose) : bust(L)
  cache.set(id, out)
  return out
}

// Gear and item icons: 12x12 pixel glyphs by kind, drawn from strings ('.' is clear). Rarity colors the frame
// around them, so the glyphs stay in one neutral palette.
const INK = { '#': '#14141f', w: '#f4f4f4', g: '#8c96a3', b: '#c8975a', r: '#d4202c', y: '#f2b705', e: '#1b7a43', s: '#8fd0ee', k: '#2b2e3a', o: '#ea7200', p: '#b0b7bf' }
const GLYPHS = {
  stick: ['..........#.', '.........#b#', '........#b#.', '.......#b#..', '......#b#...', '.....#b#....', '....#b#.....', '...#b#......', '..#b#.......', '.#b#........', '#www#.......', '.###........'],
  skate: ['....###.....', '...#www#....', '...#www#....', '...#wwww#...', '...#wwwww#..', '..#wwwwwww#.', '.#kkkkkkkkk#', '.#kkkkkkkkk#', '..#########.', '..#p#...#p#.', '..#p#####p#.', '...#######..'],
  pad: ['..########..', '.#wwwwwwww#.', '.#wrrrrrrw#.', '.#wwwwwwww#.', '.#wrrrrrrw#.', '.#wwwwwwww#.', '.#wrrrrrrw#.', '.#wwwwwwww#.', '.#wrrrrrrw#.', '.#wwwwwwww#.', '.#wwwwwwww#.', '..########..'],
  glove: ['....####....', '...#bbbb#...', '..#bbbbbb#..', '.#bbbbbbbb#.', '.#bb#bb#bb#.', '.#bbbbbbbb#.', '.#bbbbbbbb#.', '..#bbbbbb#..', '..#kkkkkk#..', '..#kkkkkk#..', '...#kkkk#...', '....####....'],
  flag: ['.#..........', '.##.........', '.#r#........', '.#rr#.......', '.#rrr#......', '.#rrrr#.....', '.#rrrrr#....', '.#rrrr#.....', '.#rrr#......', '.#rr#.......', '.#r#........', '.##.........'],
  cash: ['............', '.##########.', '#eeeeeeeeee#', '#e#eeeeee#e#', '#eee#yy#eee#', '#eee#yy#eee#', '#eee#yy#eee#', '#eee#yy#eee#', '#e#eeeeee#e#', '#eeeeeeeeee#', '.##########.', '............'],
  whistle: ['............', '............', '..######....', '.#pppppp##..', '#pppppppppp#', '#pp#ppppppp#', '#pp#ppppp##.', '.#pppppp#...', '..#pppp#....', '...####.....', '............', '............'],
  net: ['############', '#r#r#r#r#r##', '#.#.#.#.#.##', '#r#r#r#r#r##', '#.#.#.#.#.##', '#r#r#r#r#r##', '#.#.#.#.#.##', '#r#r#r#r#r##', '#.#.#.#.#.##', '#r#r#r#r#r##', '#.#.#.#.#.##', '############'],
  bag: ['....####....', '...#....#...', '...#....#...', '.##########.', '#kkkkkkkkkk#', '#kkkkkkkkkk#', '#kkkkrrkkkk#', '#kkkkrrkkkk#', '#kkkkkkkkkk#', '#kkkkkkkkkk#', '#kkkkkkkkkk#', '.##########.'],
  map: ['.##########.', '#wwwwwwwwww#', '#wwwww#wwww#', '#wwww#wwwww#', '#www#wwwwww#', '#www#wwwwww#', '#wwww#wwwww#', '#wwwww#wwww#', '#wwwwww#www#', '#wwwwwwrrww#', '#wwwwwwrrww#', '.##########.'],
  ticket: ['............', '.##########.', '#yyyy##yyyy#', '#yyyy##yyyy#', '#yyyy##yyyy#', '#yyyy##yyyy#', '#yyyy##yyyy#', '#yyyy##yyyy#', '#yyyy##yyyy#', '#yyyy##yyyy#', '.##########.', '............'],
  clipboard: ['....####....', '.###kkkk###.', '#wwwwwwwwww#', '#wwwwwwwwww#', '#w#www#####w', '#wwwwwwwwww#', '#w#www#####w', '#wwwwwwwwww#', '#w#www#####w', '#wwwwwwwwww#', '#wwwwwwwwww#', '.##########.'],
  puck: ['............', '............', '............', '...######...', '.##kkkkkk##.', '#kkkkkkkkkk#', '#kkkkkkkkkk#', '#kkkkkkkkkk#', '.##kkkkkk##.', '...######...', '............', '............'],
  tape: ['............', '...######...', '.##wwwwww##.', '#wwww##wwww#', '#www#..#www#', '#www#..#www#', '#www#..#www#', '#www#..#www#', '#wwww##wwww#', '.##wwwwww##.', '...######...', '............'],
  weight: ['............', '.##......##.', '#kk#....#kk#', '#kk#....#kk#', '#kk######kk#', '#kkpppppppk#', '#kkpppppppk#', '#kk######kk#', '#kk#....#kk#', '#kk#....#kk#', '.##......##.', '............'],
  box: ['............', '.##########.', '#bbbbbbbbbb#', '#bbbb##bbbb#', '############', '#bbbbbbbbbb#', '#bbbbbbbbbb#', '#bbbbbbbbbb#', '#bbbbbbbbbb#', '#bbbbbbbbbb#', '.##########.', '............'],
  dinner: ['............', '............', '...######...', '.##oooooo##.', '#oooyyyyooo#', '#ooyyyyyyoo#', '############', '.#wwwwwwww#.', '..#wwwwww#..', '...######...', '............', '............'],
  truck: ['............', '............', '.########...', '#wwwwwww##..', '#wrrrrrw#s#.', '#wrrrrrw#s##', '#wwwwwww#www', '############', '.#kk#...#kk#', '.#kk#...#kk#', '..##.....##.', '............'],
}
const icons = new Map()
export function icon(kind) {
  if (!icons.has(kind)) icons.set(kind, svg(GLYPHS[kind].map(r => [...r].map(c => (c === '.' ? null : INK[c]))), 12))
  return icons.get(kind)
}
// The duffel that brings gear: a lid and a body drawn apart so the lid can flip open. 40 wide, 24 tall, on a 40x40 canvas.
function duffel(lid) {
  const { box, put, outline } = canvas(40), N = '#24487a', DK = '#173257', GR = '#8c96a3'
  if (lid) {
    for (const [x, y] of [[30, 4], [31, 4], [32, 3], [33, 3], [34, 2], [35, 2], [36, 1], [37, 1]]) put(x, y, '#c8975a') // a stick poking out
    put(37, 0, '#f4f4f4'); put(38, 0, '#f4f4f4')
    for (const x of [9, 22]) { box(x, 1, x + 6, 1, GR); box(x, 2, x, 4, GR); box(x + 6, 2, x + 6, 4, GR) } // handles
    box(4, 5, 35, 9, N); box(5, 5, 34, 5, '#3d6aa8'); box(4, 6, 6, 9, DK); box(33, 6, 35, 9, DK)
    put(4, 5, null); put(35, 5, null)
    for (let x = 5; x <= 34; x++) put(x, 9, x % 2 ? '#b0b7bf' : GR) // zipper teeth
  } else {
    box(3, 10, 36, 21, N); box(3, 10, 6, 21, DK); box(33, 10, 36, 21, DK)
    box(3, 14, 36, 14, '#f4f4f4'); box(3, 15, 36, 16, '#d4202c'); box(3, 17, 36, 17, '#f4f4f4')
    box(7, 21, 32, 21, DK)
    box(17, 11, 22, 13, '#f4f4f4'); box(19, 12, 20, 12, '#d4202c') // team crest
    for (const [x, y] of [[3, 10], [36, 10], [3, 21], [36, 21]]) put(x, y, null)
  }
  return outline()
}
export const BAG = { lid: duffel(true), body: duffel(false) }
