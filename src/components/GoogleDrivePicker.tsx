"use client"

import { useState, useEffect } from 'react';
import { FolderPlus, Loader2, Search, Folder, FileText, X, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface GoogleDrivePickerProps {
  onSelect: (url: string) => void;
  type?: 'folder' | 'file' | 'all';
  label?: string;
}

// DECLARAÇÕES PARA O TYPESCRIPT
declare global {
  interface Window {
    google: any;
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export default function GoogleDrivePicker({ onSelect, type = 'all', label = "Selecionar do Drive" }: GoogleDrivePickerProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  // 1. CARREGAR O SCRIPT DE AUTENTICAÇÃO DO GOOGLE (GSI)
  useEffect(() => {
    const loadGsiScript = () => {
      if (window.google?.accounts?.oauth2) {
        setIsLoaded(true);
        return;
      }

      const scriptGis = document.createElement('script');
      scriptGis.src = 'https://accounts.google.com/gsi/client';
      scriptGis.async = true;
      scriptGis.defer = true;
      scriptGis.onload = () => setIsLoaded(true);
      document.body.appendChild(scriptGis);
    };
    loadGsiScript();
  }, []);

  const handleOpenPicker = () => {
    if (!CLIENT_ID) {
      toast.error("Configuração de Client ID do Google não encontrada no .env");
      return;
    }

    if (accessToken) {
      setIsPickerOpen(true);
    } else {
      // SOLICITAR TOKEN DE ACESSO AO DRIVE
      try {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: 'https://www.googleapis.com/auth/drive.readonly',
          callback: (response: any) => {
            if (response.access_token) {
              setAccessToken(response.access_token);
              setIsPickerOpen(true);
            } else {
              toast.error("Permissão de acesso ao Google Drive negada.");
            }
          },
          error_callback: (err: any) => {
            console.error("Erro OAuth:", err);
            toast.error("Erro na autenticação com o Google.");
          }
        });
        client.requestAccessToken();
      } catch (error) {
        console.error("Falha ao iniciar OAuth:", error);
        toast.error("Incapaz de iniciar o login do Google.");
      }
    }
  };

  // 2. BUSCAR ITENS RECENTES AO ABRIR E SE A BUSCA ESTIVER VAZIA
  useEffect(() => {
    if (!accessToken || !isPickerOpen || searchTerm) return;

    const loadRecents = async () => {
      setSearching(true);
      try {
        const query = type === 'folder'
          ? `mimeType = 'application/vnd.google-apps.folder' and trashed = false`
          : type === 'file'
          ? `mimeType != 'application/vnd.google-apps.folder' and trashed = false`
          : `trashed = false`;

        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,webViewLink,thumbnailLink)&orderBy=modifiedTime desc&pageSize=10`;
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        });

        if (res.ok) {
          const data = await res.json();
          setResults(data.files || []);
        } else {
          console.error("Erro ao carregar recentes:", await res.text());
        }
      } catch (error) {
        console.error("Erro na API do Drive:", error);
      } finally {
        setSearching(false);
      }
    };

    loadRecents();
  }, [accessToken, isPickerOpen, searchTerm, type]);

  // 3. BUSCAR ITENS POR TEXTO (DEBOUNCE DE 400MS)
  useEffect(() => {
    if (!accessToken || !isPickerOpen || !searchTerm) return;

    const delayDebounce = setTimeout(async () => {
      setSearching(true);
      try {
        // Escapa aspas simples simples para a query do drive
        const escapedSearch = searchTerm.replace(/'/g, "\\'");
        const query = type === 'folder'
          ? `mimeType = 'application/vnd.google-apps.folder' and name contains '${escapedSearch}' and trashed = false`
          : type === 'file'
          ? `mimeType != 'application/vnd.google-apps.folder' and name contains '${escapedSearch}' and trashed = false`
          : `name contains '${escapedSearch}' and trashed = false`;

        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,webViewLink,thumbnailLink)&pageSize=15`;
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        });

        if (res.ok) {
          const data = await res.json();
          setResults(data.files || []);
        } else {
          console.error("Erro na busca:", await res.text());
        }
      } catch (error) {
        console.error("Erro ao buscar no Drive:", error);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [searchTerm, accessToken, isPickerOpen, type]);

  const handleSelectItem = (item: any) => {
    onSelect(item.webViewLink);
    setIsPickerOpen(false);
    toast.success("Link importado com sucesso!");
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpenPicker}
        className="flex items-center gap-2 px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-dashed border-zinc-300 dark:border-zinc-600"
      >
        {isLoaded ? <FolderPlus size={14} /> : <Loader2 size={14} className="animate-spin" />}
        {label}
      </button>

      {/* MODAL DE BUSCA PREMIUM ESTILO CLICKUP */}
      {isPickerOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-350">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-lg rounded-[28px] p-6 shadow-2xl flex flex-col max-h-[85vh] text-left text-zinc-900 dark:text-zinc-100">
            
            {/* CABEÇALHO */}
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-black uppercase tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
                  <Folder className="text-[#A25431]" size={20} />
                  {type === 'folder' ? 'Selecionar Pasta' : type === 'file' ? 'Selecionar Arquivo' : 'Selecionar do Google Drive'}
                </h3>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider mt-0.5">
                  Pesquisa Inteligente • Google Drive
                </p>
              </div>
              <button 
                onClick={() => setIsPickerOpen(false)} 
                className="p-2 bg-zinc-100 dark:bg-zinc-850 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-full transition-all"
              >
                <X size={16} />
              </button>
            </div>

            {/* INPUT DE PESQUISA */}
            <div className="relative mb-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" size={16} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={type === 'folder' ? "Digite o nome da pasta do Drive..." : "Digite o nome do arquivo..."}
                className="w-full pl-11 pr-10 py-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm font-bold text-zinc-900 dark:text-white outline-none focus:border-[#A25431] transition-all"
                autoFocus
              />
              {searching ? (
                <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 text-[#A25431] animate-spin" size={16} />
              ) : searchTerm ? (
                <button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                  <X size={14} />
                </button>
              ) : null}
            </div>

            {/* SUBTÍTULO */}
            <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-2.5 ml-1">
              {searchTerm ? <Search size={10} /> : <Clock size={10} />}
              {searchTerm ? 'Resultados Encontrados' : 'Itens Recentes no Drive'}
            </div>

            {/* LISTA DE RESULTADOS */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[250px] max-h-[45vh] scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
              {results.length > 0 ? (
                results.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelectItem(item)}
                    className="w-full flex items-center justify-between p-3.5 bg-zinc-50/50 dark:bg-zinc-950/60 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-850 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-2xl transition-all duration-250 group text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex-shrink-0 w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 group-hover:bg-[#A25431]/10 group-hover:text-[#A25431] transition-colors">
                        {item.mimeType === 'application/vnd.google-apps.folder' ? (
                          <Folder size={18} />
                        ) : item.thumbnailLink ? (
                          <img 
                            src={item.thumbnailLink} 
                            alt={item.name} 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <FileText size={18} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 group-hover:text-[#A25431] dark:group-hover:text-white transition-colors truncate">
                          {item.name}
                        </p>
                        <p className="text-[9px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider mt-0.5">
                          {item.mimeType === 'application/vnd.google-apps.folder' ? 'Pasta' : 'Arquivo'}
                        </p>
                      </div>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-all duration-200 text-[#A25431] pr-1 translate-x-2 group-hover:translate-x-0">
                      <span className="text-[9px] font-black uppercase tracking-widest bg-[#A25431]/10 px-2.5 py-1 rounded-lg">
                        Selecionar
                      </span>
                    </div>
                  </button>
                ))
              ) : searching ? (
                <div className="flex flex-col items-center justify-center py-16 text-zinc-400 dark:text-zinc-500">
                  <Loader2 className="animate-spin text-[#A25431] mb-2" size={24} />
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Buscando no Drive...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-zinc-400 dark:text-zinc-500 text-center px-4">
                  <Folder className="text-zinc-300 dark:text-zinc-700 mb-2" size={32} />
                  <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Nenhum item localizado</p>
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1 max-w-[280px]">
                    {searchTerm 
                      ? 'Nenhum resultado corresponde à sua pesquisa. Tente outro nome.' 
                      : 'Nenhum item recente disponível. Digite acima para pesquisar.'}
                  </p>
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </>
  );
}
