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
      // Redireciona o utilizador para fazer login com a nova senha após 2 segundos
      setTimeout(() => {
        router.push('/') 
      }, 2000)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 font-sans text-zinc-900 p-4">
      <Toaster position="top-right" richColors />
      
      <div className="w-full max-w-md bg-white border border-zinc-200 rounded-[40px] p-10 shadow-2xl animate-in fade-in zoom-in-95 duration-500">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner border border-green-100">
            <ShieldCheck size={32} />
          </div>
          <h1 className="text-2xl font-black      uppercase tracking-tighter text-zinc-800">Nova Senha</h1>
          <p className="text-sm font-medium text-zinc-500 mt-2">Crie uma nova senha segura para a sua conta.</p>
        </div>

        <form onSubmit={handleUpdate} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-2">Nova Senha</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                <input 
                  type="password" 
                  className="w-full p-4 pl-12 bg-zinc-50 border border-zinc-200 rounded-2xl font-bold outline-none focus:border-green-500 transition-colors text-sm" 
                  placeholder="Mínimo 6 caracteres" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  required 
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-2">Confirmar Senha</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                <input 
                  type="password" 
                  className="w-full p-4 pl-12 bg-zinc-50 border border-zinc-200 rounded-2xl font-bold outline-none focus:border-green-500 transition-colors text-sm" 
                  placeholder="Repita a senha" 
                  value={confirmPassword} 
                  onChange={e => setConfirmPassword(e.target.value)} 
                  required 
                />
              </div>
            </div>
          </div>

          <button disabled={loading} className="w-full py-5 bg-zinc-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg hover:bg-zinc-800 hover:scale-[1.02] transition-all disabled:opacity-50 mt-2">
            {loading ? "A guardar..." : "Guardar Nova Senha"}
          </button>
        </form>
      </div>
    </div>
  )
}