import { useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Button } from './Button'
import './AuthScreen.css'

type AuthMode = 'sign-in' | 'sign-up'

function readableAuthError(message: string) {
  const normalized = message.toLowerCase()
  if (normalized.includes('invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (normalized.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.'
  if (normalized.includes('user already registered')) return 'Já existe uma conta com este e-mail. Entre ou recupere sua senha.'
  if (normalized.includes('password should be at least')) return 'A senha é muito curta.'
  if (normalized.includes('rate limit')) return 'Muitas tentativas. Aguarde um pouco e tente novamente.'
  return 'Não foi possível autenticar. Confira seus dados e tente novamente.'
}

export function AuthScreen({
  client,
  initialError,
}: {
  client: SupabaseClient | null
  initialError: string
}) {
  const [mode, setMode] = useState<AuthMode>('sign-in')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!client || submitting) return

    setError('')
    setNotice('')

    if (mode === 'sign-up' && password !== passwordConfirmation) {
      setError('As senhas não coincidem.')
      return
    }

    setSubmitting(true)
    try {
      if (mode === 'sign-in') {
        const { error: signInError } = await client.auth.signInWithPassword({ email: email.trim(), password })
        if (signInError) setError(readableAuthError(signInError.message))
      } else {
        const { data, error: signUpError } = await client.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: fullName.trim() } },
        })

        if (signUpError) {
          setError(readableAuthError(signUpError.message))
        } else if (!data.session) {
          setNotice('Conta criada. Confira sua caixa de entrada para confirmar o e-mail e depois entre.')
        }
      }
    } catch {
      setError('Não foi possível conectar ao serviço de autenticação. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode)
    setError('')
    setNotice('')
    setPassword('')
    setPasswordConfirmation('')
  }

  return (
    <main className="auth-page">
      <section aria-labelledby="auth-title" className="auth-card">
        <img className="auth-card__logo" src="/images/trama-mark.png" alt="" />
        <p className="auth-card__eyebrow">TRAMA SHEET</p>
        <h1 id="auth-title">{mode === 'sign-in' ? 'Entre na sua conta' : 'Crie sua conta'}</h1>
        <p className="auth-card__intro">
          {mode === 'sign-in'
            ? 'Acesse suas fichas e continue suas aventuras.'
            : 'Crie uma conta para guardar suas fichas e imagens.'}
        </p>

        {!client ? (
          <p className="auth-card__message" role="alert">
            O serviço de autenticação não está configurado neste ambiente.
          </p>
        ) : (
          <form className="auth-form" onSubmit={submit}>
            {mode === 'sign-up' && (
              <>
                <label htmlFor="auth-full-name">Nome</label>
                <input
                  autoComplete="name"
                  id="auth-full-name"
                  name="name"
                  onChange={(event) => setFullName(event.target.value)}
                  required
                  type="text"
                  value={fullName}
                />
              </>
            )}

            <label htmlFor="auth-email">E-mail</label>
            <input
              autoComplete="email"
              autoFocus
              id="auth-email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />

            <label htmlFor="auth-password">Senha</label>
            <input
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              id="auth-password"
              minLength={6}
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />

            {mode === 'sign-up' && (
              <>
                <label htmlFor="auth-password-confirmation">Confirme a senha</label>
                <input
                  autoComplete="new-password"
                  id="auth-password-confirmation"
                  minLength={6}
                  name="password-confirmation"
                  onChange={(event) => setPasswordConfirmation(event.target.value)}
                  required
                  type="password"
                  value={passwordConfirmation}
                />
              </>
            )}

            {(error || initialError) && <p className="auth-card__message auth-card__message--error" role="alert">{error || initialError}</p>}
            {notice && <p className="auth-card__message" role="status">{notice}</p>}

            <Button className="auth-form__submit" disabled={submitting} type="submit">
              {submitting ? 'Aguarde…' : mode === 'sign-in' ? 'Entrar' : 'Criar conta'}
            </Button>
          </form>
        )}

        {client && (
          <p className="auth-card__switch">
            {mode === 'sign-in' ? 'Ainda não tem uma conta?' : 'Já tem uma conta?'}{' '}
            <button
              onClick={() => changeMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
              type="button"
            >
              {mode === 'sign-in' ? 'Criar conta' : 'Entrar'}
            </button>
          </p>
        )}
      </section>
    </main>
  )
}
