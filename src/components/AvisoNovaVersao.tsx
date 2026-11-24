'use client'

// Aviso "Saiu uma atualização do sistema".
// Quem deixa o painel ou o app instalado aberto (o app não tem botão de recarregar) continua
// rodando a versão antiga até recarregar — e aí correções já publicadas parecem "não ter funcionado".
// Este componente pergunta ao servidor a versão publicada e, se mudou, pede para atualizar.

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'

const MINHA_VERSAO = process.env.NEXT_PUBLIC_VERSAO_APP || ''
const INTERVALO = 60_000
const ADIAR = 10 * 60_000

export default function AvisoNovaVersao() {
  const [novaVersao, setNovaVersao] = useState(false)
  const [adiadoAte, setAdiadoAte] = useState(0)
  const [agora, setAgora] = useState(() => Date.now())

  useEffect(() => {
    if (!MINHA_VERSAO) return
    let parado = false
    const checar = async () => {
      if (parado || !navigator.onLine) return
      try {
        const r = await fetch('/api/versao', { cache: 'no-store' })
        if (!r.ok) return
        const { versao } = await r.json()
        if (versao && versao !== MINHA_VERSAO) setNovaVersao(true)
        setAgora(Date.now())
      } catch { /* sem internet: tenta de novo depois */ }
    }
    checar()
    const t = setInterval(checar, INTERVALO)
    const aoVoltar = () => { if (document.visibilityState === 'visible') checar() }
    document.addEventListener('visibilitychange', aoVoltar)
    window.addEventListener('focus', checar)
    return () => { parado = true; clearInterval(t); document.removeEventListener('visibilitychange', aoVoltar); window.removeEventListener('focus', checar) }
  }, [])

  if (!novaVersao || agora < adiadoAte) return null
  return (
    <div role="alert" className="fixed top-3 left-1/2 -translate-x-1/2 z-[20000] w-[min(560px,calc(100%-24px))] flex items-center gap-3 pl-4 pr-2 py-2.5 rounded-2xl bg-zinc-900 text-white shadow-2xl text-[13px] leading-snug">
      <RefreshCw size={16} className="shrink-0 text-amber-300" />
      <span className="flex-1 min-w-0"><b>Saiu uma atualização do sistema.</b> Atualize para usar a versão mais nova (leva 2 segundos).</span>
      <button type="button" onClick={() => { setAdiadoAte(Date.now() + ADIAR); setAgora(Date.now()) }} className="shrink-0 px-2.5 py-1.5 rounded-xl text-white/70 hover:text-white">Depois</button>
      <button type="button" onClick={() => window.location.reload()} className="shrink-0 px-3 py-1.5 rounded-xl bg-white text-zinc-900 font-semibold">Atualizar</button>
    </div>
  )
}
