"use client"

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import { Lock, Mail, Loader2, ArrowRight } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  
  const router = useRouter()
  const supabase = createClient()

  // Imagem artística e abstrata para o lado esquerdo e fundo mobile
  const imgFundo = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError('E-mail ou senha incorretos. Tente novamente.')
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

  return (
    <div className="min-h-screen w-full flex font-sans bg-[#212013] lg:bg-white overflow-hidden selection:bg-brand selection:text-white relative">
      
      {/* =========================================================
          LADO ESQUERDO (VISUAL - SÓ DESKTOP)
          ========================================================= */}
      <div className="hidden lg:flex w-1/2 relative bg-[#212013] items-center justify-center p-12 overflow-hidden">
        {/* Fundo com imagem e gradiente para dar contraste */}
        <div className="absolute inset-0 bg-cover bg-center opacity-40 mix-blend-luminosity" style={{ backgroundImage: `url(${imgFundo})` }}></div>
        <div className="absolute inset-0 bg-gradient-to-tr from-[#212013] via-[#212013]/80 to-transparent"></div>
        
        {/* Efeito Glow para dar aquele ar "Premium" */}
        <div className="absolute -top-[20%] -left-[10%] w-[500px] h-[500px] bg-brand/40 blur-[120px] rounded-full mix-blend-screen pointer-events-none"></div>
        
        {/* 🔥 CORREÇÃO: justify-between cola a logo no teto e o rodapé no chão */}
        <div className="relative z-10 w-full max-w-lg flex flex-col justify-between h-full py-8">
          
          {/* LOGO COLADA NO TOPO */}
          <div>
            <img src="/logo-light.png" alt="Logo Everton CMI" className="w-64 md:w-80 h-auto object-contain object-left" />
          </div>
          
          {/* TEXTO CENTRALIZADO NO MEIO */}
          <div className="space-y-6">
            <div className="inline-block px-4 py-2 rounded-full border border-white/20 bg-white/10 backdrop-blur-md">
              <p className="text-[11px] font-semibold text-white ">Gestão Criativa V2.0</p>
            </div>
            <h1 className="text-5xl xl:text-6xl font-semibold text-white leading-[1.1] ">
              Eleve a sua <br/>
              <span className="text-brand">produção.</span>
            </h1>
            <p className="text-zinc-400 font-medium text-lg leading-relaxed max-w-sm">
              Plataforma centralizada para gestão de roteiros, decupagem, edição e aprovação de materiais.
            </p>
          </div>

          {/* RODAPÉ COLADO NO CHÃO */}
          <div className="flex items-center gap-4 text-white/50 text-[11px] font-semibold ">
            <span>Everton CMI</span>
            <div className="w-1 h-1 bg-brand rounded-full"></div>
            <span>All rights reserved 2026</span>
          </div>
        </div>
      </div>

      {/* =========================================================
          LADO DIREITO (FORMULÁRIO CLEAN + FUNDO MOBILE)
          ========================================================= */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 md:p-8 lg:p-12 relative lg:bg-white transition-all duration-700">
        
        {/* FUNDO MOBILE (Visível apenas em ecrãs pequenos) */}
        <div className="lg:hidden absolute inset-0 bg-cover bg-center opacity-30 mix-blend-luminosity" style={{ backgroundImage: `url(${imgFundo})` }}></div>
        {/* 🔥 Melhor contraste no mobile para a logo ler bem */}
        <div className="lg:hidden absolute inset-0 bg-gradient-to-b from-[#212013]/90 via-[#212013]/70 to-[#212013]"></div>
        <div className="lg:hidden absolute -top-[10%] -right-[10%] w-[300px] h-[300px] bg-brand/40 blur-[100px] rounded-full mix-blend-screen pointer-events-none"></div>

        {/* 🔥 LOGO MOBILE FLUTUANTE NO TOPO DO ECRÃ (Fora do cartão branco) */}
        <div className="lg:hidden absolute top-10 left-0 w-full flex justify-center z-20">
          <img src="/logo-light.png" alt="Logo Everton CMI" className="w-56 md:w-64 h-auto object-contain drop-shadow-xl" />
        </div>

        {/* Animação de Sucesso */}
        <div className={`absolute inset-0 z-50 flex flex-col items-center justify-center bg-white transition-all duration-500 ease-out ${isAuthenticating ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
          <div className="w-20 h-20 bg-zinc-50 rounded-2xl flex items-center justify-center mb-6 shadow-inner border border-zinc-100">
            <Loader2 className="animate-spin text-brand" size={32} />
          </div>
          <h3 className="text-xl font-semibold text-zinc-900">A Entrar...</h3>
          <p className="text-zinc-400 text-sm font-medium mt-2">A preparar o seu ambiente de trabalho.</p>
        </div>

        {/* Formulário Principal (Card Branco no Mobile) */}
        <div className={`w-full max-w-[420px] bg-white lg:bg-transparent p-8 md:p-10 lg:p-0 rounded-2xl lg:rounded-none shadow-2xl lg:shadow-none relative z-10 transition-all duration-500 mt-20 lg:mt-0 ${isAuthenticating ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`}>
          
          <div className="mb-8 text-center lg:text-left">
            <h2 className="text-2xl md:text-4xl font-semibold text-zinc-900 ">Bem-vindo(a)</h2>
            <p className="text-zinc-500 font-medium mt-2 text-xs md:text-sm">
              Introduza as suas credenciais para acessar o painel.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 md:space-y-5 text-left">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-zinc-400 ml-1">E-mail corporativo</label>
              <div className="relative flex items-center">
                <Mail className="absolute left-4 text-zinc-400 pointer-events-none" size={18} />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-4 pl-12 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none focus:bg-white focus:border-brand/50 focus:ring-4 focus:ring-brand/10 text-zinc-900 placeholder-zinc-400 font-bold transition-all" 
                  placeholder="exemplo@evertoncmi.com" 
                  required 
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between ml-1">
                <label className="text-[11px] font-semibold text-zinc-400">Senha</label>
                <button type="button" onClick={() => router.push('/esqueci-senha')} className="text-[11px] font-semibold text-brand hover:underline">
                  Esqueceu a senha?
                </button>
              </div>
              <div className="relative flex items-center">
                <Lock className="absolute left-4 text-zinc-400 pointer-events-none" size={18} />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-4 pl-12 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none focus:bg-white focus:border-brand/50 focus:ring-4 focus:ring-brand/10 text-zinc-900 placeholder-zinc-400 font-bold transition-all" 
                  placeholder="••••••••" 
                  required 
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-[12px] font-bold text-center flex items-center justify-center gap-2">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full "></div>
                {error}
              </div>
            )}

            <button 
              disabled={loading}
              className="w-full mt-2 p-4 md:p-5 bg-[#212013] hover:bg-brand text-white rounded-full font-semibold text-xs  transition-all duration-300 shadow-lg hover:shadow-brand/30 active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 disabled:pointer-events-none group"
            >
              {loading && !isAuthenticating ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <>
                  Entrar no Sistema
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
          
          <div className="lg:hidden mt-8 text-center border-t border-zinc-100 pt-6">
             <p className="text-[11px] font-semibold text-zinc-400 ">Everton CMI • V2.0</p>
          </div>

        </div>
      </div>
    </div>
  )
}