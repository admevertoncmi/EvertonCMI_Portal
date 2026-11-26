'use client'

// Chat interno da equipe: sala "Geral" (todo mundo) + conversas entre duas pessoas.
// Cada mensagem pode citar um conteúdo (demanda) ou ser solta. Usa a mesma tela de conversa
// do portal do cliente (ConversaMaterial), então texto, fotos e áudio funcionam igual.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, Users, Loader2, FileText, X, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import ConversaMaterial, { enviarAnexos, type EnvioConversa, type MensagemConversa } from '@/components/ConversaMaterial'
import { Avatar } from '@/components/tarefa/campos'
import {
  chatEquipeInicial, chatEquipeConversa, chatEquipeNaoLidas, enviarMensagemChat, prepararAnexoChat,
  transcreverAudioChatAction, perfilMembroChat, type ChatInicial, type PerfilChat,
} from '@/actions/chat-equipe'

const ROLE: Record<string, string> = { admin: 'Gestor', planner: 'Decupador', editor: 'Editor', designer: 'Designer' }
const canalDireto = (a: string, b: string) => `dm:${[a, b].sort().join(':')}`

/** Total de mensagens não lidas do chat (para o número no menu). Atualiza a cada 30s. */
export function useChatNaoLidas(ativo = true) {
  const [total, setTotal] = useState(0)
  useEffect(() => {
    if (!ativo) return
    let vivo = true
    const buscar = () => {
      if (document.visibilityState === 'hidden') return
      chatEquipeNaoLidas().then(r => { if (vivo) setTotal(Object.values(r).reduce((a, b) => a + b, 0)) }).catch(() => {})
    }
    buscar()
    const t = setInterval(buscar, 30000)
    window.addEventListener('chat-equipe:atualizar', buscar)
    return () => { vivo = false; clearInterval(t); window.removeEventListener('chat-equipe:atualizar', buscar) }
  }, [ativo])
  return total
}

export default function ChatEquipe({ theme = 'light', onAbrirDemanda }: {
  theme?: 'light' | 'dark'
  onAbrirDemanda?: (materialId: string) => void
}) {
  const dark = theme === 'dark'
  const [dados, setDados] = useState<ChatInicial | null>(null)
  const [erro, setErro] = useState(false)
  const [canal, setCanal] = useState('geral')
  const [naConversa, setNaConversa] = useState(false) // celular: lista x conversa
  const [mensagens, setMensagens] = useState<MensagemConversa[]>([])
  const [carregando, setCarregando] = useState(true)
  const [demandaId, setDemandaId] = useState('')
  const [perfilId, setPerfilId] = useState<string | null>(null)
  const [perfil, setPerfil] = useState<PerfilChat | { erro: string } | null>(null)
  const canalAtual = useRef(canal)
  canalAtual.current = canal

  useEffect(() => {
    chatEquipeInicial().then(setDados).catch(() => setErro(true))
  }, [])

  const carregar = useCallback(async (c: string, silencioso = false) => {
    if (!silencioso) setCarregando(true)
    const r = await chatEquipeConversa(c).catch(() => null)
    if (canalAtual.current !== c) return // trocou de conversa no meio
    if (r?.erro && !silencioso) toast.error(r.erro)
    if (r && !r.erro) setMensagens(r.mensagens)
    setCarregando(false)
    window.dispatchEvent(new Event('chat-equipe:atualizar'))
    chatEquipeNaoLidas().then(n => setDados(d => d ? { ...d, naoLidas: n } : d)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!dados) return
    setMensagens([]); setDemandaId('')
    carregar(canal)
    const t = setInterval(() => { if (document.visibilityState === 'visible') carregar(canal, true) }, 8000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canal, !!dados, carregar])

  useEffect(() => {
    setPerfil(null)
    if (perfilId) perfilMembroChat(perfilId).then(setPerfil).catch(() => setPerfil({ erro: 'Não foi possível abrir o perfil' }))
  }, [perfilId])

  const outros = useMemo(() => (dados?.membros || []).filter(m => m.id !== dados?.euId), [dados])
  const nao = dados?.naoLidas || {}
  const euId = dados?.euId || ''

  const enviar = async (envio: EnvioConversa) => {
    try {
      const anexos = await enviarAnexos(prepararAnexoChat, envio.fotos, envio.audio)
      await enviarMensagemChat(canal, { texto: envio.texto, fotos: anexos.fotos, audio: anexos.audio, materialId: demandaId || null })
      setDemandaId('')
      await carregar(canal, true)
      return true
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível enviar a mensagem')
      return false
    }
  }

  if (erro) return <p className="text-sm text-red-500 py-10 text-center">Não foi possível abrir o chat. Atualize a página e tente de novo.</p>
  if (!dados) return <div className="flex items-center justify-center py-24 text-zinc-500"><Loader2 className="animate-spin mr-2" size={18} /> Carregando o chat…</div>

  const par = canal === 'geral' ? null : outros.find(m => canalDireto(euId, m.id) === canal)
  const titulo = canal === 'geral' ? 'Geral' : par?.nome || 'Conversa'
  const sub = canal === 'geral' ? 'Todos da equipe' : par ? ROLE[par.role] || par.role : ''
  const borda = dark ? 'border-zinc-800' : 'border-zinc-200'
  const fundo = dark ? 'bg-zinc-900' : 'bg-white'

  const itemLista = (id: string, nome: ReactNode, subtitulo: string, avatar: ReactNode) => {
    const n = nao[id] || 0
    const on = canal === id
    return (
      <button key={id} type="button" onClick={() => { setCanal(id); setNaConversa(true) }}
        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${on ? 'md:bg-brand-soft md:dark:bg-brand/20' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/60'}`}>
        {avatar}
        <span className="min-w-0 flex-1 leading-tight">
          <span className={`block text-[13.5px] truncate ${n ? 'font-semibold' : 'font-medium'}`}>{nome}</span>
          <span className="block text-[11.5px] text-zinc-500 truncate">{subtitulo}</span>
        </span>
        {n > 0 && <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-brand text-white text-[11px] font-semibold inline-flex items-center justify-center">{n > 99 ? '99+' : n}</span>}
      </button>
    )
  }

  const seletorDemanda = (
    <label className={`flex items-center gap-2 mb-2 text-[12.5px] text-zinc-500`}>
      <FileText size={14} className="shrink-0" />
      <span className="shrink-0">Sobre:</span>
      <select value={demandaId} onChange={(e) => setDemandaId(e.target.value)}
        className={`flex-1 min-w-0 rounded-lg border ${borda} ${dark ? 'bg-zinc-950 text-zinc-200' : 'bg-white text-zinc-700'} px-2 py-1 text-[12.5px] outline-none focus:border-brand`}>
        <option value="">Nenhuma demanda (conversa solta)</option>
        {dados.demandas.map(d => <option key={d.id} value={d.id}>{d.cliente ? `${d.cliente} · ` : ''}{d.titulo}</option>)}
      </select>
    </label>
  )

  return (
    <div className={`flex rounded-2xl border ${borda} ${fundo} overflow-hidden h-[calc(100dvh-190px)] md:h-[calc(100dvh-170px)] min-h-[440px]`}>
      {/* LISTA DE CONVERSAS */}
      <aside className={`${naConversa ? 'hidden' : 'flex'} md:flex flex-col w-full md:w-72 shrink-0 md:border-r ${borda} overflow-y-auto`}>
        <p className="px-4 pt-4 pb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Conversas</p>
        {itemLista('geral', 'Geral', 'Todos da equipe',
          <span className="w-9 h-9 rounded-full bg-brand-soft text-brand inline-flex items-center justify-center shrink-0 dark:bg-brand/20"><Users size={17} /></span>)}
        <p className="px-4 pt-4 pb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Pessoas</p>
        {outros.length === 0 && <p className="px-4 text-[13px] text-zinc-500">Ainda não há outras pessoas na equipe.</p>}
        {outros.map(m => itemLista(canalDireto(euId, m.id), m.nome, ROLE[m.role] || m.role, <Avatar pessoa={{ id: m.id, nome: m.nome, foto_url: m.foto_url }} tamanho={36} />))}
      </aside>

      {/* CONVERSA */}
      <section className={`${naConversa ? 'flex' : 'hidden'} md:flex flex-col flex-1 min-w-0`}>
        <div className={`flex items-center gap-3 px-3 md:px-4 h-14 shrink-0 border-b ${borda}`}>
          <button type="button" onClick={() => setNaConversa(false)} aria-label="Voltar para as conversas" className="md:hidden w-9 h-9 -ml-1 rounded-lg inline-flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"><ArrowLeft size={18} /></button>
          {par ? (
            <button type="button" onClick={() => setPerfilId(par.id)} title="Ver perfil" className="flex items-center gap-3 min-w-0 text-left rounded-lg hover:opacity-80 transition-opacity">
              <Avatar pessoa={{ id: par.id, nome: par.nome, foto_url: par.foto_url }} tamanho={34} />
              <span className="leading-tight min-w-0">
                <span className="block text-[14px] font-semibold truncate">{titulo}</span>
                <span className="block text-[11.5px] text-zinc-500 truncate">{sub} · ver perfil</span>
              </span>
            </button>
          ) : (<>
            <span className="w-[34px] h-[34px] rounded-full bg-brand-soft text-brand inline-flex items-center justify-center shrink-0 dark:bg-brand/20"><Users size={16} /></span>
            <span className="leading-tight min-w-0">
              <span className="block text-[14px] font-semibold truncate">{titulo}</span>
              <span className="block text-[11.5px] text-zinc-500 truncate">{sub}</span>
            </span>
          </>)}
        </div>
        <ConversaMaterial
          key={canal}
          className="flex-1"
          mensagens={mensagens}
          carregando={carregando}
          perspectiva="equipe"
          dark={dark}
          ehMeu={(m) => m.autor_id === euId}
          acimaDoCampo={seletorDemanda}
          onAbrirDemanda={onAbrirDemanda}
          onEnviar={enviar}
          onTranscrever={(id) => transcreverAudioChatAction(canal, id)}
          placeholder={canal === 'geral' ? 'Escreva para a equipe…' : `Escreva para ${titulo.split(' ')[0]}…`}
          vazio={canal === 'geral' ? 'Nenhuma mensagem ainda. Comece a conversa com a equipe.' : 'Nenhuma mensagem ainda. Diga um oi, ou peça algo sobre uma demanda.'}
        />
      </section>

      {perfilId && (
        <div className="fixed inset-0 z-[200] bg-black/50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={() => setPerfilId(null)}>
          <div onClick={(e) => e.stopPropagation()} className={`w-full md:max-w-md max-h-[90dvh] overflow-y-auto rounded-t-2xl md:rounded-2xl ${fundo} ${dark ? 'text-zinc-100' : 'text-zinc-800'} border ${borda} shadow-2xl`}>
            <div className="flex justify-end p-2 pb-0"><button type="button" onClick={() => setPerfilId(null)} aria-label="Fechar" className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X size={17} /></button></div>
            {!perfil ? <div className="flex justify-center py-12 text-zinc-400"><Loader2 className="animate-spin" size={18} /></div>
              : 'erro' in perfil ? <p className="text-sm text-red-500 text-center py-10 px-6">{perfil.erro}</p>
              : (
              <div className="px-6 pb-6 -mt-2">
                <div className="flex flex-col items-center text-center">
                  <Avatar pessoa={{ id: perfil.id, nome: perfil.nome, foto_url: perfil.foto_url }} tamanho={72} />
                  <h3 className="text-lg font-semibold mt-3">{perfil.nome}</h3>
                  <p className="text-[13px] text-zinc-500">{ROLE[perfil.role] || perfil.role}{perfil.desde ? ` · na equipe desde ${new Date(perfil.desde).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}` : ''}</p>
                </div>
                <div className="grid grid-cols-2 gap-2.5 mt-5">
                  {[
                    { l: 'Entregues', v: perfil.entregues }, { l: 'Em andamento', v: perfil.emAndamento },
                    { l: 'Total de tarefas', v: perfil.total },
                    ...(perfil.atrasadas !== null ? [{ l: 'Atrasadas', v: perfil.atrasadas }, { l: 'Em ajuste', v: perfil.ajustes ?? 0 }] : []),
                  ].map(c => (
                    <div key={c.l} className={`rounded-xl border ${borda} px-3 py-2.5`}>
                      <p className="text-xl font-semibold tabular-nums">{c.v}</p>
                      <p className="text-[12px] text-zinc-500">{c.l}</p>
                    </div>
                  ))}
                </div>
                {perfil.total > 0 && <p className="text-[12px] text-zinc-500 mt-3">Taxa de entrega: <b>{Math.round((perfil.entregues / perfil.total) * 100)}%</b></p>}
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mt-5 mb-2">Fazendo agora</p>
                {perfil.recentes.length === 0 ? <p className="text-[13px] text-zinc-500">Nada pendente no momento.</p> : (
                  <ul className="space-y-1.5">
                    {perfil.recentes.map(r => (
                      <li key={r.id}>
                        <button type="button" disabled={!onAbrirDemanda} onClick={() => { setPerfilId(null); onAbrirDemanda?.(r.id) }}
                          className={`w-full flex items-center gap-2 text-left rounded-lg border ${borda} px-3 py-2 text-[13px] ${onAbrirDemanda ? 'hover:border-brand' : ''}`}>
                          <span className="min-w-0 flex-1 truncate">{r.cliente ? `${r.cliente} · ` : ''}{r.titulo}</span>
                          {onAbrirDemanda && <ChevronRight size={14} className="text-zinc-400 shrink-0" />}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

