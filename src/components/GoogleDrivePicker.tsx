"use client"

import { useState, useEffect } from 'react';
import { FolderPlus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface GoogleDrivePickerProps {
  onSelect: (url: string) => void;
  type?: 'folder' | 'file' | 'all';
  label?: string;
}

// DECLARAÇÕES PARA O TYPESCRIPT NÃO RECLAMAR DAS LIBS DO GOOGLE
declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
const APP_ID = CLIENT_ID?.split('-')[0];

export default function GoogleDrivePicker({ onSelect, type = 'all', label = "Selecionar do Drive" }: GoogleDrivePickerProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // 1. CARREGAR OS SCRIPTS DO GOOGLE
  useEffect(() => {
    const loadScripts = () => {
      const scriptGapi = document.createElement('script');
      scriptGapi.src = 'https://apis.google.com/js/api.js';
      scriptGapi.async = true;
      scriptGapi.defer = true;
      scriptGapi.onload = () => setIsLoaded(true);
      document.body.appendChild(scriptGapi);

      const scriptGis = document.createElement('script');
      scriptGis.src = 'https://accounts.google.com/gsi/client';
      scriptGis.async = true;
      scriptGis.defer = true;
      document.body.appendChild(scriptGis);
    };
    loadScripts();
  }, []);

  const handleOpenPicker = () => {
    if (!CLIENT_ID || !API_KEY) {
      toast.error("Configurações do Google Drive não encontradas no .env");
      return;
    }

    if (accessToken) {
      createPicker(accessToken);
    } else {
      // SOLICITAR TOKEN DE ACESSO
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/drive.readonly',
        callback: (response: any) => {
          if (response.access_token) {
            setAccessToken(response.access_token);
            createPicker(response.access_token);
          }
        },
      });
      client.requestAccessToken();
    }
  };

  const createPicker = (token: string) => {
    window.gapi.load('picker', () => {
      // Usando o namespace correto window.google.picker
      const viewId = type === 'folder'
        ? (window.google.picker.ViewId?.FOLDERS || 'folders')
        : (window.google.picker.ViewId?.DOCS || 'docs');
      const view = new window.google.picker.DocsView(viewId);
      
      if (type === 'folder') {
        view.setIncludeFolders(true);
        view.setSelectFolderEnabled(true);
        view.setMimeTypes('application/vnd.google-apps.folder');
      } else if (type === 'file') {
        view.setIncludeFolders(false);
      } else {
        view.setIncludeFolders(true);
      }

      const title = type === 'folder'
        ? 'Selecionar Pasta'
        : type === 'file'
        ? 'Selecionar Arquivo'
        : 'Selecionar do Google Drive';

      const picker = new window.google.picker.PickerBuilder()
        .setAppId(APP_ID)
        .setOAuthToken(token)
        .setDeveloperKey(API_KEY)
        .addView(view)
        .setTitle(title)
        .setCallback((data: any) => {
          if (data.action === 'picked') {
            const doc = data.docs[0];
            onSelect(doc.url);
            toast.success("Link importado com sucesso!");
          }
        })
        .build();
      picker.setVisible(true);
    });
  };

  return (
    <button
      type="button"
      onClick={handleOpenPicker}
      className="flex items-center gap-2 px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-dashed border-zinc-300 dark:border-zinc-600"
    >
      {isLoaded ? <FolderPlus size={14} /> : <Loader2 size={14} className="animate-spin" />}
      {label}
    </button>
  );
}
