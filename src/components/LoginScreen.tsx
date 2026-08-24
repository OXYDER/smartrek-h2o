import { useState, type FormEvent } from 'react'
import { login } from '../api/auth'
import { MapleLeafGlyph } from './MapleLeafGlyph'

export function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email, password)
      onSuccess()
    } catch {
      setError('Connexion échouée. Vérifie ton email et ton mot de passe.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh bg-base text-text flex items-center justify-center p-4 relative overflow-hidden">
      <MapleLeafGlyph
        className="absolute pointer-events-none w-[520px] h-[560px] md:w-[720px] md:h-[760px] -right-24 md:-right-32 top-1/2 -translate-y-1/2"
        opacity={0.9}
      />
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-sm bg-panel/90 backdrop-blur-sm border border-line rounded-lg p-6 flex flex-col gap-4"
      >
        <div>
          <h1 className="font-display font-semibold text-2xl tracking-tight">
            h<span className="text-sap">2</span>o <span className="text-muted font-normal">smartrek</span>
          </h1>
          <p className="text-sm text-muted font-mono">Division Érablière · Connexion</p>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted text-xs font-mono uppercase">Courriel</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            className="bg-panel-raised border border-line rounded px-2 py-1.5 outline-none focus:border-sap"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted text-xs font-mono uppercase">Mot de passe</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="bg-panel-raised border border-line rounded px-2 py-1.5 outline-none focus:border-sap"
          />
        </label>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="bg-sap text-base font-medium px-3 py-2 rounded disabled:opacity-40 mt-1"
        >
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>

        <p className="text-xs text-muted">
          Tes identifiants sont envoyés directement à l'API Smartrek H2O et ne
          sont jamais stockés ailleurs que dans cet onglet.
        </p>
      </form>
    </div>
  )
}
