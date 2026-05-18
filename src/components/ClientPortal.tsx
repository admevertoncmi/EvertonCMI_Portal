"use client"

import { createClient } from '@/lib/supabase-browser'
import { useState, useEffect, useMemo, useCallback, useRef, use } from 'react'
import { notificarClickUpChat } from '@/actions/clickup'
import { getDriveFolderFiles } from '@/actions/google'
import {
  CheckCircle2, ExternalLink, Calendar,
  AlertCircle, Loader2, PlayCircle, Clock, MessageSquare, FileText, X, MessageCircle, Image as ImageIcon, Send, ChevronDown
} from 'lucide-react'
import { Toaster, toast } from 'sonner'
import useEmblaCarousel from 'embla-carousel-react'

const getEmbedUrl = (url: string) => {
  if (!url) return null;
  try {
    const ytMatch = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/.exec(url);
    if (ytMatch?.[1]) return `https://www.youtube.com/embed/${ytMatch[1]}?rel=0`;
    if (url.includes('/preview') || url.includes('embeddedfolderview')) return url;
    const folderMatch = /\/folders\/([a-zA-Z0-9_-]+)/.exec(url);
    if (folderMatch?.[1]) return `https://drive.google.com/embeddedfolderview?id=${folderMatch[1]}#grid`;
    const driveMatch1 = /\/file\/d\/([a-zA-Z0-9_-]+)/.exec(url);
    if (driveMatch1?.[1]) return `https://drive.google.com/file/d/${driveMatch1[1]}/preview`;
    const driveMatch2 = /id=([a-zA-Z0-9_-]+)/.exec(url);
    if (driveMatch2?.[1] && url.includes('drive.google.com')) return `https://drive.google.com/file/d/${driveMatch2[1]}/preview`;
    return null;
  } catch (error) { return null; }
}

const getRawDriveUrl = (url: string) => {
  if (!url) return null;
  const driveMatch1 = /\/file\/d\/([a-zA-Z0-9_-]+)/.exec(url);
  if (driveMatch1?.[1]) return `https://drive.google.com/thumbnail?id=${driveMatch1[1]}&sz=w2500`;
  const driveMatch2 = /id=([a-zA-Z0-9_-]+)/.exec(url);
  if (driveMatch2?.[1] && url.includes('drive.google.com')) return `https://drive.google.com/thumbnail?id=${driveMatch2[1]}&sz=w2500`;
  return url;
}

const isGoogleDriveVideo = (url: string) => {
  if (!url) return false;
  return url.includes('drive.google.com') && (url.includes('/file/d/') || url.includes('id='));
}

const getRawVideoUrl = (url: string) => {
  if (!url) return '';
  const driveMatch1 = /\/file\/d\/([a-zA-Z0-9_-]+)/.exec(url);
  if (driveMatch1?.[1]) return `https://drive.google.com/uc?export=download&id=${driveMatch1[1]}`;
  const driveMatch2 = /id=([a-zA-Z0-9_-]+)/.exec(url);
  if (driveMatch2?.[1] && url.includes('drive.google.com')) return `https://drive.google.com/uc?export=download&id=${driveMatch2[1]}`;
  return url;
}

const renderTextWithLinks = (text: string) => {
  if (!text) return text;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all">
          {part}
        </a>
      );
    }
    return part;
  });
};

export default function PortalCliente({ params }: { params: Promise<{ token_magico: string }> }) {
  const resolvedParams = use(params)
  const token = resolvedParams.token_magico

  const supabase = createClient()
  const [cliente, setCliente] = useState<any>(null)
  const [todosMateriais, setTodosMateriais] = useState<any[]>([])

  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'videos' | 'roteiros'>('roteiros')
  const [mediaTab, setMediaTab] = useState<'video' | 'capa'>('video')

  const [selectedMaterial, setSelectedMaterial] = useState<any>(null)
  const [isRequestingAjuste, setIsRequestingAjuste] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const [alvoAjuste, setAlvoAjuste] = useState<'video' | 'capa' | 'ambos'>('video')
  const [currentSlide, setCurrentSlide] = useState(0)

  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false)

  const [minutoAjuste, setMinutoAjuste] = useState('')
  const [segundoAjuste, setSegundoAjuste] = useState('')

  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false)
  const [materialToApprove, setMaterialToApprove] = useState<any>(null)

  const [isBulkApprovalModalOpen, setIsBulkApprovalModalOpen] = useState(false);
  const [bulkApprovalData, setBulkApprovalData] = useState<{ itens: any[], label: string } | null>(null);

  const materiaisVisualizados = useRef<Set<string>>(new Set());

  // 🔥 Estados para expansão de pastas do Drive
  const [expandedCapaLinks, setExpandedCapaLinks] = useState<string[]>([]);
  const [isExpandingFolder, setIsExpandingFolder] = useState(false);

  // 🔥 Hook do Embla Carousel movido para o topo para respeitar as regras do React
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, skipSnaps: false });

  // Sincronizar slide atual com o Embla
  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setCurrentSlide(emblaApi.selectedScrollSnap());
    emblaApi.on('select', onSelect);
    return () => { emblaApi.off('select', onSelect); };
  }, [emblaApi]);

  const loadPortal = useCallback(async () => {
    if (!token || token === 'undefined') return
    try {
      const { data: c, error: clientError } = await supabase.from('clientes').select('*').eq('token_magico', token).single()
      if (clientError || !c) { setLoading(false); return; }
      setCliente(c)

      const { data: allM } = await supabase.from('materiais').select('*').eq('cliente_id', c.id).neq('status', 'concluido').order('created_at', { ascending: false })
      setTodosMateriais(allM || [])

      setSelectedMaterial((prevSelected: any) => {
        if (!prevSelected) return null;
        return allM?.find((m: any) => m.id === prevSelected.id) || null;
      })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [token, supabase])

  useEffect(() => { loadPortal() }, [loadPortal])

  useEffect(() => {
    if (!cliente) return;
    const channel = supabase.channel('portal_cliente_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'materiais', filter: `cliente_id=eq.${cliente.id}` }, () => {
        loadPortal();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [cliente, loadPortal, supabase]);

  useEffect(() => {
    setSelectedMaterial(null)
    setIsRequestingAjuste(false)
    setFeedbackText('')
    setMediaTab('video')
    setAlvoAjuste('video')
    setMinutoAjuste('')
    setSegundoAjuste('')
  }, [activeTab])

  // 🔥 LÓGICA CORRIGIDA: Define a aba e alvo padrão dependendo do que foi entregue
  useEffect(() => {
    if (selectedMaterial) {
      if (selectedMaterial.link_drive && !selectedMaterial.link_capa) {
        setMediaTab('video');
        setAlvoAjuste('video');
      } else if (!selectedMaterial.link_drive && selectedMaterial.link_capa) {
        setMediaTab('capa');
        setAlvoAjuste('capa');
      } else {
        setMediaTab('video');
        setAlvoAjuste('video');
      }
    }
    setMinutoAjuste('')
    setSegundoAjuste('')
    setCurrentSlide(0)
  }, [selectedMaterial])

  // 🔥 LÓGICA DE EXPANSÃO DE PASTA: Transforma link de pasta em lista de arquivos
  useEffect(() => {
    const expandFolder = async () => {
      if (!selectedMaterial?.link_capa) {
        setExpandedCapaLinks([]);
        return;
      }

      // Regex para pegar ID de pasta do Drive
      const folderMatch = /\/folders\/([a-zA-Z0-9_-]+)/.exec(selectedMaterial.link_capa);
      
      if (folderMatch?.[1]) {
        setIsExpandingFolder(true);
        try {
          const files = await getDriveFolderFiles(folderMatch[1]);
          if (files && files.length > 0) {
            setExpandedCapaLinks(files);
          } else {
            setExpandedCapaLinks([selectedMaterial.link_capa]);
          }
        } catch (error) {
          setExpandedCapaLinks([selectedMaterial.link_capa]);
        } finally {
          setIsExpandingFolder(false);
        }
      } else {
        // Se não for pasta, usa a lógica padrão de quebra por linha/vírgula
        const links = selectedMaterial.link_capa.split(/[\n,;]+/).map((l: string) => l.trim()).filter(Boolean);
        setExpandedCapaLinks(links);
      }
    };

    expandFolder();
  }, [selectedMaterial?.id, selectedMaterial?.link_capa]);

  const registrarLogAcesso = useCallback(async (materialId: string, eventoTexto: string) => {
    await supabase.from('logs_acesso').insert([{ material_id: materialId, evento: eventoTexto }]);
  }, [supabase]);

  useEffect(() => {
    if (selectedMaterial && selectedMaterial.id) {
      if (!materiaisVisualizados.current.has(selectedMaterial.id)) {
        materiaisVisualizados.current.add(selectedMaterial.id);
        const tipoMaterial = activeTab === 'roteiros' ? 'Roteiro' : 'Post';
        registrarLogAcesso(selectedMaterial.id, `👀 Cliente visualizou o ${tipoMaterial}`);
      }
    }
  }, [selectedMaterial?.id, activeTab, registrarLogAcesso]);

  const roteirosList = useMemo(() => {
    return todosMateriais.filter(m => m.status !== 'analise_roteiro');
  }, [todosMateriais])

  const videosList = useMemo(() => {
    return todosMateriais.filter(m => (m.link_drive || m.link_capa) && ['pendente', 'ajustes', 'aprovado', 'post_aprovado'].includes(m.status?.toLowerCase()));
  }, [todosMateriais])

  const currentList = activeTab === 'videos' ? videosList : roteirosList;

  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {}
    currentList.forEach(m => {
      const cicloLabel = `CICLO ${m.ciclo || 1}`
      if (!groups[cicloLabel]) groups[cicloLabel] = []
      groups[cicloLabel].push(m)
    })
    return groups
  }, [currentList])

  const postsPendentesCount = useMemo(() => {
    return videosList.filter(m => m.status === 'pendente').length;
  }, [videosList]);

  const metricasCiclo = useMemo(() => {
    if (todosMateriais.length === 0) return { ciclo: 1, total: 0, aprovados: 0, percentual: 0 };

    const activeCycle = Math.max(...todosMateriais.map(m => m.ciclo || 1), 1);

    if (activeTab === 'roteiros') {
      const itemsInCycle = roteirosList.filter(m => (m.ciclo || 1) === activeCycle);
      const total = itemsInCycle.length || 1;
      const aprovados = itemsInCycle.filter(m => {
        const s = m.status?.toLowerCase();
        return ['roteiro_aprovado', 'aprovado', 'post_aprovado', 'concluido', 'pendente', 'planejamento', 'em_organizacao', 'organizado', 'em_edicao', 'revisao'].includes(s) || (s === 'ajustes' && !!(m.link_drive || m.link_capa));
      }).length;
      return { ciclo: activeCycle, total, aprovados, percentual: Math.round((aprovados / total) * 100) };
    } else {
      const itemsInCycle = todosMateriais.filter(m => (m.ciclo || 1) === activeCycle);
      const total = itemsInCycle.length || 1;
      const aprovados = itemsInCycle.filter(m => ['aprovado', 'post_aprovado'].includes(m.status?.toLowerCase()) && (m.link_drive || m.link_capa)).length;
      return { ciclo: activeCycle, total, aprovados, percentual: Math.round((aprovados / total) * 100) };
    }
  }, [todosMateriais, roteirosList, activeTab]);

  const totalPendencias = useMemo(() => {
    return todosMateriais.filter(m => ['pendente', 'roteiro_pendente'].includes(m.status)).length;
  }, [todosMateriais])

  const openApproveModal = (material: any) => {
    setMaterialToApprove(material);
    setIsApprovalModalOpen(true);
  };

  const handleAprovarVideo = async (id: string | undefined) => {
    const mat = materialToApprove || selectedMaterial;
    if (!mat) return;
    const finalId = id || mat.id;
    setActionLoading(true);
    const updated = { ...mat, status: 'post_aprovado', feedback: null };
    setTodosMateriais(prev => prev.map(m => m.id === finalId ? updated : m));
    setSelectedMaterial(updated);

    await supabase.from('materiais').update({ status: 'post_aprovado', feedback: null }).eq('id', finalId)
    await registrarLogAcesso(finalId, `✅ POST Aprovado`);

    const msg = `✅ POST APROVADO\n\n${cliente.nome}\n${mat.titulo.toUpperCase()}`;
    await notificarClickUpChat(msg);
    toast.success("Post aprovado com sucesso!");
    setIsApprovalModalOpen(false);
    setActionLoading(false);
  }

  const handleAprovarRoteiro = async (id: string | undefined) => {
    const mat = materialToApprove || selectedMaterial;
    if (!mat) return;
    const finalId = id || mat.id;
    setActionLoading(true);
    const updated = { ...mat, status: 'roteiro_aprovado', feedback: null };
    setTodosMateriais(prev => prev.map(m => m.id === finalId ? updated : m));
    setSelectedMaterial(updated);

    await supabase.from('materiais').update({ status: 'roteiro_aprovado', feedback: null }).eq('id', finalId)
    await registrarLogAcesso(finalId, `✅ Roteiro Aprovado`);

    const msg = `📝✅ ROTEIRO APROVADO\n\n${cliente.nome}\n${mat.titulo.toUpperCase()}`;
    await notificarClickUpChat(msg);
    toast.success("Roteiro aprovado! A equipe de produção foi notificada.");
    setIsApprovalModalOpen(false);
    setActionLoading(false);
  }

  const handleAprovarTodosRoteirosDoCiclo = async (cicloItens: any[], cicloLabel: string) => {
    // Definimos o que é considerado "já aprovado" para roteiros seguindo a lógica do componente
    const roteirosPendentes = cicloItens.filter(m => {
      const s = m.status?.toLowerCase();
      const isItemAprovado = ['roteiro_aprovado', 'aprovado', 'post_aprovado', 'concluido', 'pendente', 'planejamento', 'em_organizacao', 'organizado', 'em_edicao', 'revisao'].includes(s) || (s === 'ajustes' && !!(m.link_drive || m.link_capa));
      return !isItemAprovado;
    });

    if (roteirosPendentes.length === 0) {
      return toast.info("Todos os roteiros deste ciclo já estão aprovados ou em produção.");
    }

    setActionLoading(true);
    try {
      const ids = roteirosPendentes.map(m => m.id);
      
      // 1. Atualizar Estado Local
      setTodosMateriais(prev => prev.map(m => {
        if (ids.includes(m.id)) {
          return { ...m, status: 'roteiro_aprovado', feedback: null };
        }
        return m;
      }));

      // 2. Atualizar no Supabase
      const { error } = await supabase
        .from('materiais')
        .update({ status: 'roteiro_aprovado', feedback: null })
        .in('id', ids);

      if (error) throw error;

      // 3. Registrar Logs
      await Promise.all(ids.map(id => registrarLogAcesso(id, `✅ Roteiro Aprovado (Lote)`)));

      // 4. Notificar no ClickUp (mensagem única para o lote)
      const listaTitulos = roteirosPendentes.map(m => `• ${m.titulo.toUpperCase()}`).join('\n');
      const msg = `📝✅ LOTE DE ROTEIROS APROVADOS (${cicloLabel.toUpperCase()})\n\nCLIENTE: ${cliente.nome.toUpperCase()}\n\nMATERIAIS:\n${listaTitulos}\n\n🚀 A equipe de produção pode iniciar os trabalhos.`;
      await notificarClickUpChat(msg);

      toast.success(`${roteirosPendentes.length} roteiros aprovados com sucesso!`);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao aprovar roteiros em lote.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSolicitarAjuste = async (id: string) => {
    if (!feedbackText) return toast.error("Por favor, descreva o que precisa ser ajustado.")
    if (!selectedMaterial) return;
    setActionLoading(true);

    let textoBase = feedbackText;
    const isRoteiro = activeTab === 'roteiros';

    if (!isRoteiro && (minutoAjuste || segundoAjuste)) {
      const min = minutoAjuste.padStart(2, '0') || '00';
      const seg = segundoAjuste.padStart(2, '0') || '00';
      textoBase = `[⏱️ ${min}:${seg}] - ${textoBase}`;
    }

    let flagVideo = selectedMaterial.video_entregue;
    let flagDesign = selectedMaterial.design_entregue;

    if (!isRoteiro && selectedMaterial.link_capa) {
      if (alvoAjuste === 'video') { flagVideo = false; }
      else if (alvoAjuste === 'capa') { flagDesign = false; }
      else { flagVideo = false; flagDesign = false; }
    } else if (!isRoteiro) {
      flagVideo = false;
    }

    const historicoAtual = selectedMaterial.feedback ? `\n\n${selectedMaterial.feedback}` : '';
    const textoFinal = `${textoBase}${historicoAtual}`;

    const updatedMaterial = {
      ...selectedMaterial,
      status: 'ajustes',
      feedback: textoFinal,
      video_entregue: flagVideo,
      design_entregue: flagDesign
    };

    setTodosMateriais(prev => prev.map(m => m.id === id ? updatedMaterial : m))
    setSelectedMaterial(updatedMaterial)
    setIsRequestingAjuste(false)

    await supabase.from('materiais').update({
      status: 'ajustes',
      feedback: textoFinal,
      video_entregue: flagVideo,
      design_entregue: flagDesign
    }).eq('id', id)

    await registrarLogAcesso(id, `⚠️ Pedido de Ajuste`);

    const msg = `🔔 SOLICITAÇÃO DE AJUSTE\n\n${cliente.nome}\n${selectedMaterial.titulo.toUpperCase()}\n🔔 INSTRUÇÃO: ${textoBase.toUpperCase()}`;
    await notificarClickUpChat(msg);

    setFeedbackText('');
    setMinutoAjuste('');
    setSegundoAjuste('');
    toast.success("Solicitação de ajuste enviada para a equipe!");
    setActionLoading(false);
  }

  const handleCancelarAjuste = async (id: string) => {
    if (!selectedMaterial) return;
    setActionLoading(true);

    const isRoteiro = activeTab === 'roteiros';
    const estadoAnterior = isRoteiro ? 'roteiro_pendente' : 'pendente';

    const fbs = selectedMaterial.feedback?.split('\n\n').filter(Boolean) || [];
    const historicoRestaurado = fbs.slice(1).join('\n\n') || null;

    const updatedMaterial = { ...selectedMaterial, status: estadoAnterior, feedback: historicoRestaurado };
    setTodosMateriais(prev => prev.map(m => m.id === id ? updatedMaterial : m))
    setSelectedMaterial(updatedMaterial)

    await supabase.from('materiais').update({ status: estadoAnterior, feedback: historicoRestaurado }).eq('id', id)
    await registrarLogAcesso(id, `❌ Cliente cancelou o pedido de ajuste`);
    toast.info("Solicitação de ajuste cancelada.");
    setActionLoading(false);
  }

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-white text-blue-600">
      <Loader2 className="animate-spin mb-4" size={40} />
      <span className="font-black uppercase tracking-widest text-xs">A carregar o seu portal...</span>
    </div>
  )

  if (!cliente) return (
    <div className="h-screen flex items-center justify-center text-center p-4 md:p-6 bg-zinc-50">
      <div className="max-w-sm w-full bg-white p-8 md:p-10 rounded-[24px] shadow-xl border border-zinc-100">
        <h1 className="text-xl md:text-2xl font-black uppercase text-zinc-900">Link Inválido</h1>
        <p className="text-zinc-500 mt-2 font-medium text-sm md:text-base">O acesso que tentou utilizar não existe ou expirou.</p>
      </div>
    </div>
  )

  const isRoteiro = activeTab === 'roteiros'
  const embedUrl = selectedMaterial ? getEmbedUrl(selectedMaterial.link_drive) : null
  const capaEmbedUrl = selectedMaterial?.link_capa ? getEmbedUrl(selectedMaterial.link_capa) : null
  const statusAtual = selectedMaterial?.status?.toLowerCase()

  const isItemSelectedAprovado = selectedMaterial ? (
    isRoteiro
      ? ['roteiro_aprovado', 'aprovado', 'post_aprovado', 'concluido', 'pendente', 'planejamento', 'em_organizacao', 'organizado', 'em_edicao', 'revisao'].includes(selectedMaterial.status?.toLowerCase()) || (selectedMaterial.status?.toLowerCase() === 'ajustes' && !!(selectedMaterial.link_drive || selectedMaterial.link_capa))
      : ['aprovado', 'post_aprovado', 'concluido'].includes(selectedMaterial.status?.toLowerCase()) && !!(selectedMaterial.link_drive || selectedMaterial.link_capa)
  ) : false;

  return (
    <div className="min-h-screen min-h-[100dvh] bg-zinc-50 font-sans text-zinc-900 pb-24 md:pb-8 overflow-x-hidden relative">
      <Toaster position="top-right" richColors />

      {/* HEADER MOBILE COM WHITE-LABEL */}
      <div
        className="md:hidden text-white rounded-b-[24px] p-4 pt-6 shadow-md mb-4 relative overflow-hidden"
        style={{ backgroundColor: cliente?.cor_marca || '#1e3a5f' }}
      >
        <div className="absolute top-0 right-0 w-24 h-24 bg-white opacity-10 rounded-full -mr-8 -mt-8 blur-lg"></div>
        <div className="flex justify-between items-center relative z-10">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/80 mb-2">Portal do Cliente</p>
            {cliente?.logo_url ? (
              <img src={cliente.logo_url} alt={`Logo ${cliente.nome}`} className="h-10 w-auto object-contain bg-white/10 p-1 rounded-md" />
            ) : (
              <h1 className="text-xl font-black uppercase truncate">Olá, {cliente?.nome?.split(' ')[0]}!</h1>
            )}
          </div>
          <div className="bg-white/10 px-3 py-1.5 rounded-full border border-white/20 flex items-center gap-1.5 shrink-0 ml-2">
            <Clock size={12} className="text-white" />
            <span className="text-[10px] font-black text-white">{totalPendencias} Pend.</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 md:pt-6">

        {/* HEADER DESKTOP COM WHITE-LABEL */}
        <header
          className="hidden md:flex mb-6 justify-between items-center gap-4 bg-white p-6 rounded-[24px] shadow-sm"
          style={{ borderBottom: `4px solid ${cliente?.cor_marca || '#1e3a5f'}` }}
        >
          <div className="flex items-center gap-4">
            {cliente?.logo_url ? (
              <img src={cliente.logo_url} alt={`Logo ${cliente.nome}`} className="h-12 max-w-[200px] object-contain border-r border-zinc-100 pr-4" />
            ) : null}
            <div>
              <p
                className="font-black text-[10px] uppercase tracking-[0.2em] mb-1"
                style={{ color: cliente?.cor_marca || '#1e3a5f' }}
              >
                Área do Cliente
              </p>
              <h1 className="text-2xl md:text-3xl font-black tracking-tighter uppercase break-words">Olá, {cliente?.nome}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-zinc-50 px-4 py-2 rounded-full border border-zinc-200">
            <Clock size={14} className="text-orange-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">{totalPendencias} Pendentes</span>
          </div>
        </header>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 bg-white rounded-[20px] p-4 md:p-5 shadow-sm border border-zinc-100 flex flex-row items-center gap-4">
            <div className="w-12 h-12 md:w-14 md:h-14 shrink-0 bg-blue-50 rounded-full flex items-center justify-center border-2 border-blue-100">
              <span className="text-sm md:text-base font-black text-blue-600">{metricasCiclo.percentual}%</span>
            </div>
            <div className="flex-1 w-full">
              <div className="flex justify-between items-end mb-2">
                <h3 className="font-black uppercase text-zinc-800 text-xs md:text-sm">
                  {activeTab === 'roteiros' ? 'Progresso dos Roteiros' : 'Progresso dos Posts'}
                </h3>
                <span className="text-[9px] md:text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{metricasCiclo.aprovados}/{metricasCiclo.total} Aprovados</span>
              </div>
              <div className="w-full bg-zinc-100 rounded-full h-2 md:h-2.5 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${metricasCiclo.percentual}%` }}></div>
              </div>
            </div>
          </div>

          <div className="hidden md:flex bg-white p-1.5 rounded-[20px] shadow-sm border border-zinc-200 w-full md:w-64 h-fit self-center flex-row-reverse">
            <button onClick={() => { setActiveTab('videos'); setSelectedMaterial(null) }} className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-[14px] font-black text-[10px] uppercase tracking-widest transition-all relative ${activeTab === 'videos' ? 'bg-blue-600 text-white shadow-md' : 'text-zinc-500 hover:bg-zinc-50'}`}>
              <PlayCircle size={14} /> Posts
              {postsPendentesCount > 0 && activeTab !== 'videos' && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-white rounded-full animate-pulse"></span>}
            </button>
            <button onClick={() => { setActiveTab('roteiros'); setSelectedMaterial(null) }} className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-[14px] font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'roteiros' ? 'bg-purple-600 text-white shadow-md' : 'text-zinc-500 hover:bg-zinc-50'}`}>
              <FileText size={14} /> Roteiros
            </button>
          </div>
        </div>

        {currentList.length === 0 ? (
          <div className="bg-white p-8 rounded-[24px] border border-dashed border-zinc-200 text-center w-full mt-10">
            <CheckCircle2 size={32} className="text-zinc-300 mx-auto mb-3" />
            <h3 className="text-lg font-black uppercase text-zinc-400">Lista Vazia</h3>
            <p className="text-zinc-400 font-medium text-sm mt-1">A sua agência está a trabalhar nos próximos conteúdos.</p>
          </div>
        ) : (
          <div className="flex flex-col-reverse lg:grid lg:grid-cols-12 gap-4 lg:gap-6 items-start">

            {/* LISTA DE MATERIAIS */}
            <div className="lg:col-span-4 space-y-4 md:space-y-6 w-full">
              {Object.entries(grouped).map(([cicloLabel, itens]) => (
                <div key={cicloLabel} className="space-y-2 md:space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <Calendar size={12} className="text-zinc-400" />
                      <span className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em]">{cicloLabel}</span>
                    </div>
                    {isRoteiro && itens.some(m => !(['roteiro_aprovado', 'aprovado', 'post_aprovado', 'concluido', 'pendente', 'planejamento', 'em_organizacao', 'organizado', 'em_edicao', 'revisao'].includes(m.status?.toLowerCase()) || (m.status?.toLowerCase() === 'ajustes' && !!(m.link_drive || m.link_capa)))) && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); setBulkApprovalData({ itens, label: cicloLabel }); setIsBulkApprovalModalOpen(true); }}
                        disabled={actionLoading}
                        className="px-3 py-1.5 bg-purple-50 hover:bg-purple-600 hover:text-white text-purple-600 rounded-xl text-[9px] font-black uppercase transition-all flex items-center gap-1.5 border border-purple-100 shadow-sm disabled:opacity-50 group"
                      >
                        {actionLoading ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} className="group-hover:text-white" />}
                        Aprovar Tudo
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {itens.map((m: any) => {
                      const isSelected = selectedMaterial?.id === m.id

                      let isItemAprovado = false;
                      const s = m.status?.toLowerCase();
                      if (isRoteiro) {
                        isItemAprovado = ['roteiro_aprovado', 'aprovado', 'post_aprovado', 'concluido', 'pendente', 'planejamento', 'em_organizacao', 'organizado', 'em_edicao', 'revisao'].includes(s) || (s === 'ajustes' && !!(m.link_drive || m.link_capa));
                      } else {
                        isItemAprovado = ['aprovado', 'post_aprovado', 'concluido'].includes(s) && !!(m.link_drive || m.link_capa);
                      }

                      let badgeClass = 'bg-zinc-100 text-zinc-500';
                      let badgeText = 'Pendente';

                      if (isItemAprovado) {
                        badgeClass = 'bg-green-100 text-green-700';
                        badgeText = 'Aprovado';
                      } else if (isSelected) {
                        badgeClass = 'bg-white/20 text-white';
                        if (isRoteiro) {
                          badgeText = ['planejamento', 'em_edicao', 'em_organizacao', 'organizado', 'revisao'].includes(s) ? 'Em Produção' : 'Analisar';
                        } else {
                          badgeText = 'Em Aprovação';
                        }
                      } else if (s === 'ajustes') {
                        badgeClass = 'bg-orange-100 text-orange-600';
                        badgeText = 'Em Ajuste';
                      } else if (isRoteiro) {
                        badgeClass = 'bg-purple-100 text-purple-600';
                        badgeText = ['planejamento', 'em_edicao', 'em_organizacao', 'organizado', 'revisao'].includes(s) ? 'Em Produção' : 'Analisar';
                      }

                      let buttonClass = 'bg-white border-zinc-200 text-zinc-900 hover:border-zinc-300 hover:bg-zinc-50 shadow-sm';

                      if (isItemAprovado) {
                        buttonClass = isSelected ? 'bg-green-50 border-green-200 text-zinc-900 shadow-inner' : 'bg-zinc-50 border-zinc-100 text-zinc-500 opacity-80 hover:opacity-100 hover:bg-white';
                      } else if (isSelected) {
                        buttonClass = isRoteiro
                          ? 'bg-purple-600 border-purple-600 text-white shadow-md lg:scale-[1.02]'
                          : 'bg-[#1e3a5f] border-[#1e3a5f] text-white shadow-md lg:scale-[1.02]';
                      }

                      return (
                        <button
                          key={m.id}
                          onClick={() => {
                            setSelectedMaterial(m)
                            setIsRequestingAjuste(false)
                            if (window.innerWidth < 1024) { window.scrollTo({ top: 0, behavior: 'smooth' }) }
                          }}
                          className={`w-full text-left p-4 rounded-[20px] transition-all border outline-none ${buttonClass}`}
                        >
                          <div className="flex flex-col gap-2">
                            <p className="font-bold text-xs md:text-sm leading-snug break-words">{m.titulo}</p>
                            <div className="flex items-center justify-between">
                              <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded tracking-widest ${badgeClass}`}>
                                {isItemAprovado ? <><CheckCircle2 size={10} className="inline mr-1" />{badgeText}</> : badgeText}
                              </span>
                              {!isItemAprovado && isSelected && (isRoteiro ? <FileText size={14} className="text-white opacity-80" /> : <PlayCircle size={14} className="text-white opacity-80" />)}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* VISUALIZADOR DE MÍDIA / ROTEIRO */}
            <div className="lg:col-span-8 lg:sticky lg:top-6 w-full min-w-0 mb-2 lg:mb-0">
              {!selectedMaterial ? (
                <div className="hidden lg:flex flex-col items-center justify-center h-full min-h-[400px] bg-white rounded-[24px] border border-zinc-100 shadow-sm">
                  {isRoteiro ? <FileText size={40} className="text-zinc-200 mb-3" /> : <PlayCircle size={40} className="text-zinc-200 mb-3" />}
                  <p className="text-zinc-400 font-medium text-sm">Selecione uma tarefa na lista para visualizar o conteúdo.</p>
                </div>
              ) : (
                <div className="bg-white rounded-[24px] p-5 md:p-6 shadow-md border border-zinc-100 animate-in fade-in duration-300 w-full overflow-hidden">

                  <div className="mb-4 border-b border-zinc-100 pb-4">
                    <span className={`${isRoteiro ? 'text-purple-600 bg-purple-50' : 'text-blue-600 bg-blue-50'} px-2.5 py-1 rounded font-black text-[8px] md:text-[9px] uppercase tracking-widest flex items-center gap-1.5 w-max mb-2`}>
                      {isRoteiro ? <FileText size={12} /> : <PlayCircle size={12} />}
                      {isRoteiro ? 'Aprovação de Roteiro' : 'Aprovação de Post'}
                    </span>
                    <h2 className="text-lg md:text-xl font-black tracking-tight text-zinc-900 uppercase leading-tight truncate">{selectedMaterial.titulo}</h2>
                  </div>

                  {isRoteiro ? (
                    <div className="bg-zinc-50 border border-zinc-200 rounded-[16px] p-5 min-h-[200px] mb-5 overflow-hidden">
                      <div className="text-zinc-700 font-medium whitespace-pre-wrap break-words break-all leading-relaxed text-xs md:text-sm">
                        {selectedMaterial.roteiro ? renderTextWithLinks(selectedMaterial.roteiro) : "Nenhum Roteiro registado nesta tarefa."}
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* 🔥 TOGGLE VÍDEO / CAPA INTELIGENTE (Só mostra se houver os dois) */}
                      {(selectedMaterial.link_drive && selectedMaterial.link_capa) && (
                        <div className="flex bg-zinc-100 p-1.5 rounded-[16px] mb-4 w-full md:w-max">
                          <button onClick={() => { setMediaTab('video'); setAlvoAjuste('video'); }} className={`flex-1 md:px-8 py-3 md:py-2.5 rounded-[12px] font-black text-[10px] md:text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${mediaTab === 'video' ? 'bg-white text-blue-600 shadow-sm' : 'text-zinc-500 hover:bg-zinc-200/50'}`}>
                            <PlayCircle size={16} /> Vídeo/Post
                          </button>
                          <button onClick={() => { setMediaTab('capa'); setAlvoAjuste('capa'); }} className={`flex-1 md:px-8 py-3 md:py-2.5 rounded-[12px] font-black text-[10px] md:text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${mediaTab === 'capa' ? 'bg-white text-pink-600 shadow-sm' : 'text-zinc-500 hover:bg-zinc-200/50'}`}>
                            <ImageIcon size={16} /> Capa/Card
                          </button>
                        </div>
                      )}

                      {/* AVISO DE CARROSSEL / PASTA DO DRIVE */}
                      {mediaTab === 'capa' && (
                        <div className="bg-orange-50 border border-orange-200 text-orange-700 p-3 rounded-xl mb-4 flex items-center gap-2 text-[10px] md:text-xs font-bold shadow-sm">
                          <AlertCircle size={16} className="shrink-0" />
                          Carrossel ou Pasta: Clique nas imagens abaixo para visualizar em tela cheia e passe para o lado.
                        </div>
                      )}

                      {/* TELA DE VISUALIZAÇÃO INTERNA */}
                      <div className={`w-full mx-auto ${mediaTab === 'video' ? 'aspect-[9/16]' : 'aspect-square'} max-w-[360px] md:aspect-video md:max-w-full bg-black rounded-[24px] flex flex-col items-center justify-center relative overflow-hidden shadow-2xl mb-5 border border-zinc-200`}>
                        {mediaTab === 'video' ? (
                          embedUrl ? (
                            <iframe title="Vídeo" src={embedUrl} className="absolute top-0 left-0 w-full h-full rounded-[24px] border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
                          ) : (
                            <div className="text-center p-4 z-10">
                              <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto border border-white/20 mb-3">
                                <ExternalLink className="text-white" size={20} />
                              </div>
                              <p className="text-zinc-400 font-medium text-xs mb-3 px-4">Este link não suporta reprodução direta no portal.</p>
                              <a href={selectedMaterial.link_drive} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-6 py-2.5 bg-white text-black rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-zinc-200 transition-all">Abrir Material Original <ExternalLink size={12} /></a>
                            </div>
                          )
                        ) : (
                          (() => {
                            const links = expandedCapaLinks;
                            
                            if (isExpandingFolder) {
                              return (
                                <div className="flex flex-col items-center justify-center gap-3">
                                  <Loader2 className="animate-spin text-white opacity-40" size={32} />
                                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Carregando pasta...</p>
                                </div>
                              );
                            }

                            const currentLink = links[currentSlide] || '';
                            const isDirectImage = currentLink.match(/\.(jpeg|jpg|gif|png|webp|avif|jfif)$/i);
                            const embed = getEmbedUrl(currentLink);

                            if (links.length > 1) {
                              return (
                                <div className="w-full h-full relative group">
                                  <div className="w-full h-full overflow-hidden" ref={emblaRef}>
                                    <div className="flex w-full h-full">
                                      {links.map((link: string, idx: number) => {
                                        const isImg = link.match(/\.(jpeg|jpg|gif|png|webp|avif|jfif)$/i);
                                        const emb = getEmbedUrl(link);
                                        return (
                                          <div 
                                            key={idx} 
                                            onClick={() => setPreviewUrl(link)}
                                            className="flex-[0_0_100%] min-w-0 h-full relative flex items-center justify-center bg-black cursor-zoom-in"
                                          >
                                            {isImg ? (
                                              <img src={link} className="w-full h-full object-contain select-none" alt={`Slide ${idx + 1}`} />
                                            ) : (
                                              <iframe title={`Slide ${idx + 1}`} src={emb || link} className="w-full h-full border-0 pointer-events-none" allowFullScreen></iframe>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                  
                                  {/* Navegação de Slides (Sempre Visível) */}
                                  <div className="absolute inset-x-2 md:inset-x-4 top-1/2 -translate-y-1/2 justify-between items-center z-20 pointer-events-none flex">
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); emblaApi?.scrollPrev(); }}
                                      className="p-2.5 md:p-3 bg-black/30 md:bg-white/20 backdrop-blur-md text-white rounded-full hover:bg-white/40 border border-white/10 pointer-events-auto transition-all active:scale-90 shadow-xl"
                                    >
                                      <ChevronDown className="rotate-90" size={18} />
                                    </button>
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); emblaApi?.scrollNext(); }}
                                      className="p-2.5 md:p-3 bg-black/30 md:bg-white/20 backdrop-blur-md text-white rounded-full hover:bg-white/40 border border-white/10 pointer-events-auto transition-all active:scale-90 shadow-xl"
                                    >
                                      <ChevronDown className="-rotate-90" size={18} />
                                    </button>
                                  </div>


                                </div>
                              );
                            }

                            return capaEmbedUrl ? (
                              <iframe title="Capa" src={capaEmbedUrl} className="w-full h-full border-0 absolute top-0 left-0" allowFullScreen></iframe>
                            ) : isDirectImage ? (
                              <img src={currentLink} className="w-full h-full object-contain p-2" alt="Capa" />
                            ) : (
                              <div className="text-center p-4 z-10">
                                <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto border border-white/20 mb-3">
                                  <ImageIcon className="text-white" size={20} />
                                </div>
                                <p className="text-zinc-400 font-medium text-xs mb-3 px-4">Este link precisa ser aberto no navegador.</p>
                                <a href={currentLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-6 py-2.5 bg-white text-black rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-zinc-200 transition-all">Abrir Imagens <ExternalLink size={12} /></a>
                              </div>
                            );
                          })()
                        )}
                      </div>

                    </>
                  )}

                  {/* AÇÕES DE APROVAÇÃO / AJUSTE / SUCESSO */}
                  {isItemSelectedAprovado ? (
                    <div className="bg-green-50 border border-green-200 p-5 rounded-[16px] flex flex-col md:flex-row items-center justify-center gap-3 text-green-700 animate-in slide-in-from-bottom-4">
                      <CheckCircle2 size={24} className="shrink-0" />
                      <span className="font-black uppercase text-xs md:text-sm tracking-widest text-center">Este material já foi aprovado!</span>
                    </div>
                  ) : statusAtual === 'ajustes' ? (
                    <div className="space-y-3 animate-in slide-in-from-bottom-4">
                      <div className="bg-orange-50 border border-orange-200 p-5 rounded-[20px] shadow-sm">
                        <div className="flex items-center gap-2 text-orange-700 font-black uppercase text-[10px] tracking-widest mb-3 border-b border-orange-100 pb-3">
                          <MessageSquare size={16} /> Ajustes Solicitados
                        </div>

                        {(() => {
                          const feedbacks = selectedMaterial.feedback?.split('\n\n').filter(Boolean) || [];
                          const currentFeedback = feedbacks[0];
                          const historicalFeedbacks = feedbacks.slice(1);

                          return (
                            <div>
                              <div className="bg-white border border-orange-200 p-4 rounded-[16px] shadow-sm">
                                <span className="text-[9px] font-black tracking-widest text-orange-400 uppercase block mb-1">Ajuste Pendente</span>
                                <p className="text-zinc-800 font-medium text-sm leading-relaxed whitespace-pre-wrap break-words break-all">{renderTextWithLinks(currentFeedback)}</p>
                              </div>

                              {historicalFeedbacks.length > 0 && (
                                <div className="mt-3">
                                  <button onClick={() => setIsHistoryExpanded(!isHistoryExpanded)} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-orange-600 hover:text-orange-800 transition-colors">
                                    <ChevronDown size={14} className={`transition-transform duration-300 ${isHistoryExpanded ? 'rotate-180' : ''}`} />
                                    {isHistoryExpanded ? 'Ocultar Histórico Anterior' : `Ver Histórico Anterior (${historicalFeedbacks.length})`}
                                  </button>

                                  {isHistoryExpanded && (
                                    <div className="mt-3 space-y-2 animate-in fade-in duration-300 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                      {historicalFeedbacks.map((fbd: string, idx: number) => (
                                        <div key={idx} className="bg-orange-50/50 border border-orange-100 p-3 rounded-[12px]">
                                          <p className="text-orange-900 font-medium text-xs leading-relaxed whitespace-pre-wrap break-words break-all opacity-80">{renderTextWithLinks(fbd)}</p>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })()}
                      </div>

                      <button onClick={() => handleCancelarAjuste(selectedMaterial.id)} disabled={actionLoading} className="w-full py-4 bg-white border-2 border-zinc-200 text-zinc-600 rounded-[16px] font-black uppercase text-[10px] tracking-widest hover:bg-zinc-50 transition-all active:scale-95 disabled:opacity-50 flex justify-center items-center gap-2">
                        {actionLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                        Cancelar Pedido de Ajuste
                      </button>
                    </div>
                  ) : (
                    !isRequestingAjuste ? (
                      <div className="flex flex-col sm:flex-row gap-3">
                        <button onClick={() => setIsRequestingAjuste(true)} className="w-full sm:flex-1 py-4 bg-zinc-100 text-zinc-600 rounded-[16px] font-black uppercase text-[10px] tracking-widest hover:bg-zinc-200 transition-all active:scale-95 flex justify-center items-center gap-2">
                          <AlertCircle size={16} /> Solicitar {isRoteiro ? 'Alteração' : 'Ajuste'}
                        </button>

                        <button onClick={() => openApproveModal(selectedMaterial)} disabled={actionLoading} className={`w-full sm:flex-1 py-4 text-white rounded-[16px] font-black uppercase text-[10px] tracking-widest shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 ${isRoteiro ? 'bg-purple-600 hover:bg-purple-700' : 'bg-green-500 hover:bg-green-600'}`}>
                          {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                          {isRoteiro ? "Aprovar Roteiro" : "Aprovar Post"}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4 bg-zinc-50 p-5 rounded-[20px] border border-zinc-200 animate-in slide-in-from-bottom-4 shadow-sm">

                        {/* 🔥 OPÇÕES DE ALVO DO AJUSTE INTELIGENTE (Só mostra se houver Capa E Vídeo) */}
                        {!isRoteiro && (selectedMaterial.link_drive && selectedMaterial.link_capa) && (
                          <div className="space-y-2">
                            <label className="flex items-center gap-1.5 font-black text-[9px] uppercase text-zinc-600 tracking-widest">
                              Onde está o problema?
                            </label>
                            <div className="flex gap-2">
                              <button onClick={() => setAlvoAjuste('video')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${alvoAjuste === 'video' ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-white border border-zinc-200 text-zinc-400 hover:bg-zinc-100'}`}>No Vídeo/Post</button>
                              <button onClick={() => setAlvoAjuste('capa')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${alvoAjuste === 'capa' ? 'bg-pink-100 text-pink-700 border border-pink-200' : 'bg-white border border-zinc-200 text-zinc-400 hover:bg-zinc-100'}`}>Na Capa/Card</button>
                              <button onClick={() => setAlvoAjuste('ambos')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${alvoAjuste === 'ambos' ? 'bg-zinc-900 text-white border border-zinc-900' : 'bg-white border border-zinc-200 text-zinc-400 hover:bg-zinc-100'}`}>Em Ambos</button>
                            </div>
                          </div>
                        )}

                        {/* 🔥 MINUTAGEM OPCIONAL (Não aparece para Carrosséis) */}
                        {!isRoteiro && selectedMaterial.link_drive && (alvoAjuste === 'video' || alvoAjuste === 'ambos') && (
                          <div className="space-y-2">
                            <label className="flex items-center gap-1.5 font-black text-[9px] uppercase text-zinc-600 tracking-widest">
                              Em qual momento do vídeo? (Opcional)
                            </label>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center bg-white border border-zinc-200 rounded-xl px-4 py-2.5 w-max shadow-sm">
                                <input
                                  type="number"
                                  min="0"
                                  max="59"
                                  placeholder="00"
                                  className="w-10 text-center text-sm font-bold outline-none bg-transparent"
                                  value={minutoAjuste}
                                  onChange={(e) => setMinutoAjuste(e.target.value.slice(0, 2))}
                                />
                                <span className="font-bold text-zinc-400 px-1">:</span>
                                <input
                                  type="number"
                                  min="0"
                                  max="59"
                                  placeholder="00"
                                  className="w-10 text-center text-sm font-bold outline-none bg-transparent"
                                  value={segundoAjuste}
                                  onChange={(e) => setSegundoAjuste(e.target.value.slice(0, 2))}
                                />
                              </div>
                              <span className="text-xs text-zinc-400 font-medium">Ex: 01:23</span>
                            </div>
                          </div>
                        )}

                        {/* ÁREA DE TEXTO DO FEEDBACK */}
                        <div className="space-y-2">
                          <label className="flex items-center gap-1.5 font-black text-[9px] uppercase text-zinc-600 tracking-widest">
                            <AlertCircle size={14} className="text-orange-500" /> Detalhe o que precisa ser ajustado
                          </label>
                          <textarea
                            className="w-full p-4 rounded-xl border border-zinc-200 focus:border-orange-500 outline-none font-medium transition-all min-h-[120px] text-sm resize-none shadow-sm"
                            placeholder={isRoteiro ? "Ex: Alterar o gancho inicial, remover a menção à marca..." : "Ex: Mudar a cor da fonte, trocar a música de fundo..."}
                            value={feedbackText}
                            onChange={(e) => setFeedbackText(e.target.value)}
                          />
                        </div>

                        <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
                          <button onClick={() => { setIsRequestingAjuste(false); setFeedbackText(''); setAlvoAjuste('video'); setMinutoAjuste(''); setSegundoAjuste(''); }} disabled={actionLoading} className="w-full sm:w-auto px-6 py-4 font-bold text-zinc-400 hover:text-zinc-600 uppercase text-[10px] tracking-widest transition-colors disabled:opacity-50">
                            Cancelar
                          </button>
                          <button onClick={() => handleSolicitarAjuste(selectedMaterial.id)} disabled={actionLoading} className="w-full sm:w-auto px-8 py-4 bg-zinc-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-black transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
                            {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                            Enviar para Ajuste
                          </button>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {/* BOTÃO FLUTUANTE DO WHATSAPP */}
      <a
        href={`https://wa.me/${(cliente?.wpp_suporte || "5511999999999").replace(/\D/g, '')}?text=${encodeURIComponent("Olá! Estou no meu Portal de Cliente e preciso de uma ajuda.")}`}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-24 right-4 md:bottom-6 md:right-6 bg-green-500 text-white p-3 md:p-3.5 rounded-full shadow-lg z-30 hover:scale-110 active:scale-95 transition-transform flex items-center justify-center"
        title="Falar com o Suporte"
      >
        <MessageCircle size={24} />
      </a>

      {/* BARRA DE NAVEGAÇÃO INFERIOR MOBILE */}
      <div 
        className="md:hidden fixed bottom-0 left-0 w-full bg-white rounded-t-[20px] shadow-[0_-5px_40px_rgba(0,0,0,0.1)] z-40 border-t border-zinc-100 flex justify-around items-center px-2 pt-2"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
      >
        <button onClick={() => { setActiveTab('roteiros'); setSelectedMaterial(null); }} className={`flex flex-col items-center gap-1 p-2 w-20 transition-all ${activeTab === 'roteiros' ? 'text-purple-600' : 'text-zinc-400 hover:text-zinc-600'}`}>
          <FileText size={20} className={activeTab === 'roteiros' ? 'fill-purple-50' : ''} />
          <span className="text-[9px] font-black uppercase tracking-widest">Roteiros</span>
          {activeTab === 'roteiros' && <div className="w-1 h-1 bg-purple-600 rounded-full mt-0.5"></div>}
        </button>

        <button onClick={() => { setActiveTab('videos'); setSelectedMaterial(null); }} className={`flex flex-col items-center gap-1 p-2 w-20 transition-all relative ${activeTab === 'videos' ? 'text-blue-600' : 'text-zinc-400 hover:text-zinc-600'}`}>
          <PlayCircle size={20} className={activeTab === 'videos' ? 'fill-blue-50' : ''} />
          <span className="text-[9px] font-black uppercase tracking-widest">Posts</span>
          {postsPendentesCount > 0 && activeTab !== 'videos' && <span className="absolute top-1 right-5 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full animate-pulse"></span>}
          {activeTab === 'videos' && <div className="w-1 h-1 bg-blue-600 rounded-full mt-0.5"></div>}
        </button>
      </div>

      {/* PLAYER TELA CHEIA MOBILE */}
      {previewUrl && (
        <div className="fixed inset-0 z-[9999] flex flex-col md:flex-row items-center justify-center bg-black p-4 animate-in fade-in duration-300">
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 z-[10000] w-full px-4 justify-center">
            <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-6 py-3 bg-white/20 backdrop-blur-md text-white rounded-2xl hover:bg-white/30 transition-all border border-white/10 shadow-xl font-black uppercase text-[10px] tracking-widest">
              <ExternalLink size={18} /> Abrir Original
            </a>
            <button onClick={() => setPreviewUrl(null)} className="flex items-center gap-2 px-6 py-3 bg-red-500 text-white rounded-2xl hover:bg-red-600 transition-all shadow-xl font-black uppercase text-[10px] tracking-widest">
              <X size={20} /> Fechar
            </button>
          </div>
          <div className="w-full h-[80vh] md:h-full max-w-5xl mx-auto flex items-center justify-center p-2 md:p-10 mb-20 md:mb-0">
            <div className="w-full max-w-[400px] md:max-w-5xl aspect-[9/16] md:aspect-video rounded-[24px] overflow-hidden relative bg-black shadow-2xl border border-white/10">
              <iframe title="Player" src={getEmbedUrl(previewUrl) || previewUrl} className="absolute inset-0 w-full h-full border-0" allowFullScreen></iframe>
            </div>
          </div>
        </div>
      )}
      {/* MODAL DE APROVAÇÃO PERSONALIZADO */}
      {isApprovalModalOpen && materialToApprove && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[32px] w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-8 text-center">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${isRoteiro ? 'bg-purple-100 text-purple-600' : 'bg-green-100 text-green-600'}`}>
                {isRoteiro ? <FileText size={40} /> : <CheckCircle2 size={40} />}
              </div>
              <h3 className="text-2xl font-black uppercase tracking-tight text-zinc-900 mb-2">Tudo Certo?</h3>
              <p className="text-zinc-500 font-medium text-sm leading-relaxed mb-8">
                {isRoteiro 
                  ? "Ao aprovar o roteiro, a nossa equipe de produção será notificada para iniciar a gravação e edição."
                  : "O material será marcado como aprovado e pronto para ser postado nas suas redes sociais!"}
              </p>
              
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => isRoteiro ? handleAprovarRoteiro(materialToApprove.id) : handleAprovarVideo(materialToApprove.id)} 
                  disabled={actionLoading}
                  className={`w-full py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest text-white shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 ${isRoteiro ? 'bg-purple-600 hover:bg-purple-700' : 'bg-green-500 hover:bg-green-600'}`}
                >
                  {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={14} />}
                  Confirmar Aprovação
                </button>
                <button 
                  onClick={() => { setIsApprovalModalOpen(false); setMaterialToApprove(null); }}
                  className="w-full py-4 text-zinc-400 font-black uppercase text-[10px] tracking-widest hover:text-zinc-600 transition-colors"
                >
                  Voltar e Revisar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE APROVAÇÃO EM LOTE */}
      {isBulkApprovalModalOpen && bulkApprovalData && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[32px] w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-8 text-center">
              <div className="w-20 h-20 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 size={40} />
              </div>
              <h3 className="text-2xl font-black uppercase tracking-tight text-zinc-900 mb-2">Aprovar Ciclo?</h3>
              <p className="text-zinc-500 font-medium text-sm leading-relaxed mb-6">
                Você está prestes a aprovar todos os roteiros do <strong>{bulkApprovalData.label}</strong> de uma vez.
              </p>
              
              <div className="bg-zinc-50 rounded-2xl p-4 mb-8 text-left max-h-[140px] overflow-y-auto border border-zinc-100 custom-scrollbar">
                <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-2">Materiais incluídos:</span>
                <ul className="space-y-2">
                  {bulkApprovalData.itens.filter(m => {
                    const s = m.status?.toLowerCase();
                    return !(['roteiro_aprovado', 'aprovado', 'post_aprovado', 'concluido', 'pendente', 'planejamento', 'em_organizacao', 'organizado', 'em_edicao', 'revisao'].includes(s) || (s === 'ajustes' && !!(m.link_drive || m.link_capa)));
                  }).map((m: any) => (
                    <li key={m.id} className="text-[10px] font-bold text-zinc-600 flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-1 shrink-0"></div>
                      <span className="leading-tight">{m.titulo}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={async () => {
                    await handleAprovarTodosRoteirosDoCiclo(bulkApprovalData.itens, bulkApprovalData.label);
                    setIsBulkApprovalModalOpen(false);
                    setBulkApprovalData(null);
                  }} 
                  disabled={actionLoading}
                  className="w-full py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest text-white shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={14} />}
                  Confirmar Aprovação
                </button>
                <button 
                  onClick={() => { setIsBulkApprovalModalOpen(false); setBulkApprovalData(null); }}
                  className="w-full py-4 text-zinc-400 font-black uppercase text-[10px] tracking-widest hover:text-zinc-600 transition-colors"
                >
                  Voltar e Revisar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}