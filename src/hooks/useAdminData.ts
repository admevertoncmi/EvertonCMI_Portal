"use client"

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { toast } from 'sonner'
import { notificarClickUpChat } from '@/actions/clickup'
import { FileText, Folder, PenTool, Search, Clock, MessageSquare, CheckCircle2 } from 'lucide-react'

// Adaptação dos types para uso no hook
import type { Cliente, Material, EquipeMember } from '@/components/AdminDashboard'

interface MembroComNome extends EquipeMember { nome?: string; telegram_thread_id?: string; }

export function useAdminData(initialMaterials: Material[], initialClientes: Cliente[]) {
  const supabase = createClient()
  const [clientes, setClientes] = useState<Cliente[]>(initialClientes)
  const [materiais, setMateriais] = useState<Material[]>(initialMaterials)
  const [membros, setMembros] = useState<MembroComNome[]>([])
  const [isDataLoading, setIsDataLoading] = useState(true)
  const prevMateriaisRef = useRef<Material[]>([]);

  const loadData = useCallback(async () => {
    try {
      setIsDataLoading(true)
      const { data: c } = await supabase.from('clientes').select('*').order('nome')
      const { data: m } = await supabase.from('materiais').select(`*, cliente:clientes(nome, token_magico, telefone, ciclos_contratados, whatsapp_group_id)`).order('ordem', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false });
      const { data: team } = await supabase.from('perfis_equipe').select('*').order('created_at');

      if (c) setClientes(c as Cliente[]);
      if (m) {
        const novosMateriais = m as Material[];

        if (prevMateriaisRef.current.length > 0) {
          novosMateriais.forEach(newMat => {
            const oldMat = prevMateriaisRef.current.find(x => x.id === newMat.id);
            if (oldMat && oldMat.status === 'ajustes' && (newMat.status === 'pendente' || newMat.status === 'roteiro_pendente')) {
              toast.info(`⚠️ ATENÇÃO: O cliente cancelou a solicitação de ajuste do material: "${newMat.titulo}"`, { duration: 6000, style: { background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' } });
              notificarClickUpChat(`🔔 ALERTA: CANCELAMENTO DE AJUSTE\n\n**${newMat.cliente?.nome}**\n${newMat.titulo}\n🚨 O CLIENTE CANCELOU A SOLICITAÇÃO DE AJUSTE NO PORTAL.`, '2');
            }
          });
        }

        prevMateriaisRef.current = novosMateriais;
        setMateriais(novosMateriais);
      }

      if (team) setMembros(team as MembroComNome[]);
    } catch (err) { 
      toast.error('Erro ao atualizar dados') 
    } finally { 
      setIsDataLoading(false) 
    }
  }, [supabase, initialClientes, initialMaterials])

  useEffect(() => {
    loadData();
    const channel = supabase.channel('painel_admin_atualizacoes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'materiais' }, (payload) => {
        setMateriais(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new, cliente: m.cliente } : m));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'materiais' }, (payload) => {
        setMateriais(prev => prev.filter(m => m.id !== payload.old.id));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'materiais' }, async (payload) => {
        const { data } = await supabase.from('materiais').select('*, cliente:clientes(nome, token_magico, telefone, ciclos_contratados, whatsapp_group_id)').eq('id', payload.new.id).single();
        if (data) setMateriais(prev => [data as Material, ...prev].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'clientes' }, (payload) => {
        setClientes(prev => prev.map(c => c.id === payload.new.id ? { ...c, ...payload.new } : c));
        // Atualiza a referência de clientes dentro dos materiais já em cache
        setMateriais(prev => prev.map(m => m.cliente_id === payload.new.id ? { ...m, cliente: { ...m.cliente, ...payload.new } } as Material : m));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'clientes' }, (payload) => {
        setClientes(prev => [...prev, payload.new as Cliente].sort((a, b) => a.nome.localeCompare(b.nome)));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData, supabase]);

  const metrics = useMemo(() => {
    const ativos = materiais.filter(m => m.status !== 'concluido' && m.status !== 'planejamento' && m.status !== 'organizado' && m.status !== 'analise_roteiro' && m.status !== 'em_edicao')
    const aprovados = ativos.filter(m => m.status === 'aprovado' || m.status === 'roteiro_aprovado' || m.status === 'post_aprovado').length
    return {
      pendentes: ativos.filter(m => m.status === 'pendente' || m.status === 'roteiro_pendente').length,
      ajustes: ativos.filter(m => m.status === 'ajustes').length,
      aprovados,
      eficiencia: ativos.length > 0 ? Math.round((aprovados / ativos.length) * 100) : 0
    }
  }, [materiais])

  const pipeline = useMemo(() => {
    let roteiro = 0, decupagem = 0, producao = 0, revisao = 0, cliente = 0, ajustes = 0, aprovado = 0;
    materiais.forEach(m => {
      if(m.status === 'concluido') return;
      if(['analise_roteiro', 'roteiro_pendente'].includes(m.status)) roteiro++;
      else if(['planejamento', 'em_organizacao', 'faltando_material', 'verificar_material'].includes(m.status)) decupagem++;
      else if(['organizado', 'em_edicao'].includes(m.status)) producao++;
      else if(m.status === 'revisao') revisao++;
      else if(m.status === 'pendente') cliente++;
      else if(m.status === 'ajustes') ajustes++;
      else if(m.status === 'aprovado' || m.status === 'roteiro_aprovado' || m.status === 'post_aprovado') aprovado++;
    });
    
    return [
      { id: 'roteiro', label: 'Roteiros', count: roteiro, icon: FileText, color: 'text-pink-500', bg: 'bg-pink-500', glow: 'rgba(236,72,153,0.5)' },
      { id: 'decupagem', label: 'Decupagem', count: decupagem, icon: Folder, color: 'text-indigo-500', bg: 'bg-indigo-500', glow: 'rgba(99,102,241,0.5)' },
      { id: 'producao', label: 'Produção', count: producao, icon: PenTool, color: 'text-blue-500', bg: 'bg-blue-500', glow: 'rgba(59,130,246,0.5)' },
      { id: 'revisao', label: 'Validação', count: revisao, icon: Search, color: 'text-purple-500', bg: 'bg-purple-500', glow: 'rgba(168,85,247,0.5)' },
      { id: 'cliente', label: 'Portal', count: cliente, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500', glow: 'rgba(245,158,11,0.5)' },
      { id: 'ajustes', label: 'Ajustes', count: ajustes, icon: MessageSquare, color: 'text-red-500', bg: 'bg-red-500', glow: 'rgba(239,68,68,0.5)' },
      { id: 'aprovado', label: 'Aprovados', count: aprovado, icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500', glow: 'rgba(34,197,94,0.5)' }
    ];
  }, [materiais]);

  const gargalo = useMemo(() => {
     let max = 0;
     let gargaloName = '';
     pipeline.slice(0, 6).forEach(p => {
        if(p.count > max) { max = p.count; gargaloName = p.label; }
     });
     return { name: gargaloName, count: max };
  }, [pipeline]);

  const filaAnaliseRoteiro = useMemo(() => materiais.filter(m => m.status === 'analise_roteiro'), [materiais]);
  const filaRoteirosAprovados = useMemo(() => materiais.filter(m => (m.status === 'aprovado' || m.status === 'roteiro_aprovado') && !m.planner_id && !(m.link_drive || m.link_capa)), [materiais]);
  const filaEmDecupagem = useMemo(() => materiais.filter(m => m.status === 'planejamento' || m.status === 'em_organizacao'), [materiais]);
  const filaProblemasDecupagem = useMemo(() => materiais.filter(m => m.status === 'faltando_material' || m.status === 'verificar_material'), [materiais]);
  const filaProducaoPronta = useMemo(() => materiais.filter(m => m.status === 'organizado'), [materiais]);

  const filaMateriaisAprovacao = useMemo(() => materiais.filter(m => {
    if (m.status === 'revisao') return true;
    if (m.status === 'em_edicao' || m.status === 'ajustes') {
       const hasEditor = !!m.editor_id;
       const hasDesigner = !!m.designer_id;
       if (hasEditor && hasDesigner) {
           if (m.video_entregue && !m.design_entregue) return true;
           if (!m.video_entregue && m.design_entregue) return true;
       }
    }
    return false;
  }), [materiais]);

  const notificacoesAjustes = useMemo(() => materiais.filter(m => m.status === 'ajustes'), [materiais]);
  const filaMateriaisAprovados = useMemo(() => materiais.filter(m => (m.status === 'aprovado' || m.status === 'post_aprovado') && (m.link_drive || m.link_capa)), [materiais]);

  const editores = useMemo(() => membros.filter(m => m.role === 'editor'), [membros]);
  const designers = useMemo(() => membros.filter(m => m.role === 'designer'), [membros]);
  const planners = useMemo(() => membros.filter(m => m.role === 'planner'), [membros]);

  return {
    clientes, setClientes,
    materiais, setMateriais,
    membros, setMembros,
    isDataLoading,
    loadData,
    metrics,
    pipeline,
    gargalo,
    filaAnaliseRoteiro,
    filaRoteirosAprovados,
    filaEmDecupagem,
    filaProblemasDecupagem,
    filaProducaoPronta,
    filaMateriaisAprovacao,
    notificacoesAjustes,
    filaMateriaisAprovados,
    editores,
    designers,
    planners
  }
}
