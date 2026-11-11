'use client'

// Conversa de um conteúdo (portal do cliente <-> equipe): mensagens com texto, fotos e áudio.
// O mesmo componente aparece no portal do cliente e no painel da tarefa do admin.
// Quem usa decide como enviar (cada lado tem sua server action); aqui ficam a tela,
// a gravação de áudio e o envio dos arquivos para o Storage por link assinado.

import { useEffect, useRef, useState } from 'react'
import { Image as ImageIcon, Mic, SendHorizontal, Trash2, Check, X, Play, Pause, Loader2, MessageSquare } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import type { MensagemConversa } from '@/lib/conversa'

export type { MensagemConversa }
export type Alvo = 'video' | 'capa' | 'ambos'
export type EnvioConversa = { texto: string; fotos: File[]; audio: { blob: Blob; dur: number } | null; alvo: Alvo | null }
type Preparar = (tipo: 'foto' | 'audio', ext: string) => Promise<{ path: string; token: string }>

const BUCKET = 'portal-anexos'
const ALVO_LABEL: Record<Alvo, string> = { video: 'Vídeo', capa: 'Capa', ambos: 'Vídeo e capa' }
const WAVE = [6, 12, 18, 10, 20, 14, 8, 16, 22, 12, 6, 14, 18, 10, 16, 8, 12, 20, 10, 6, 14, 18]
const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const fmtQuando = (iso: string) => {
  const d = new Date(iso)
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} · ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}
const extDoAudio = (mime: string) => mime.includes('webm') ? 'webm' : mime.includes('ogg') ? 'ogg' : (mime.includes('mp4') || mime.includes('aac')) ? 'mp4' : 'webm'
const extDaFoto = (f: File) => (f.name.split('.').pop() || f.type.split('/')[1] || 'jpg').toLowerCase()

/** Sobe fotos e áudio para o Storage usando links assinados e devolve os caminhos para gravar a mensagem. */
export async function enviarAnexos(preparar: Preparar, fotos: File[], audio: { blob: Blob; dur: number } | null) {
  const storage = createClient().storage.from(BUCKET)
  const caminhosFotos: string[] = []
  for (const f of fotos) {
    const { path, token } = await preparar('foto', extDaFoto(f))
    const { error } = await storage.uploadToSignedUrl(path, token, f, { contentType: f.type || 'image/jpeg' })
    if (error) throw new Error('Não foi possível enviar a foto')
    caminhosFotos.push(path)
  }
  let audioPath: { path: string; dur: number } | null = null
  if (audio) {
    const mime = (audio.blob.type || 'audio/webm').split(';')[0]
    const { path, token } = await preparar('audio', extDoAudio(mime))
    const { error } = await storage.uploadToSignedUrl(path, token, audio.blob, { contentType: mime })
    if (error) throw new Error('Não foi possível enviar o áudio')
    audioPath = { path, dur: audio.dur }
  }
  return { fotos: caminhosFotos, audio: audioPath }
}

function AudioPill({ url, dur, dark }: { url: string; dur: number; dark?: boolean }) {
  const ref = useRef<HTMLAudioElement>(null)
  const [tocando, setTocando] = useState(false)
  const [pos, setPos] = useState(0)
  const total = dur || 0
  return (
    <span className="inline-flex items-center gap-2.5">
      <audio ref={ref} src={url} preload="none" onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)} onEnded={() => { setTocando(false); setPos(0); }} />
      <button type="button" aria-label={tocando ? 'Pausar áudio' : 'Ouvir áudio'} onClick={() => { const a = ref.current; if (!a) return; if (tocando) { a.pause(); setTocando(false); } else { a.play().then(() => setTocando(true)).catch(() => null); } }}
        className="w-8 h-8 rounded-full bg-brand text-white inline-flex items-center justify-center shrink-0">
        {tocando ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
      </button>
      <span className="flex items-center gap-[2px] h-6" aria-hidden="true">
        {WAVE.map((h, i) => {
          const ativo = total > 0 && (i / WAVE.length) <= (pos / total)
          return <i key={i} style={{ height: h }} className={`block w-[3px] rounded-full ${ativo ? 'bg-brand' : dark ? 'bg-zinc-600' : 'bg-zinc-300'}`} />
        })}
      </span>
      <span className="text-xs text-zinc-500 tabular-nums">{fmtDur(tocando || pos ? pos : total)}</span>
    </span>
  )
}

export default function ConversaMaterial({
  mensagens, carregando, perspectiva, onEnviar, modoAjuste = false, onCancelarAjuste,
  mostrarSobre = false, alvoInicial = 'video', dark = false, placeholder, vazio, className = '', enviando: enviandoExterno = false,
  composerClassName = '', mensagensClassName = '', focarSinal = 0,
}: {
  mensagens: MensagemConversa[]
  carregando?: boolean
  perspectiva: 'cliente' | 'equipe'
  onEnviar: (envio: EnvioConversa) => Promise<boolean | void>
  modoAjuste?: boolean
  onCancelarAjuste?: () => void
  mostrarSobre?: boolean
  alvoInicial?: Alvo
  dark?: boolean
  placeholder?: string
  vazio?: string
  className?: string
  enviando?: boolean
  composerClassName?: string       // ex.: deixar o campo fixo no rodapé no celular
  mensagensClassName?: string
  focarSinal?: number              // muda o número para focar o campo de mensagem
}) {
  const [texto, setTexto] = useState('')
  const [fotos, setFotos] = useState<{ file: File; url: string }[]>([])
  const [audio, setAudio] = useState<{ blob: Blob; dur: number; url: string } | null>(null)
  const [alvo, setAlvo] = useState<Alvo>(alvoInicial)
  const [gravando, setGravando] = useState<{ segs: number } | null>(null)
  const [enviando, setEnviando] = useState(false)
  const rec = useRef<{ mr: MediaRecorder; stream: MediaStream; chunks: Blob[]; t: any; segs: number; descartar: boolean } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const txtRef = useRef<HTMLTextAreaElement>(null)
  const fimRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setAlvo(alvoInicial) }, [alvoInicial])
  useEffect(() => { if (modoAjuste) txtRef.current?.focus() }, [modoAjuste])
  useEffect(() => { if (focarSinal) txtRef.current?.focus() }, [focarSinal])
  // Rola só a lista de mensagens (sem mexer na página inteira)
  useEffect(() => {
    const lista = fimRef.current?.parentElement
    if (lista && lista.scrollHeight > lista.clientHeight) lista.scrollTop = lista.scrollHeight
  }, [mensagens.length])
  // Libera microfone e URLs temporárias ao sair
  useEffect(() => () => {
    if (rec.current) { clearInterval(rec.current.t); rec.current.stream.getTracks().forEach(t => t.stop()) }
  }, [])

  const limpar = () => {
    fotos.forEach(f => URL.revokeObjectURL(f.url))
    if (audio) URL.revokeObjectURL(audio.url)
    setTexto(''); setFotos([]); setAudio(null)
    if (txtRef.current) txtRef.current.style.height = 'auto'
  }

  const gravar = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find(m => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(m))
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      const r = { mr, stream, chunks: [] as Blob[], t: null as any, segs: 0, descartar: false }
      mr.ondataavailable = (e) => { if (e.data.size) r.chunks.push(e.data) }
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        if (!r.descartar && r.chunks.length) {
          const blob = new Blob(r.chunks, { type: mr.mimeType || 'audio/webm' })
          setAudio({ blob, dur: Math.max(1, r.segs), url: URL.createObjectURL(blob) })
        }
      }
      r.t = setInterval(() => { r.segs++; setGravando({ segs: r.segs }) }, 1000)
      rec.current = r
      mr.start()
      setGravando({ segs: 0 })
    } catch {
      alert('Não conseguimos acessar o microfone. Verifique a permissão do navegador.')
    }
  }
  const pararGravacao = (descartar: boolean) => {
    const r = rec.current
    if (!r) return
    r.descartar = descartar
    clearInterval(r.t)
    r.mr.stop()
    rec.current = null
    setGravando(null)
  }

  const enviar = async () => {
    if (enviando || enviandoExterno || gravando) return
    if (!texto.trim() && !fotos.length && !audio) { txtRef.current?.focus(); return }
    setEnviando(true)
    try {
      const ok = await onEnviar({ texto: texto.trim(), fotos: fotos.map(f => f.file), audio: audio ? { blob: audio.blob, dur: audio.dur } : null, alvo: mostrarSobre ? alvo : null })
      if (ok !== false) limpar()
    } finally {
      setEnviando(false)
    }
  }

  const ocupado = enviando || enviandoExterno
  const linha = dark ? 'border-zinc-800' : 'border-zinc-200'
  const meu = (m: MensagemConversa) => m.autor === perspectiva
  const quem = (m: MensagemConversa) => {
    if (m.autor === 'cliente') return perspectiva === 'cliente' ? (m.feito_pela_agencia ? 'Agência (pelo portal)' : 'Você') : `${m.autor_nome || 'Cliente'}${m.feito_pela_agencia ? ' · feito pela agência' : ''}`
    return perspectiva === 'cliente' ? 'Equipe' : (m.autor_nome || 'Equipe')
  }

  return (
    <div className={`flex flex-col min-h-0 ${className}`}>
      {/* MENSAGENS */}
      <div className={`flex-1 min-h-0 overflow-y-auto px-4 py-3 ${mensagensClassName}`}>
        {carregando ? (
          <div className="flex justify-center py-8 text-zinc-400"><Loader2 size={18} className="animate-spin" /></div>
        ) : mensagens.length === 0 ? (
          <div className="text-center text-[13px] text-zinc-500 py-8 px-2">{vazio || 'Alguma dúvida ou pedido sobre este conteúdo? Escreva, mande fotos ou grave um áudio.'}</div>
        ) : mensagens.map(m => {
          const eu = meu(m)
          if (m.evento) return (
            <div key={m.id} className={`flex flex-col mb-3 ${eu ? 'items-end' : 'items-start'}`}>
              <span className="text-[11.5px] text-zinc-400 mb-1">{quem(m)} · {fmtQuando(m.created_at)}</span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400"><Check size={12} strokeWidth={3} /> {m.evento === 'aprovado' ? 'Aprovou o conteúdo' : m.evento}</span>
            </div>
          )
          return (
            <div key={m.id} className={`flex flex-col mb-3 ${eu ? 'items-end' : 'items-start'}`}>
              <span className="text-[11.5px] text-zinc-400 mb-1">
                {quem(m)} · {fmtQuando(m.created_at)}
                {m.ajuste && <span className="text-orange-600 dark:text-orange-400 font-medium"> · Pedido de ajuste{m.alvo ? ` · ${ALVO_LABEL[m.alvo]}` : ''}</span>}
              </span>
              <div className={`max-w-[88%] rounded-2xl px-3 py-2 text-[13.5px] space-y-2 break-words ${eu
                ? (dark ? 'bg-brand/15 border border-brand/30 text-zinc-100' : 'bg-[#FFFBF8] border border-[#F3D9C8] text-zinc-800')
                : (dark ? 'bg-zinc-800 text-zinc-100' : 'bg-zinc-100 text-zinc-800')}`}>
                {m.fotos.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {m.fotos.map((u, i) => (
                      <a key={i} href={u} target="_blank" rel="noopener noreferrer" title="Abrir foto">
                        <img src={u} alt="Foto enviada" className="w-[76px] h-[76px] rounded-lg object-cover" />
                      </a>
                    ))}
                  </div>
                )}
                {m.audio && <AudioPill url={m.audio.url} dur={m.audio.dur} dark={dark} />}
                {m.texto && <p className="whitespace-pre-wrap m-0">{m.texto}</p>}
              </div>
            </div>
          )
        })}
        <div ref={fimRef} />
      </div>

      {/* CAMPO DE MENSAGEM */}
      <div className={`border-t ${linha} px-3 pt-2.5 pb-3 shrink-0 ${dark ? 'bg-zinc-900' : 'bg-white'} ${composerClassName}`}>
        {modoAjuste && (
          <div className="flex items-center gap-2 text-[12.5px] text-orange-800 bg-orange-50 border border-orange-200 rounded-lg pl-2.5 pr-1 py-1.5 mb-2 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-900/40">
            <MessageSquare size={14} className="shrink-0" />
            <span className="flex-1">Pedido de ajuste: conte o que mudar. Pode mandar foto e áudio.</span>
            {onCancelarAjuste && <button type="button" onClick={onCancelarAjuste} aria-label="Cancelar pedido de ajuste" className="p-1 rounded hover:bg-orange-100 dark:hover:bg-orange-900/40"><X size={14} /></button>}
          </div>
        )}
        {mostrarSobre && (
          <div className="flex items-center gap-1.5 mb-2 text-[12.5px] text-zinc-500">
            Sobre:
            {(['video', 'capa', 'ambos'] as Alvo[]).map(k => (
              <button key={k} type="button" onClick={() => setAlvo(k)} className={`px-2.5 py-0.5 rounded-lg border text-[12.5px] font-medium transition-colors ${alvo === k ? 'border-brand bg-[#FFFBF8] text-brand dark:bg-brand/15' : `${linha} ${dark ? 'bg-zinc-900 text-zinc-400' : 'bg-white text-zinc-600'}`}`}>{ALVO_LABEL[k]}</button>
            ))}
          </div>
        )}
        {(fotos.length > 0 || audio) && (
          <div className="flex flex-wrap gap-2 mb-2">
            {fotos.map((f, i) => (
              <span key={f.url} className="relative">
                <img src={f.url} alt="Foto para enviar" className={`w-14 h-14 rounded-lg object-cover border ${linha}`} />
                <button type="button" aria-label="Remover foto" onClick={() => { URL.revokeObjectURL(f.url); setFotos(prev => prev.filter((_, k) => k !== i)) }} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-zinc-800 text-white inline-flex items-center justify-center ring-2 ring-white"><X size={11} /></button>
              </span>
            ))}
            {audio && (
              <span className={`inline-flex items-center gap-2 border ${linha} rounded-xl pl-1.5 pr-1 py-1`}>
                <AudioPill url={audio.url} dur={audio.dur} dark={dark} />
                <button type="button" aria-label="Apagar áudio" onClick={() => { URL.revokeObjectURL(audio.url); setAudio(null) }} className="p-1.5 rounded-md text-zinc-400 hover:text-red-500"><Trash2 size={14} /></button>
              </span>
            )}
          </div>
        )}

        {gravando ? (
          <>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => pararGravacao(true)} aria-label="Descartar áudio" className="w-10 h-10 rounded-[10px] bg-red-50 text-red-600 inline-flex items-center justify-center shrink-0 dark:bg-red-900/20"><Trash2 size={17} /></button>
              <span className={`flex-1 flex items-center gap-2.5 rounded-xl border ${linha} ${dark ? 'bg-zinc-950' : 'bg-zinc-50'} px-3 py-2 text-[13px] tabular-nums`}>
                <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" /> {fmtDur(gravando.segs)}
                <span className="flex items-center gap-[2px] h-5" aria-hidden="true">{WAVE.slice(0, 16).map((h, i) => <i key={i} style={{ height: h * 0.8 }} className="block w-[3px] rounded-full bg-[#E7B593]" />)}</span>
              </span>
              <button type="button" onClick={() => pararGravacao(false)} aria-label="Terminar gravação" className="w-10 h-10 rounded-[10px] bg-brand-ink text-white inline-flex items-center justify-center shrink-0"><Check size={17} strokeWidth={2.6} /></button>
            </div>
            <p className="text-center text-xs text-zinc-500 mt-1.5">Gravando áudio…</p>
          </>
        ) : (
          <div className={`flex items-end gap-1 rounded-xl border ${linha} ${dark ? 'bg-zinc-950 focus-within:border-brand' : 'bg-zinc-50 focus-within:border-brand focus-within:bg-white'} pl-3 pr-1.5 py-1.5 transition-colors`}>
            <textarea ref={txtRef} rows={1} value={texto} disabled={ocupado}
              onChange={(e) => { setTexto(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px' }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(pointer: fine)').matches) { e.preventDefault(); enviar() } }}
              placeholder={placeholder || (modoAjuste ? 'O que você quer mudar?' : 'Escreva uma mensagem…')}
              className="flex-1 bg-transparent outline-none resize-none text-sm py-2 max-h-[120px] min-w-0" />
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { const fs = Array.from(e.target.files || []); setFotos(prev => [...prev, ...fs.map(file => ({ file, url: URL.createObjectURL(file) }))].slice(0, 10)); e.target.value = '' }} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={ocupado} aria-label="Adicionar fotos" title="Adicionar fotos" className="w-9 h-9 rounded-lg text-zinc-500 hover:text-brand hover:bg-zinc-100 dark:hover:bg-zinc-800 inline-flex items-center justify-center shrink-0"><ImageIcon size={18} /></button>
            {!audio && <button type="button" onClick={gravar} disabled={ocupado} aria-label="Gravar áudio" title="Gravar áudio" className="w-9 h-9 rounded-lg text-zinc-500 hover:text-brand hover:bg-zinc-100 dark:hover:bg-zinc-800 inline-flex items-center justify-center shrink-0"><Mic size={18} /></button>}
            <button type="button" onClick={enviar} disabled={ocupado} aria-label="Enviar" className="w-9 h-9 rounded-[10px] bg-brand-ink text-white inline-flex items-center justify-center shrink-0 disabled:opacity-50">
              {ocupado ? <Loader2 size={16} className="animate-spin" /> : <SendHorizontal size={16} />}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
