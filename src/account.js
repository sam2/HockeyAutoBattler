// Optional Google sign-in that keeps the run on the player's account, so it follows them to any device. Firebase Auth
// comes from Google's CDN, and only on the hosts Firebase lets sign in; everywhere else (the claude.ai copy, the tests)
// there is no account and the game plays exactly as before. The save itself goes through plain fetch like the pool.
import { DB, shortName } from './ghost.js'

const SDK = 'https://www.gstatic.com/firebasejs/10.14.1/'
const CONFIG = { apiKey: 'AIzaSyB4iYyq3aGGO8ZcPFzc2YCXeyfZA1HhOAY', authDomain: 'hockeyautobattler.firebaseapp.com', projectId: 'hockeyautobattler', appId: '1:102315405334:web:56285ba1e6edc7a2b1c537' }
// The account holds the one run, whatever its pack, and a Hall of Fame per pack (see ui.js).
export const CAN = typeof location !== 'undefined' && ['sam2.github.io', 'localhost'].includes(location.hostname)

let fb = null
// Resolves once the sign-in library is in and has restored any earlier sign-in: the user, or null.
export const ready = CAN
  ? Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js')]).then(async ([app, m]) => {
      // Plain local storage and no popup helper until a tap: Firebase's default loads a hidden page from its own domain
      // at start and can stall there.
      const auth = m.initializeAuth(app.initializeApp(CONFIG), { persistence: m.browserLocalPersistence })
      await auth.authStateReady()
      fb = { auth, m }
      return auth.currentUser
    }).catch(() => null)
  : Promise.resolve(null)
export const loaded = () => !!fb
export const user = () => fb?.auth.currentUser ?? null
export const signIn = () => fb.m.signInWithPopup(fb.auth, new fb.m.GoogleAuthProvider(), fb.m.browserPopupRedirectResolver).then(c => c.user)
export const signOut = () => fb.m.signOut(fb.auth)
// What a pool post needs to carry the account id: the id and a fresh token, or null signed out.
export const signed = async () => { try { const u = user(); return u ? { uid: u.uid, token: await u.getIdToken() } : null } catch { return null } }

// The first name a player shows lives once on their account, not in their ghosts, so hiding it hides it on every ghost
// they ever posted. Anyone can read it; only they can write it.
export async function nameOf(uid) {
  try {
    const r = await fetch(`${DB}/users/${uid}/name.json`, { signal: AbortSignal.timeout(3000) })
    return r.ok ? shortName(await r.json()) : undefined
  } catch { return undefined }
}
export function setName(name) {
  const u = user()
  if (u) u.getIdToken().then(t => fetch(`${DB}/users/${u.uid}/name.json?auth=${t}`, { method: 'PUT', body: JSON.stringify(name ?? null) })).catch(() => {})
}

// A save (the run, or the Hall of Fame as key 'hall') is one JSON string, so the database keeps it exactly (it drops
// empty arrays and objects).
const url = async (u, key) => `${DB}/users/${u.uid}/${key}.json?auth=${await u.getIdToken()}`
// The account's save, null when it has none, undefined when the database can't be reached (nameOf reads the same way).
export async function pull(u, key = 'run') {
  try {
    const r = await fetch(await url(u, key), { signal: AbortSignal.timeout(3000) })
    if (!r.ok) return undefined
    const s = await r.json()
    return s ? JSON.parse(s) : null
  } catch { return undefined }
}
// Overwrite the account's save (null clears it). Fire and forget: a failed upload leaves the last one in place.
// print=silent: the database answers with no body, so an upload costs no download quota.
// Uploads go one at a time, so an older save never lands after a newer one, and a small one outlives a reload.
let queue = Promise.resolve()
export function push(run, key = 'run') {
  const u = user(), body = JSON.stringify(run ? JSON.stringify(run) : null)
  if (u) queue = queue.then(() => url(u, key)).then(to => fetch(to + '&print=silent', { method: 'PUT', body, keepalive: body.length < 60000 })).catch(() => {})
}
