/**
 * Authentification contre la vraie API Smartrek H2O.
 *
 * Découvert par capture réseau (DevTools) :
 *   POST {API_BASE}/Account/login
 *   body: { email, domain, password, sessionId }
 *   → réponse attendue : un JWT (forme exacte à confirmer — colle-moi la
 *     réponse complète de /Account/login une fois testée)
 *
 * Les identifiants viennent de variables d'environnement (.env, jamais
 * commité — voir .env.example) et ne sont jamais écrits en dur ici.
 *
 * ATTENTION CORS : la réponse capturée sur /api/v2/boot renvoyait
 *   Access-Control-Allow-Origin: https://app3.smartrekh2o.com
 * c'est-à-dire que le serveur pourrait refuser les requêtes venant d'un
 * autre domaine (localhost:5173, ou notre futur domaine de prod). Si un
 * appel depuis le navigateur échoue avec une erreur CORS, il faudra un
 * petit proxy serveur (voir README) qui relaie la requête depuis le
 * backend plutôt que depuis le navigateur.
 */

const API_BASE = import.meta.env.VITE_SMARTREK_API_BASE ?? 'https://data3.smartrek.io/api'

export interface LoginResponse {
  // TODO: ajuster une fois qu'on a vu la vraie forme de la réponse.
  // Hypothèse de départ basée sur le pattern JWT observé dans les headers
  // Authorization capturés (Bearer <jwt>).
  token: string
  [key: string]: unknown
}

function generateSessionId(): string {
  return crypto.randomUUID()
}

let cachedToken: string | null = null

export async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${API_BASE}/Account/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/plain, */*',
    },
    body: JSON.stringify({
      email,
      domain: email,
      password,
      sessionId: generateSessionId(),
    }),
  })

  if (!res.ok) {
    throw new Error(`Login Smartrek H2O échoué : ${res.status} ${res.statusText}`)
  }

  const data: LoginResponse = await res.json()
  // TODO: le token est peut-être sous data.token, data.accessToken, ou
  // directement dans un header de réponse — à confirmer avec une vraie
  // réponse capturée.
  cachedToken = data.token
  return cachedToken
}

export async function ensureToken(): Promise<string> {
  if (cachedToken) return cachedToken
  const email = import.meta.env.VITE_SMARTREK_EMAIL
  const password = import.meta.env.VITE_SMARTREK_PASSWORD
  if (!email || !password) {
    throw new Error(
      'VITE_SMARTREK_EMAIL / VITE_SMARTREK_PASSWORD manquants — copie .env.example en .env et remplis-les.'
    )
  }
  return login(email, password)
}

export function getCachedToken(): string | null {
  return cachedToken
}

export function clearToken(): void {
  cachedToken = null
}
