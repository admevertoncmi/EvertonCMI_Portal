"use client"

// Login da equipe. Layout pedido pela cliente (referência: tela de login "don."):
// metade esquerda na cor de destaque do tema com a assinatura, metade direita escura com o formulário.
// Cores da Everton: oliva (brand-ink), cobre (brand) e pêssego (brand-soft).

import { useState } from 'react'
import Link from 'next/link'
import { Bodoni_Moda } from 'next/font/google'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import { Loader2, Eye, EyeOff, AlertTriangle } from 'lucide-react'

const display = Bodoni_Moda({ subsets: ['latin'], display: 'swap' })

// Wordmark "everton" usado como máscara: a cor vem da classe de fundo (oliva do tema à esquerda, branco à direita)
const wordmarkMask: React.CSSProperties = {
  WebkitMaskImage: 'url(/everton-wordmark.png)',
  maskImage: 'url(/everton-wordmark.png)',
  WebkitMaskRepeat: 'no-repeat',
  maskRepeat: 'no-repeat',
  WebkitMaskSize: 'contain',
  maskSize: 'contain',
}
const WORDMARK_RATIO = 917 / 190

function Wordmark({ height, className }: { height: number; className: string }) {
  return <span role="img" aria-label="everton" className={`block shrink-0 ${className}`} style={{ ...wordmarkMask, height, width: height * WORDMARK_RATIO }} />
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

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })

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
    }, 1200)
  }

  const inputClass =
    'w-full h-12 px-4 bg-white/[0.04] border border-white/10 rounded-[10px] outline-none text-[14.5px] text-[#F4EFE6] placeholder:text-white/30 hover:border-white/20 focus:border-brand focus:bg-white/[0.06] focus:ring-4 focus:ring-brand/20 transition-colors ' +
    // Autopreenchimento do navegador: mantém o campo escuro (senão fica azul-claro)
    '[&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_#1E1D16] [&:-webkit-autofill]:[-webkit-text-fill-color:#F4EFE6] [&:-webkit-autofill]:[caret-color:#F4EFE6]'

  return (
    <div className="min-h-[100dvh] w-full grid lg:grid-cols-2 bg-[#15140D] text-[#F4EFE6] font-sans selection:bg-brand selection:text-white">

      {/* LADO DA MARCA (computador): fundo na cor de destaque do tema (Configurações › Cores do tema, salvo no banco
          e entregue pelo layout raiz) com a assinatura */}
      <aside className="hidden lg:flex relative overflow-hidden bg-brand-soft items-center justify-center transition-colors">
        <div className="relative flex items-center gap-7 px-10">
          <Wordmark height={68} className="bg-brand-ink" />
          <span aria-hidden="true" className="w-px h-[88px] bg-brand-ink/60" />
          <span className="text-[19px] leading-[1.25] tracking-[0.14em] uppercase text-brand-ink font-light">
            Comunicação<br />&amp; Marketing
          </span>
        </div>
      </aside>

      {/* FORMULÁRIO */}
      <main className="relative flex flex-col items-center justify-center px-6 py-12 min-h-[100dvh] lg:min-h-0">
        <div className="w-full max-w-[340px]">
          {/* Logo inteiro no topo do formulário (no celular, com "Comunicação & Marketing" embaixo) */}
          {/* Logo branco no lado escuro (no celular, com "Comunicação & Marketing" embaixo) */}
          <div className="flex flex-col items-center gap-3 mb-10">
            <Wordmark height={44} className="bg-white" />
            <span className="lg:hidden text-[11px] tracking-[0.2em] uppercase text-white/60">Comunicação &amp; Marketing</span>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="email" className="block text-[13px] font-medium text-white/80">E-mail</label>
              <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} required />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-[13px] font-medium text-white/80">Senha</label>
              <div className="relative">
                <input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputClass} pr-12`} required />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 inline-flex items-center justify-center rounded-lg text-white/40 hover:text-white/80 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 transition-colors"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <div className="pt-3 flex justify-center">
              <button
                type="submit"
                disabled={loading}
                className="min-w-[160px] h-11 px-8 inline-flex items-center justify-center gap-2 rounded-[10px] bg-brand text-white text-[14.5px] font-medium hover:brightness-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/30 disabled:opacity-60 disabled:pointer-events-none transition"
              >
                {loading ? <><Loader2 className="animate-spin" size={16} /> Entrando...</> : 'Entrar'}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <Link href="/esqueci-senha" className="text-[14px] font-semibold text-[#F4EFE6] hover:text-brand-soft underline-offset-4 hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50">
              Esqueceu sua senha?
            </Link>
          </div>
        </div>

        <p className="absolute bottom-5 inset-x-0 text-center text-xs text-white/30">© 2026 Everton Comunicação &amp; Marketing</p>

        {/* Erro: aviso embaixo, como na referência */}
        {error && (
          <div role="alert" className="fixed bottom-14 left-1/2 -translate-x-1/2 z-20 w-[calc(100%-32px)] max-w-[420px] flex items-center gap-2.5 px-4 py-3 rounded-[10px] bg-[#3A1414] border border-red-500/40 text-[13px] text-red-200 shadow-xl">
            <AlertTriangle size={16} className="text-red-400 shrink-0" /> {error}
          </div>
        )}

        {/* Transição depois de autenticar */}
        <div className={`fixed inset-0 z-30 bg-[#15140D] flex flex-col items-center justify-center text-center px-6 transition-opacity duration-300 ${isAuthenticating ? 'opacity-100 visible' : 'opacity-0 invisible'}`} aria-live="polite">
          <Loader2 className="animate-spin text-brand mb-4" size={26} />
          <p className={`${display.className} text-[24px] text-brand-soft`}>Abrindo o painel...</p>
        </div>
      </main>
    </div>
  )
}
