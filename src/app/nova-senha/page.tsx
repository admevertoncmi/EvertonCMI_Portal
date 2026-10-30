"use client"

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import { Toaster, toast } from 'sonner'
import { Lock, ShieldCheck } from 'lucide-react'

export default function NovaSenha() {
  const supabase = createClient()
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  // Imagem artística para o fundo (mesma da página de login)
  const imgFundo = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop";

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (password.length < 6) return toast.error('A senha deve ter pelo menos 6 caracteres.')
    if (password !== confirmPassword) return toast.error('As senhas não coincidem.')

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: password })

    if (error) {
      toast.error("Erro ao atualizar senha: " + error.message)
    } else {
      toast.success("Senha atualizada com sucesso!")
      // Redireciona o usuário para fazer login com a nova senha após 2 segundos
      setTimeout(() => {
        router.push('/') 
      }, 2000)
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
      <div className="absolute -top-[15%] -left-[10%] w-[400px] h-[400px] bg-brand/30 blur-[120px] rounded-full mix-blend-screen pointer-events-none"></div>
      <div className="absolute -bottom-[10%] -right-[10%] w-[300px] h-[300px] bg-brand/20 blur-[100px] rounded-full mix-blend-screen pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-500">
        {/* Logo */}
        <div className="flex justify-center mb-10">
          <img src="/logo-light.png" alt="Logo Everton CMI" className="w-56 h-auto object-contain drop-shadow-xl" />
        </div>

        {/* Card Principal */}
        <div className="bg-white/[0.07] backdrop-blur-xl border border-white/10 rounded-2xl p-10 shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-brand/20 text-brand rounded-full flex items-center justify-center mx-auto mb-4 border border-brand/30">
              <ShieldCheck size={32} />
            </div>
            <h1 className="text-2xl font-semibold text-white">Nova Senha</h1>
            <p className="text-sm font-medium text-zinc-400 mt-2">Crie uma nova senha segura para a sua conta.</p>
          </div>

          <form onSubmit={handleUpdate} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-zinc-500  ml-2">Nova Senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
                  <input 
                    type="password" 
                    className="w-full p-4 pl-12 bg-white/5 border border-white/10 rounded-2xl font-bold outline-none focus:border-brand/50 focus:ring-4 focus:ring-brand/10 transition-all text-sm text-white placeholder-zinc-500" 
                    placeholder="Mínimo 6 caracteres" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    required 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-zinc-500  ml-2">Confirmar Senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
                  <input 
                    type="password" 
                    className="w-full p-4 pl-12 bg-white/5 border border-white/10 rounded-2xl font-bold outline-none focus:border-brand/50 focus:ring-4 focus:ring-brand/10 transition-all text-sm text-white placeholder-zinc-500" 
                    placeholder="Repita a senha" 
                    value={confirmPassword} 
                    onChange={e => setConfirmPassword(e.target.value)} 
                    required 
                  />
                </div>
              </div>
            </div>

            <button disabled={loading} className="w-full py-5 bg-brand hover:bg-[#b5623e] text-white rounded-full font-semibold text-[11px] shadow-lg shadow-brand/30 hover:scale-[1.02] transition-all disabled:opacity-50 mt-2 flex items-center justify-center gap-2">
              {loading ? "Salvando..." : "Salvar nova senha"}
            </button>
          </form>
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