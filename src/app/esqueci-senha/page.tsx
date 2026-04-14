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

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return toast.error('Por favor, introduza o seu email.')
    
    setLoading(true)

    // 1. VERIFICAÇÃO DE SEGURANÇA: O email existe na equipa?
    const { data: membro, error: checkError } = await supabase
      .from('perfis_equipe')
      .select('id')
      .ilike('email', email) // ilike ignora maiúsculas e minúsculas
      .maybeSingle()

    // Se o membro não for encontrado na tabela de perfis, bloqueia a ação
    if (!membro) {
      toast.error('Este e-mail não está cadastrado na nossa equipa.')
      setLoading(false)
      return
    }

    // 2. SE EXISTIR, ENVIA O LINK DE RECUPERAÇÃO
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
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 font-sans text-zinc-900 p-4">
      <Toaster position="top-right" richColors />
      
      <div className="w-full max-w-md bg-white border border-zinc-200 rounded-[40px] p-10 shadow-2xl animate-in fade-in zoom-in-95 duration-500">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner border border-blue-100">
            <KeyRound size={32} />
          </div>
          <h1 className="text-2xl font-black      uppercase tracking-tighter text-zinc-800">Recuperar Senha</h1>
          <p className="text-sm font-medium text-zinc-500 mt-2">Introduza o seu email corporativo para receber o link de recuperação.</p>
        </div>

        {enviado ? (
          <div className="text-center space-y-6">
            <div className="p-4 bg-green-50 border border-green-200 rounded-2xl">
              <p className="text-green-700 font-bold text-sm">Enviámos um link de recuperação para o seu email. Por favor, verifique a sua caixa de entrada (e a pasta de spam).</p>
            </div>
            <button onClick={() => router.push('/')} className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-zinc-800 transition-all">
              Voltar ao Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-2">O seu E-mail</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                <input 
                  type="email" 
                  className="w-full p-4 pl-12 bg-zinc-50 border border-zinc-200 rounded-2xl font-bold outline-none focus:border-blue-500 transition-colors text-sm" 
                  placeholder="exemplo@evertoncmi.com" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  required 
                />
              </div>
            </div>

            <button disabled={loading} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-200 hover:bg-blue-700 hover:scale-[1.02] transition-all disabled:opacity-50">
              {loading ? "A verificar..." : "Receber Link Mágico"}
            </button>

            <button type="button" onClick={() => router.push('/')} className="w-full flex items-center justify-center gap-2 py-4 text-zinc-500 hover:text-zinc-800 font-bold text-xs transition-colors">
              <ArrowLeft size={16} /> Voltar ao Início
            </button>
          </form>
        )}
      </div>
    </div>
  )
}