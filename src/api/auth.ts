/**
 * Authentification contre la vraie API Smartrek H2O.
 *
 * Découvert par capture réseau (HAR complet) :
 *   POST {API_BASE}/Account/login
 *   body: { email, domain, password, sessionId }
 *   → { user: { _id, email, ... }, domain: {...}, jwtToken, refreshToken,
 *       sessionId, expiresIn: "15m" }
 *
 *   POST {API_BASE}/Account/refreshtoken
 *   body: { token: <refreshToken>, sessionId }
 *   → même forme que login (nouveau jwtToken + refreshToken + expiresIn)
 *
 * Les tokens expirent après ~15 minutes — on les renouvelle automatiquement
 * en arrière-plan via refreshToken, avant l'expiration, tant que l'onglet
 * reste ouvert. L'utilisateur entre ses identifiants dans l'écran de login
 * au runtime — rien n'est jamais compilé dans le bundle.
 *
 * ATTENTION CORS : la réponse capturée sur /api/v2/boot renvoyait
 *   Access-Control-Allow-Origin: https://app3.smartrekh2o.com
 * Si un appel depuis le navigateur échoue avec une erreur CORS, il faudra
 * un petit proxy serveur (voir README) qui relaie la requête.
 */

export const API_BASE = import.meta.env.VITE_SMARTREK_API_BASE ?? 'https://data3.smartrek.io/api'
const SESSION_KEY = 'smartrek_h2o_session'

interface AuthPayload {
  user: { _id: string; email: string; firstName?: string; lastName?: string }
  jwtToken: string
  refreshToken: string
  sessionId: string
  expiresIn: string
}

interface Session {
  jwtToken: string
  refreshToken: string
  sessionId: string
  userId: string
  expiresAt: number // epoch ms
}

let session: Session | null = null
let refreshTimer: ReturnType<typeof setTimeout> | null = null
let onExpiredCallback: (() => void) | null = null

function generateSessionId(): string {
  return crypto.randomUUID()
}

/** Parse "15m" / "30s" / "1h" → durée en millisecondes. Défaut prudent si format inattendu. */
function parseExpiresIn(value: string): number {
  const match = /^(\d+)\s*([smh])$/i.exec(value.trim())
  if (!match) return 10 * 60 * 1000
  const amount = Number(match[1])
  const unit = match[2].toLowerCase()
  const multiplier = unit === 's' ? 1000 : unit === 'm' ? 60 * 1000 : 60 * 60 * 1000
  return amount * multiplier
}

function persistSession(s: Session) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(s))
}

function loadPersistedSession(): Session | null {
  const raw = sessionStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    const parsed: Session = JSON.parse(raw)
    if (parsed.expiresAt <= Date.now()) return null
    return parsed
  } catch {
    return null
  }
}

function applyAuthPayload(data: AuthPayload) {
  const expiresAt = Date.now() + parseExpiresIn(data.expiresIn)
  session = {
    jwtToken: data.jwtToken,
    refreshToken: data.refreshToken,
    sessionId: data.sessionId,
    userId: data.user._id,
    expiresAt,
  }
  persistSession(session)
  scheduleRefresh()
}

function scheduleRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer)
  if (!session) return
  // Renouvelle à 80% de la durée de vie du token, jamais avant 5s ni après l'expiration.
  const lifetime = session.expiresAt - Date.now()
  const delay = Math.max(5000, Math.min(lifetime * 0.8, lifetime - 2000))
  refreshTimer = setTimeout(() => {
    refreshSession().catch(() => {
      clearToken()
      onExpiredCallback?.()
    })
  }, delay)
}

async function refreshSession(): Promise<void> {
  if (!session) throw new Error('Aucune session à renouveler.')
  const res = await fetch(`${API_BASE}/Account/refreshtoken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/plain, */*' },
    body: JSON.stringify({ token: session.refreshToken, sessionId: session.sessionId }),
  })
  if (!res.ok) throw new Error(`refreshtoken a échoué : ${res.status}`)
  const data: AuthPayload = await res.json()
  applyAuthPayload(data)
}

export async function login(email: string, password: string): Promise<void> {
  const res = await fetch(`${API_BASE}/Account/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/plain, */*' },
    body: JSON.stringify({ email, domain: email, password, sessionId: generateSessionId() }),
  })
  if (!res.ok) {
    throw new Error(`Login Smartrek H2O échoué : ${res.status} ${res.statusText}`)
  }
  const data: AuthPayload = await res.json()
  applyAuthPayload(data)
}

// Restaure une session encore valide au chargement de l'app (ex. refresh de page).
session = loadPersistedSession()
if (session) scheduleRefresh()

export function getCachedToken(): string | null {
  return session?.jwtToken ?? null
}

export function getUserId(): string | null {
  return session?.userId ?? null
}

/** Appelé quand le renouvellement automatique échoue définitivement — permet à l'UI de revenir à l'écran de login. */
export function onSessionExpired(cb: () => void): void {
  onExpiredCallback = cb
}

export function clearToken(): void {
  session = null
  sessionStorage.removeItem(SESSION_KEY)
  if (refreshTimer) clearTimeout(refreshTimer)
}
