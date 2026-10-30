"use client"

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { Toaster, toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Mail, KeyRound } from 'lucide-react'

export default function EsqueciSenha() {
  const supabase = createClient()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)

  // Imagem artística para o fundo (mesma da página de login)
  const imgFundo = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop";

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return toast.error('Por favor, introduza o seu email.')
    
    setLoading(true)

    // Não consultamos se o e-mail é da equipe: isso exigiria leitura pública de perfis_equipe
    // e revelaria quem faz parte dela. O Supabase só envia o link se o usuário existir.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/nova-senha`,
    })

    if (error) {
      toast.error("Erro ao enviar email: " + error.message)
    } else {
      toast.success("Email enviado com sucesso!")
      setEnviado(true)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center font-sans text-white p-4 relative overflow-hidden bg-[#212013]">
      <Toaster position="top-right" richColors />
      
      {/* Fundo com imagem e gradiente */}
      <div className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-luminosity" style={{ backgroundImage: `url(${imgFundo})` }}></div>
      <div className="absolute inset-0 bg-gradient-to-br from-[#212013] via-[#212013]/80 to-[#212013]/95"></div>

      {/* Efeito Glow */}
      <div className="absolute -top-[15%] -right-[10%] w-[400px] h-[400px] bg-brand/30 blur-[120px] rounded-full mix-blend-screen pointer-events-none"></div>
      <div className="absolute -bottom-[10%] -left-[10%] w-[300px] h-[300px] bg-brand/20 blur-[100px] rounded-full mix-blend-screen pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-500">
        {/* Logo */}
        <div className="flex justify-center mb-10">
          <img src="/logo-light.png" alt="Logo Everton CMI" className="w-56 h-auto object-contain drop-shadow-xl" />
        </div>

        {/* Card Principal */}
        <div className="bg-white/[0.07] backdrop-blur-xl border border-white/10 rounded-2xl p-10 shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-brand/20 text-brand rounded-full flex items-center justify-center mx-auto mb-4 border border-brand/30">
              <KeyRound size={32} />
            </div>
            <h1 className="text-2xl font-semibold text-white">Recuperar Senha</h1>
            <p className="text-sm font-medium text-zinc-400 mt-2">Introduza o seu email corporativo para receber o link de recuperação.</p>
          </div>

          {enviado ? (
            <div className="text-center space-y-6">
              <div className="p-4 bg-brand/10 border border-brand/30 rounded-2xl">
                <p className="text-[#e8a889] font-bold text-sm">Enviámos um link de recuperação para o seu email. Por favor, verifique a sua caixa de entrada (e a pasta de spam).</p>
              </div>
              <button onClick={() => router.push('/')} className="w-full py-4 bg-[#212013] hover:bg-brand text-white rounded-full font-semibold text-[11px] transition-all duration-300 shadow-lg hover:shadow-brand/30 border border-white/10">
                Voltar ao Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-zinc-500  ml-2">O seu E-mail</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
                  <input 
                    type="email" 
                    className="w-full p-4 pl-12 bg-white/5 border border-white/10 rounded-2xl font-bold outline-none focus:border-brand/50 focus:ring-4 focus:ring-brand/10 transition-all text-sm text-white placeholder-zinc-500" 
                    placeholder="exemplo@evertoncmi.com" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    required 
                  />
                </div>
              </div>

              <button disabled={loading} className="w-full py-5 bg-brand hover:bg-[#b5623e] text-white rounded-full font-semibold text-[11px] shadow-lg shadow-brand/30 hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? "A verificar..." : "Receber Link Mágico"}
              </button>

              <button type="button" onClick={() => router.push('/')} className="w-full flex items-center justify-center gap-2 py-4 text-zinc-500 hover:text-white font-bold text-xs transition-colors">
                <ArrowLeft size={16} /> Voltar ao Início
              </button>
            </form>
          )}
        </div>

        {/* Rodapé */}
        <div className="mt-8 flex items-center justify-center gap-4 text-white/30 text-[11px] font-semibold ">
          <span>Everton CMI</span>
          <div className="w-1 h-1 bg-brand rounded-full"></div>
          <span>All rights reserved 2026</span>
        </div>
      </div>
    </div>
  )
}