import { useState, type FormEvent } from 'react'
import { login } from '../api/auth'

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
    <div className="min-h-screen bg-base text-text flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-panel border border-line rounded-lg p-6 flex flex-col gap-4"
      >
        <div>
          <h1 className="font-display text-2xl">Smartrek</h1>
          <p className="text-sm text-muted font-mono">Connexion à ton compte</p>
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
