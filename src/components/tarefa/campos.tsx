"use client"

// Campos editáveis de uma tarefa (status, responsáveis e entrega), usados na lista e no painel lateral.
// Cada campo abre um menu pequeno ancorado no próprio botão, desenhado num portal para nunca ser cortado.

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DayPicker } from 'react-day-picker'
import { ptBR } from 'date-fns/locale'
import { Check, Search, Plus, Flag, X } from 'lucide-react'

// ---------------------------------------------------------------------------
// Menu ancorado
// ---------------------------------------------------------------------------

type PopoverProps = {
  aberto: boolean
  ancora: HTMLElement | null
  onFechar: () => void
  largura: number
  dark?: boolean
  children: React.ReactNode
}

// Eventos de dentro do menu não podem subir até o card (no React, o portal continua "dentro" do card)
const parar = (e: React.SyntheticEvent) => e.stopPropagation()

export function MenuAncorado({ aberto, ancora, onFechar, largura, dark, children }: PopoverProps) {
  const painelRef = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<React.CSSProperties>({ visibility: 'hidden' })

  // Posiciona abaixo do botão (ou acima, se faltar espaço) e acompanha o botão quando a página rola.
  // Fecha só se o botão sumir ou sair da tela.
  const posicionar = React.useCallback(() => {
    if (!ancora) return
    if (!ancora.isConnected) { onFechar(); return }
    const r = ancora.getBoundingClientRect()
    const vh = window.innerHeight, vw = window.innerWidth
    if (r.bottom < 0 || r.top > vh) { onFechar(); return }
    const altura = painelRef.current ? painelRef.current.offsetHeight : 300
    const w = Math.min(largura, vw - 16)
    const left = Math.max(8, Math.min(r.left, vw - w - 8))
    const abaixo = vh - r.bottom
    const paraCima = abaixo < altura + 12 && r.top > abaixo
    setPos({ width: w, left, top: paraCima ? Math.max(8, r.top - altura - 6) : r.bottom + 6 })
  }, [ancora, largura, onFechar])

  useLayoutEffect(() => {
    if (!aberto) { setPos({ visibility: 'hidden' }); return }
    posicionar()
  }, [aberto, posicionar])

  useEffect(() => {
    if (!aberto) return
    let quadro = 0
    const acompanhar = () => { cancelAnimationFrame(quadro); quadro = requestAnimationFrame(posicionar) }
    // Esc na fase de captura: funciona mesmo com o foco dentro do menu e não fecha o painel que está por baixo
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onFechar() } }
    window.addEventListener('scroll', acompanhar, true)
    window.addEventListener('resize', acompanhar)
    window.addEventListener('keydown', aoTeclar, true)
    return () => {
      cancelAnimationFrame(quadro)
      window.removeEventListener('scroll', acompanhar, true)
      window.removeEventListener('resize', acompanhar)
      window.removeEventListener('keydown', aoTeclar, true)
    }
  }, [aberto, posicionar, onFechar])

  if (!aberto || !ancora || typeof document === 'undefined') return null
  return createPortal(
    <>
      <div className="fixed inset-0 z-[10040]" onClick={(e) => { e.stopPropagation(); onFechar() }} onMouseDown={parar} onDoubleClick={parar} />
      <div
        ref={painelRef}
        onClick={parar}
        onMouseDown={parar}
        onDoubleClick={parar}
        onKeyDown={parar}
        style={{ position: 'fixed', width: largura, ...pos }}
        className={`z-[10041] rounded-lg border shadow-lg text-left overflow-hidden animate-in fade-in zoom-in-95 duration-100 ${dark ? 'bg-zinc-900 border-zinc-700 text-zinc-100' : 'bg-white border-zinc-200 text-zinc-900'}`}
      >
        {children}
      </div>
    </>,
    document.body
  )
}

// Botão que abre um menu ancorado nele mesmo
function useMenu() {
  const [ancora, setAncora] = useState<HTMLElement | null>(null)
  const abrir = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setAncora(e.currentTarget as HTMLElement)
  }
  const fechar = React.useCallback(() => setAncora(null), [])
  return { aberto: !!ancora, ancora, abrir, fechar }
}

// ---------------------------------------------------------------------------
// Avatar (foto ou iniciais)
// ---------------------------------------------------------------------------

export type Pessoa = { id: string; nome?: string; email?: string; foto_url?: string | null }

const CORES = ['#E8559A', '#3B82F6', '#F59E0B', '#14B8A6', '#9B6CF0', '#A25431']
export const corDoAvatar = (s: string) => CORES[s.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % CORES.length]
export const iniciais = (nome?: string) => (nome || '?').split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase()

export function Avatar({ pessoa, tamanho = 24, className = '', title }: { pessoa: Pessoa; tamanho?: number; className?: string; title?: string }) {
  const [falhou, setFalhou] = useState(false)
  const nome = pessoa.nome || pessoa.email
  const estilo: React.CSSProperties = { width: tamanho, height: tamanho, fontSize: Math.max(9, Math.round(tamanho * 0.4)) }
  if (pessoa.foto_url && !falhou) {
    return (
      <img src={pessoa.foto_url} alt={nome || ''} title={title ?? nome} onError={() => setFalhou(true)} style={estilo} className={`shrink-0 rounded-full object-cover ${className}`} />
    )
  }
  return (
    <span title={title ?? nome} style={{ ...estilo, background: corDoAvatar(pessoa.id) }} className={`shrink-0 rounded-full font-semibold text-white inline-flex items-center justify-center ${className}`}>
      {iniciais(nome)}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Responsáveis: escolhe livremente várias pessoas
// ---------------------------------------------------------------------------

export function CampoResponsaveis({ selecionados, pessoas, onAlternar, dark, centralizar }: {
  selecionados: string[]
  pessoas: Pessoa[]
  onAlternar: (id: string, marcar: boolean) => void
  dark?: boolean
  centralizar?: boolean
}) {
  const menu = useMenu()
  const [busca, setBusca] = useState('')
  const escolhidos = selecionados.map(id => pessoas.find(p => p.id === id)).filter(Boolean) as Pessoa[]
  const q = busca.trim().toLowerCase()
  const lista = q ? pessoas.filter(p => `${p.nome || ''} ${p.email || ''}`.toLowerCase().includes(q)) : pessoas
  const anel = dark ? 'ring-zinc-900' : 'ring-white'
  return (
    <>
      <button
        type="button"
        onClick={(e) => { setBusca(''); menu.abrir(e) }}
        title={escolhidos.length ? `Responsáveis: ${escolhidos.map(p => p.nome || p.email).join(', ')}` : 'Adicionar responsável'}
        className={`group/resp inline-flex items-center min-h-7 rounded-md px-1 -mx-1 ${centralizar ? 'md:mx-auto' : ''} ${dark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'} transition-colors`}
      >
        {escolhidos.length === 0 ? (
          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full border border-dashed ${dark ? 'border-zinc-600' : 'border-zinc-300'} text-zinc-400 group-hover/resp:text-brand group-hover/resp:border-brand`}><Plus size={12} /></span>
        ) : (
          <span className="inline-flex items-center">
            {escolhidos.map((p, i) => <Avatar key={p.id} pessoa={p} className={`ring-2 ${anel} ${i > 0 ? '-ml-1.5' : ''}`} title={p.nome || p.email} />)}
          </span>
        )}
      </button>
      <MenuAncorado aberto={menu.aberto} ancora={menu.ancora} onFechar={menu.fechar} largura={240} dark={dark}>
        <div className={`p-1.5 border-b ${dark ? 'border-zinc-800' : 'border-zinc-100'}`}>
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <input autoFocus value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar pessoa"
              className={`w-full h-7 pl-7 pr-2 rounded-md border text-[12px] outline-none focus:border-brand ${dark ? 'bg-zinc-950 border-zinc-700' : 'bg-white border-zinc-200'}`} />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {lista.length === 0 && <p className="text-[12px] text-zinc-400 px-2 py-1.5">Ninguém encontrado.</p>}
          {lista.map(p => {
            const marcado = selecionados.includes(p.id)
            return (
              <button key={p.id} type="button" onClick={() => onAlternar(p.id, !marcado)}
                className={`w-full flex items-center gap-2 h-8 px-2 rounded-md text-left ${dark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'}`}>
                <Avatar pessoa={p} tamanho={20} />
                <span className={`flex-1 truncate text-[12.5px] ${marcado ? 'font-semibold' : ''}`}>{p.nome || p.email}</span>
                {marcado && <Check size={14} className="text-brand shrink-0" />}
              </button>
            )
          })}
        </div>
      </MenuAncorado>
    </>
  )
}

// ---------------------------------------------------------------------------
// Status: menu compacto em duas colunas
// ---------------------------------------------------------------------------

export function CampoStatus({ valor, opcoes, chip, onMudar, dark }: {
  valor: string
  opcoes: { value: string; label: string; cls: string }[]
  chip: React.ReactNode
  onMudar: (valor: string) => void
  dark?: boolean
}) {
  const menu = useMenu()
  return (
    <>
      <button type="button" onClick={menu.abrir} title="Mudar status" className="inline-flex rounded-md hover:brightness-95 transition">
        {chip}
      </button>
      <MenuAncorado aberto={menu.aberto} ancora={menu.ancora} onFechar={menu.fechar} largura={400} dark={dark}>
        <div className="grid grid-cols-2 gap-0.5 p-1">
          {opcoes.map(o => {
            const atual = o.value === valor
            return (
              <button key={o.value} type="button" onClick={() => { menu.fechar(); if (!atual) onMudar(o.value) }}
                className={`flex items-center gap-1.5 h-7 px-2 rounded-md text-left text-[11.5px] ${atual ? (dark ? 'bg-zinc-800 font-semibold' : 'bg-zinc-100 font-semibold') : (dark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100')}`}>
                <span className={`w-2 h-2 rounded-full shrink-0 ${o.cls}`} style={{ backgroundColor: 'currentColor' }} />
                <span className="truncate">{o.label}</span>
                {atual && <Check size={12} className="ml-auto text-brand shrink-0" />}
              </button>
            )
          })}
        </div>
      </MenuAncorado>
    </>
  )
}

// ---------------------------------------------------------------------------
// Entrega: calendário
// ---------------------------------------------------------------------------

// 'AAAA-MM-DD' <-> Date sem fuso (evita a data "voltar um dia")
const paraDate = (s?: string | null) => {
  if (!s) return undefined
  const [a, m, d] = String(s).slice(0, 10).split('-').map(Number)
  if (!a || !m || !d) return undefined
  return new Date(a, m - 1, d)
}
const paraTexto = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const formatar = (d: Date) => d.toLocaleDateString('pt-BR')

export function CampoEntrega({ valor, atrasada, onMudar, dark, vazio = '—' }: {
  valor?: string | null
  atrasada?: boolean
  onMudar: (valor: string | null) => void
  dark?: boolean
  vazio?: React.ReactNode
}) {
  const menu = useMenu()
  const data = paraDate(valor)
  const [mes, setMes] = useState<Date>(data || new Date())
  const escolher = (d?: Date) => { menu.fechar(); onMudar(d ? paraTexto(d) : null) }
  return (
    <>
      <button type="button" onClick={(e) => { setMes(data || new Date()); menu.abrir(e) }} title="Escolher data de entrega"
        className={`inline-flex items-center gap-1 h-7 px-1.5 -mx-1.5 rounded-md text-[13px] ${dark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'} transition-colors ${data && atrasada ? 'text-red-600 dark:text-red-400 font-medium' : ''}`}>
        {data ? <>{atrasada && <Flag size={13} />}{formatar(data)}</> : <span className="text-zinc-400 text-xs">{vazio}</span>}
      </button>
      <MenuAncorado aberto={menu.aberto} ancora={menu.ancora} onFechar={menu.fechar} largura={280} dark={dark}>
        <div className={`calendario-entrega p-2 ${dark ? 'calendario-escuro' : ''}`}>
          <DayPicker
            mode="single"
            locale={ptBR}
            selected={data}
            month={mes}
            onMonthChange={setMes}
            onSelect={(d) => escolher(d || undefined)}
            showOutsideDays
            fixedWeeks
          />
          <div className={`flex items-center justify-between gap-2 pt-2 mt-1 border-t ${dark ? 'border-zinc-800' : 'border-zinc-100'}`}>
            <button type="button" onClick={() => escolher(new Date())} className="text-[12px] font-medium text-brand hover:underline px-1">Hoje</button>
            {data && <button type="button" onClick={() => escolher(undefined)} className="inline-flex items-center gap-1 text-[12px] text-zinc-500 hover:text-red-500 px-1"><X size={12} /> Tirar data</button>}
          </div>
        </div>
      </MenuAncorado>
    </>
  )
}
