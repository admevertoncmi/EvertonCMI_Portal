"use client"

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase-browser'

// Mantendo seu mock de toast
const toast = {
  toast: (options: any) => {
    alert(options.title + ': ' + options.description)
  }
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleLogin = async () => {
    startTransition(async () => {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        toast.toast({
          title: "Erro no login",
          description: error.message,
          variant: "destructive",
        })
        return
      }

      // --- ROTEAMENTO INTELIGENTE ATUALIZADO ---
      // Lê o nível de permissão que salvamos no painel de equipe
      const role = data.user?.user_metadata?.role || 'editor'

      if (role === 'planner') {
        router.push('/planner')
      } else if (role === 'editor') {
        router.push('/editor')
      } else {
        router.push('/admin/dashboard') // Admin vai para cá
      }
      
      router.refresh()
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-50">
      <Card className="w-full max-w-md shadow-xl border-zinc-100">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-black      uppercase tracking-tighter">Login da Equipe</CardTitle>
          <CardDescription>Entre com suas credenciais de acesso</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Input 
              placeholder="Email" 
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-zinc-50 border-zinc-200"
            />
          </div>
          <div className="space-y-2">
            <Input 
              placeholder="Senha" 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-zinc-50 border-zinc-200"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleLogin} className="w-full bg-blue-600 hover:bg-blue-700 font-bold tracking-widest uppercase text-xs" disabled={isPending}>
            {isPending ? 'Entrando...' : 'Acessar Painel'}
          </Button>
        </CardFooter>
        <div className="p-6 pt-0 text-xs text-center text-muted-foreground">
          <Link href="/forgot-password" className="underline hover:text-blue-600 transition-colors">
            Esqueceu a senha?
          </Link>
        </div>
      </Card>
    </div>
  )
}