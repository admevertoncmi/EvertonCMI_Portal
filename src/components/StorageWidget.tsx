"use client"
import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { HardDrive, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const MAX_STORAGE_BYTES = 1000 * 1024 * 1024; // 1GB

export function StorageWidget({ materiais, theme }: { materiais: any[], theme: 'light' | 'dark' }) {
  const supabase = createClient();
  const [usedBytes, setUsedBytes] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  const fetchStorageInfo = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.storage.from('roteiros-midia').list('', { limit: 10000 });
      if (error) throw error;
      
      const totalBytes = data?.reduce((acc, file) => acc + (file.metadata?.size || 0), 0) || 0;
      setUsedBytes(totalBytes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStorageInfo();
  }, []);

  const handleCleanArchived = async () => {
    if (cleaning) return;
    
    setCleaning(true);
    try {
      // Filtrar roteiros arquivados (status === 'concluido')
      const arquivados = materiais.filter(m => m.status === 'concluido' && m.roteiro);
      
      // Extrair URLs do Supabase Storage
      const filesToDelete = new Set<string>();
      const affectedTitles = new Set<string>();
      
      arquivados.forEach(m => {
        // Padrão de URL do storage public do supabase
        const urlRegex = /https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\/roteiros-midia\/([^"'\s]+)/g;
        let match;
        let foundAny = false;
        while ((match = urlRegex.exec(m.roteiro)) !== null) {
          filesToDelete.add(match[1]);
          foundAny = true;
        }
        if (foundAny) {
          affectedTitles.add(m.titulo);
        }
      });

      if (filesToDelete.size === 0) {
        toast.info("Nenhuma imagem encontrada nos roteiros arquivados.");
        setCleaning(false);
        return;
      }

      const titulosList = Array.from(affectedTitles).slice(0, 15).map(t => `- ${t}`).join('\n');
      const extraCount = affectedTitles.size > 15 ? `\n...e mais ${affectedTitles.size - 15} outras tarefas` : '';
      
      const confirmMessage = `Encontramos ${filesToDelete.size} imagem(ns) vinculada(s) nas seguintes tarefas arquivadas:\n\n${titulosList}${extraCount}\n\nDeseja apagá-las permanentemente para liberar espaço?`;

      if (confirm(confirmMessage)) {
        const { error } = await supabase.storage.from('roteiros-midia').remove(Array.from(filesToDelete));
        if (error) throw error;
        
        toast.success(`${filesToDelete.size} imagem(ns) apagada(s) com sucesso!`);
        fetchStorageInfo(); // Recalcula o espaço
      }
    } catch (err: any) {
      toast.error("Erro ao limpar imagens: " + err.message);
    } finally {
      setCleaning(false);
    }
  };

  const percent = usedBytes !== null ? Math.min((usedBytes / MAX_STORAGE_BYTES) * 100, 100) : 0;
  const isNearLimit = percent > 85;
  const usedMB = usedBytes !== null ? (usedBytes / (1024 * 1024)).toFixed(1) : '0.0';

  return (
    <div className={`mb-6 p-5 rounded-[20px] border shadow-sm flex flex-col md:flex-row items-center justify-between gap-5 transition-colors ${theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
      
      <div className="flex items-center gap-4 flex-1 w-full">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${isNearLimit ? 'bg-red-100 text-red-600' : (theme === 'dark' ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-500')}`}>
          <HardDrive size={24} />
        </div>
        <div className="flex-1 w-full">
          <div className="flex justify-between items-end mb-2">
            <div>
              <h3 className={`font-black uppercase tracking-tight text-sm ${theme === 'dark' ? 'text-zinc-100' : 'text-zinc-800'}`}>Uso do Storage (Imagens)</h3>
              <p className={`text-[10px] uppercase tracking-widest font-bold ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>Limite Gratuito: 1 GB</p>
            </div>
            <div className="text-right">
              <span className={`font-black text-sm ${isNearLimit ? 'text-red-500' : (theme === 'dark' ? 'text-zinc-300' : 'text-zinc-600')}`}>
                {loading ? <Loader2 size={14} className="inline animate-spin" /> : `${usedMB} MB`}
              </span>
              <span className={`text-[10px] uppercase font-bold ml-1 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>/ 1000 MB</span>
            </div>
          </div>
          <div className={`w-full h-2.5 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-100'}`}>
            <div 
              className={`h-full rounded-full transition-all duration-1000 ${isNearLimit ? 'bg-red-500' : 'bg-blue-500'}`} 
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>

      <button 
        onClick={handleCleanArchived} 
        disabled={cleaning || loading}
        className={`w-full md:w-auto px-5 py-3 rounded-xl font-black uppercase text-[11px] tracking-widest flex items-center justify-center gap-2 transition-all ${theme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'} border ${theme === 'dark' ? 'border-zinc-700' : 'border-zinc-200'} disabled:opacity-50`}
      >
        {cleaning ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
        Liberar Espaço
      </button>

    </div>
  );
}
