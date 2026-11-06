"use client"

import { useState } from 'react'
import Link from 'next/link'
import { Bodoni_Moda } from 'next/font/google'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import { Lock, Mail, Loader2, Eye, EyeOff, ShieldCheck } from 'lucide-react'

// Serifa de alto contraste, da mesma família visual do wordmark da Everton. Só nos títulos do login.
const display = Bodoni_Moda({ subsets: ['latin'], display: 'swap' })

// Wordmark "everton" (sem a linha de baixo) usado como máscara: a cor vem de bg-brand e acompanha "Cores do tema"
const wordmarkMask: React.CSSProperties = {
  WebkitMaskImage: 'url(/everton-wordmark.png)',
  maskImage: 'url(/everton-wordmark.png)',
  WebkitMaskRepeat: 'no-repeat',
  maskRepeat: 'no-repeat',
  WebkitMaskSize: 'contain',
  maskSize: 'contain',
}
const WORDMARK_RATIO = 917 / 190

// Fileiras do wordmark: da mais apagada (topo) à mais forte (base), com deslocamentos alternados
type PatternRow = { opacity: number; offset: number; from: number }
const PATTERN_ROWS: PatternRow[] = [
  { opacity: 0.1, offset: -150, from: 48 },
  { opacity: 0.2, offset: -40, from: -48 },
  { opacity: 0.4, offset: -210, from: 48 },
  { opacity: 1, offset: -95, from: -48 },
]

function WordmarkRows({ rows, height, gap }: { rows: PatternRow[]; height: number; gap: number }) {
  return (
    <div aria-hidden="true" className="flex flex-col w-full min-w-0 overflow-hidden" style={{ gap }}>
      {rows.map((row, i) => (
        <div
          key={i}
          className="login-row flex shrink-0"
          style={{
            gap: height * 0.55,
            marginLeft: row.offset * (height / 50),
            opacity: row.opacity,
            animationDelay: `${i * 90}ms`,
            ['--row-from' as string]: `${row.from}px`,
          }}
        >
          {Array.from({ length: 6 }).map((_, j) => (
            <span key={j} className="shrink-0 bg-brand" style={{ ...wordmarkMask, height, width: height * WORDMARK_RATIO }} />
          ))}
        </div>
      ))}
    </div>
  )
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isAuthenticating, setIsAuthenticating] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError('E-mail ou senha incorretos. Confira os dados e tente de novo.')
      setLoading(false)
      return
    }

    setIsAuthenticating(true)

    const { data: perfil } = await supabase
      .from('perfis_equipe')
      .select('role')
      .eq('id', authData.user.id)
      .single()

    // user_metadata é editável pelo próprio usuário: o role vale só o que está em perfis_equipe
    const role = perfil?.role || 'editor'

    setTimeout(() => {
      if (role === 'planner') router.push('/planner')
      else if (role === 'admin') router.push('/admin/dashboard')
      else router.push('/editor')
      router.refresh()
    }, 1500)
  }

  const inputClass =
    'login-input w-full h-12 pl-10 pr-3 bg-white border border-zinc-200 rounded-[10px] outline-none text-[14.5px] text-zinc-900 placeholder:text-zinc-400 hover:border-zinc-300 focus:border-brand/60 focus:ring-4 focus:ring-brand/10 transition-colors'

  return (
    <div className="min-h-[100dvh] w-full bg-zinc-50 text-zinc-900 font-sans flex items-center justify-center p-0 sm:p-6 lg:p-10 selection:bg-brand-soft selection:text-brand-ink">
      <div className="w-full max-w-[1080px] min-h-[100dvh] sm:min-h-0 grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] bg-white sm:border sm:border-zinc-200 sm:rounded-[20px] overflow-hidden sm:shadow-[0_1px_2px_rgba(33,32,19,0.04),0_16px_48px_-16px_rgba(33,32,19,0.14)]">

        {/* LADO DA MARCA (só desktop) */}
        <aside className="hidden lg:flex relative flex-col bg-brand-soft overflow-hidden pt-12 pb-10 lg:min-h-[660px]">
          <div className="px-12 flex items-center gap-2 text-[13px] text-brand-ink/70">
            <ShieldCheck size={15} className="text-brand" />
            Acesso exclusivo da equipe
          </div>

          <div className="px-12 mt-12">
            <h2 className={`${display.className} text-[46px] leading-[1.04] tracking-[-0.015em] text-brand-ink max-w-[470px] [text-wrap:balance]`}>
              Tudo o que a Everton produz passa por aqui.
            </h2>
            <p className="mt-5 text-[15px] leading-[1.6] text-brand-ink/65 max-w-[420px]">
              Roteiros, decupagem, edição e aprovação dos clientes.
            </p>
          </div>

          <div className="mt-auto pt-10">
            <WordmarkRows rows={PATTERN_ROWS} height={50} gap={18} />
          </div>
        </aside>

        {/* FORMULÁRIO */}
        <section className="relative flex flex-col px-6 pb-8 sm:px-12 sm:pb-12 lg:pt-12">
          {/* Faixa da marca só no celular/tablet */}
          <div className="lg:hidden -mx-6 sm:-mx-12 pt-9 pb-7 bg-brand-soft overflow-hidden">
            <WordmarkRows rows={PATTERN_ROWS.slice(2)} height={34} gap={12} />
            <p className="mt-5 px-6 sm:px-12 flex items-center gap-1.5 text-[12.5px] text-brand-ink/70">
              <ShieldCheck size={14} className="text-brand" /> Acesso exclusivo da equipe
            </p>
          </div>

          <div className="flex-1 flex items-center justify-center py-10">
            <div className="w-full max-w-[340px]">
              <h1 className={`${display.className} text-[38px] leading-none tracking-[-0.01em] text-brand-ink`}>Entrar</h1>
              <p className="text-[14.5px] leading-relaxed text-zinc-500 mt-3">Use o e-mail e a senha da sua conta Everton.</p>

              <form onSubmit={handleLogin} className="mt-8 space-y-5">
                <div className="space-y-2">
                  <label htmlFor="email" className="block text-[13px] font-medium text-zinc-700">E-mail</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputClass}
                      placeholder="nome@evertoncmi.com"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <label htmlFor="password" className="block text-[13px] font-medium text-zinc-700">Senha</label>
                    <Link href="/esqueci-senha" className="text-[13px] text-brand hover:underline underline-offset-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
                      Esqueci a senha
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`${inputClass} pr-11`}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 inline-flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p role="alert" className="px-3.5 py-2.5 bg-red-50 border border-red-100 text-red-700 rounded-[10px] text-[13px]">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 !mt-7 inline-flex items-center justify-center gap-2 rounded-[10px] bg-brand-ink text-white text-[14.5px] font-medium hover:opacity-90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/25 disabled:opacity-60 disabled:pointer-events-none transition-opacity"
                >
                  {loading ? <><Loader2 className="animate-spin" size={16} /> Entrando...</> : 'Entrar'}
                </button>
              </form>
            </div>
          </div>

          <p className="w-full max-w-[340px] mx-auto text-xs text-zinc-400">© 2026 Everton Comunicação & Marketing</p>

          {/* Transição depois de autenticar */}
          <div className={`absolute inset-0 z-10 bg-white flex flex-col items-center justify-center text-center px-6 transition-opacity duration-300 ${isAuthenticating ? 'opacity-100 visible' : 'opacity-0 invisible'}`} aria-live="polite">
            <span className="w-11 h-11 rounded-xl bg-brand-soft text-brand inline-flex items-center justify-center mb-4">
              <Loader2 className="animate-spin" size={20} />
            </span>
            <p className={`${display.className} text-[24px] text-brand-ink`}>Abrindo o painel...</p>
          </div>
        </section>
      </div>
    </div>
  )
}
