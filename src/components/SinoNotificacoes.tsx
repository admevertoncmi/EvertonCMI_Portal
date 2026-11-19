'use client'

// Sino de notificações no topo dos painéis (admin, editor, designer e decupador).
// Mostra o que o cliente fez no portal (mensagem, áudio, foto, pedido de ajuste, aprovação),
// avisa na tela quando chega algo novo e abre a tarefa com um clique.
// Com a permissão do navegador, também mostra o aviso do sistema quando a aba está em segundo plano.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { BellRing, MessageSquare, AlertCircle, CheckCircle2, Check } from 'lucide-react'
import { toast } from 'sonner'
import { minhasNotificacoes, marcarNotificacoesLidas, type Notificacao } from '@/actions/notificacoes-equipe'
import { rotuloQuando } from '@/lib/instrucoes'

const EVENTO = 'notificacoes:atualizar'

/** Marca como lidas as notificações de uma tarefa (ex.: ao abrir a tarefa) e atualiza o sino. */
export async function marcarTarefaLida(materialId: string, membroId?: string | null) {
  await marcarNotificacoesLidas({ materialId }, membroId)
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO))
}

const ICONE: Record<string, any> = { mensagem: MessageSquare, ajuste: AlertCircle, aprovado: CheckCircle2 }
const COR: Record<string, string> = {
  mensagem: 'bg-brand-soft text-brand dark:bg-brand/20 dark:text-brand-soft',
  ajuste: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  aprovado: 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400',
}

export default function SinoNotificacoes({ membroId, somenteLeitura = false, onAbrir, onDisponivel, fallback, botaoCls }: {
  membroId?: string | null          // modo "Entrar" da admin: mostra as notificações daquele membro (sem marcar como lidas)
  somenteLeitura?: boolean
  onAbrir: (materialId: string) => void
  onDisponivel?: (ok: boolean) => void
  fallback?: ReactNode              // o que mostrar enquanto a tabela de notificações não existe no banco
  botaoCls?: string
}) {
  const [itens, setItens] = useState<Notificacao[]>([])
  const [naoLidas, setNaoLidas] = useState(0)
  const [aberto, setAberto] = useState(false)
  const [indisponivel, setIndisponivel] = useState(false)
  const [permissao, setPermissao] = useState<string>('granted')
  const vistos = useRef<Set<string> | null>(null)
  const abrirRef = useRef(onAbrir)
  abrirRef.current = onAbrir
  const dono = membroId || null

  const abrir = useCallback((n: Notificacao) => {
    setAberto(false)
    if (!n.material_id) return
    if (!somenteLeitura) {
      setItens(prev => prev.map(x => x.material_id === n.material_id ? { ...x, lida: true } : x))
      marcarTarefaLida(n.material_id, dono)
    }
    abrirRef.current(n.material_id)
  }, [somenteLeitura, dono])

  const atualizar = useCallback(async () => {
    const r = await minhasNotificacoes(dono).catch(() => null)
    if (!r) return
    setIndisponivel(!!r.indisponivel)
    onDisponivel?.(!r.indisponivel)
    setItens(r.itens)
    setNaoLidas(r.naoLidas)
    const novas = r.itens.filter(n => !n.lida && vistos.current && !vistos.current.has(n.id))
    vistos.current = new Set(r.itens.map(n => n.id))
    if (somenteLeitura) return
    novas.slice(0, 3).forEach(n => {
      toast(n.titulo, {
        description: (n.texto || '').split('\n')[0], duration: 20000,
        action: n.material_id ? { label: 'Abrir', onClick: () => abrir(n) } : undefined,
      })
      // Aba em segundo plano: aviso do sistema (se a pessoa permitiu)
      try {
        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          const aviso = new Notification(n.titulo, { body: (n.texto || '').replace(/\n+/g, ' · '), tag: n.id, icon: '/favicon-tema' })
          aviso.onclick = () => { window.focus(); abrir(n); aviso.close() }
        }
      } catch { /* navegador sem suporte */ }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dono, somenteLeitura, abrir])

  useEffect(() => {
    vistos.current = null
    atualizar()
    const t = setInterval(atualizar, 20000)
    const aoVoltar = () => { if (document.visibilityState === 'visible') atualizar() }
    document.addEventListener('visibilitychange', aoVoltar)
    window.addEventListener(EVENTO, atualizar)
    try { setPermissao('Notification' in window ? Notification.permission : 'granted') } catch { /* sem suporte */ }
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', aoVoltar); window.removeEventListener(EVENTO, atualizar) }
  }, [atualizar])

  if (indisponivel) return <>{fallback ?? null}</>

  const marcarTodas = async () => {
    setItens(prev => prev.map(x => ({ ...x, lida: true })))
    setNaoLidas(0)
    await marcarNotificacoesLidas({ todas: true }, dono)
  }
  const pedirPermissao = async () => {
    try { setPermissao(await Notification.requestPermission()) } catch { /* sem suporte */ }
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => setAberto(v => !v)} aria-label={`Notificações${naoLidas ? ` (${naoLidas} novas)` : ''}`} title="Notificações" aria-expanded={aberto}
        className={botaoCls || `relative w-9 h-9 inline-flex items-center justify-center rounded-[10px] transition-colors ${naoLidas ? 'bg-brand-soft text-brand dark:bg-brand/20 dark:text-brand-soft' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300'} hover:text-brand`}>
        <BellRing size={17} />
        {naoLidas > 0 && <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10.5px] font-semibold inline-flex items-center justify-center">{naoLidas > 99 ? '99+' : naoLidas}</span>}
      </button>
      {aberto && <>
        <button type="button" aria-label="Fechar notificações" className="fixed inset-0 z-[180] cursor-default" onClick={() => setAberto(false)} />
        <div className="fixed left-3 right-3 top-16 md:absolute md:left-auto md:right-0 md:top-[calc(100%+8px)] md:w-[380px] z-[181] rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 shadow-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
            <span className="text-[13.5px] font-semibold">Notificações</span>
            {somenteLeitura && <span className="text-[11px] text-zinc-500">(do membro)</span>}
            {!somenteLeitura && naoLidas > 0 && <button type="button" onClick={marcarTodas} className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"><Check size={13} /> Marcar todas como lidas</button>}
          </div>
          {!somenteLeitura && permissao === 'default' && (
            <button type="button" onClick={pedirPermissao} className="w-full text-left px-4 py-2.5 text-[12.5px] bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200 border-b border-amber-100 dark:border-amber-900/40">
              Ativar avisos no computador/celular, mesmo com a aba fechada no fundo →
            </button>
          )}
          {itens.length === 0
            ? <p className="px-4 py-8 text-center text-[13px] text-zinc-500">Nenhuma notificação por enquanto.</p>
            : <div className="max-h-[min(440px,70vh)] overflow-y-auto py-1">
              {itens.map(n => {
                const Ic = ICONE[n.tipo] || MessageSquare
                return (
                  <button key={n.id} type="button" onClick={() => abrir(n)}
                    className={`w-full text-left px-4 py-2.5 flex items-start gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 ${n.lida ? 'opacity-60' : ''}`}>
                    <span className={`w-8 h-8 rounded-lg inline-flex items-center justify-center shrink-0 ${COR[n.tipo] || COR.mensagem}`}><Ic size={15} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium leading-snug">{n.titulo}</span>
                      {n.texto && <span className="block text-[12px] text-zinc-500 leading-snug whitespace-pre-line line-clamp-2">{n.texto}</span>}
                      <span className="block text-[11px] text-zinc-400 mt-0.5">{rotuloQuando(new Date(n.created_at))}</span>
                    </span>
                    {!n.lida && <span className="mt-1.5 w-2 h-2 rounded-full bg-brand shrink-0" />}
                  </button>
                )
              })}
            </div>}
        </div>
      </>}
    </div>
  )
}
