import React, { useRef, useEffect, useMemo } from 'react';
import ReactQuill, { Quill } from 'react-quill-new';
import { createClient } from '@/lib/supabase-browser';
import { toast } from 'sonner';
import 'react-quill-new/dist/quill.snow.css';

if (typeof window !== 'undefined') {
  (window as any).Quill = Quill;
  const MagicUrl = require('quill-magic-url').default;
  Quill.register('modules/magicUrl', MagicUrl);
  
  const ImageResize = require('quill-image-resize-module-react').default;
  Quill.register('modules/imageResize', ImageResize);
}

const BlockEmbed = Quill.import('blots/block/embed') as any;
class DividerBlot extends BlockEmbed { }
DividerBlot.blotName = 'divider';
DividerBlot.tagName = 'hr';
Quill.register(DividerBlot, true);

const EditorWrapper = (props: any) => {
  const quillRef = useRef<any>(null);

  useEffect(() => {
    if (quillRef.current) {
      const editor = quillRef.current.getEditor();
      if (editor && editor.root) {
        editor.root.setAttribute('spellcheck', 'true');
        editor.root.setAttribute('lang', 'pt-BR'); // Força o idioma para português
        
        // --- INTERCEPTADOR DE PASTE (Copiar e Colar) ---
        const handlePaste = async (e: ClipboardEvent) => {
          if (e.clipboardData && e.clipboardData.items) {
            const items = Array.from(e.clipboardData.items);
            const imageItems = items.filter(item => item.type.indexOf('image') === 0);
            
            if (imageItems.length > 0) {
              e.preventDefault(); // Impede o Quill de colar como Base64 gigante
              
              const files = imageItems.map(item => item.getAsFile()).filter(f => f) as File[];
              if (files.length === 0) return;

              const range = editor.getSelection(true);
              let offset = range.index;
              
              const supabase = createClient();
              
              toast.promise(
                Promise.all(files.map(async (file) => {
                  const ext = file.name.split('.').pop() || 'jpg';
                  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
                  
                  const { error } = await supabase.storage
                    .from('roteiros-midia')
                    .upload(fileName, file, { cacheControl: '3600', upsert: false });
                    
                  if (error) throw error;
                  
                  const { data: publicUrlData } = supabase.storage.from('roteiros-midia').getPublicUrl(fileName);
                  return publicUrlData.publicUrl;
                })),
                {
                  loading: 'Fazendo upload da imagem colada...',
                  success: (urls) => {
                    urls.forEach(url => {
                      editor.insertEmbed(offset, 'image', url);
                      offset++;
                      editor.setSelection(offset, 0);
                    });
                    return 'Imagem colada e enviada com sucesso!';
                  },
                  error: (err: any) => `Erro ao colar: ${err?.message || 'Erro desconhecido'}`
                }
              );
            }
          }
        };

        // --- MOVER IMAGEM DENTRO DO ROTEIRO (arrastar uma imagem do próprio texto) ---
        let imagemArrastada: HTMLImageElement | null = null;
        const handleDragStart = (e: DragEvent) => {
          const alvo = e.target as HTMLElement;
          if (alvo && alvo.tagName === 'IMG' && editor.root.contains(alvo)) {
            imagemArrastada = alvo as HTMLImageElement;
            try { (editor.getModule('imageResize') as any)?.hide?.(); } catch { /* sem moldura aberta */ }
            if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', ''); }
          } else {
            imagemArrastada = null;
          }
        };
        const handleDragEnd = () => { imagemArrastada = null; };
        const handleDragOver = (e: DragEvent) => {
          if (imagemArrastada) { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'; }
        };
        // Converte o ponto do mouse numa posição do texto do Quill
        const indiceNoPonto = (x: number, y: number): number | null => {
          const doc: any = document;
          let node: Node | null = null;
          let offset = 0;
          if (doc.caretRangeFromPoint) {
            const r = doc.caretRangeFromPoint(x, y);
            if (r) { node = r.startContainer; offset = r.startOffset; }
          } else if (doc.caretPositionFromPoint) {
            const p = doc.caretPositionFromPoint(x, y);
            if (p) { node = p.offsetNode; offset = p.offset; }
          }
          if (!node || !editor.root.contains(node)) return null;
          if (node.nodeType === Node.TEXT_NODE) {
            const blot = Quill.find(node, true) as any;
            return blot ? editor.getIndex(blot) + offset : null;
          }
          const filho = node.childNodes[offset];
          if (filho) {
            const blot = Quill.find(filho, true) as any;
            if (blot) return editor.getIndex(blot);
          }
          const blot = Quill.find(node, true) as any;
          if (!blot || blot === editor.scroll) return editor.getLength() - 1;
          return editor.getIndex(blot) + blot.length() - (node === editor.root ? 0 : 1);
        };
        const moverImagem = (e: DragEvent): boolean => {
          const img = imagemArrastada;
          imagemArrastada = null;
          if (!img) return false;
          e.preventDefault();
          e.stopPropagation();
          const blot = Quill.find(img) as any;
          if (!blot) return true;
          const de = editor.getIndex(blot);
          let para = indiceNoPonto(e.clientX, e.clientY);
          if (para === null || para === de || para === de + 1) return true;
          const conteudo = editor.getContents(de, 1); // a imagem com largura/altura que ela já tinha
          editor.deleteText(de, 1, 'user');
          if (para > de) para -= 1;
          editor.updateContents({ ops: [{ retain: para }, ...conteudo.ops] } as any, 'user');
          editor.setSelection(para + 1, 0, 'silent');
          return true;
        };

        // --- INTERCEPTADOR DE DROP (Arrastar e Soltar) ---
        const handleDrop = async (e: DragEvent) => {
          if (moverImagem(e)) return;
          if (e.dataTransfer && e.dataTransfer.files) {
            const files = Array.from(e.dataTransfer.files).filter(f => f.type.indexOf('image') === 0);
            if (files.length > 0) {
              e.preventDefault();
              
              const range = editor.getSelection(true);
              let offset = range.index;
              
              const supabase = createClient();
              
              toast.promise(
                Promise.all(files.map(async (file) => {
                  const ext = file.name.split('.').pop() || 'jpg';
                  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
                  
                  const { error } = await supabase.storage
                    .from('roteiros-midia')
                    .upload(fileName, file, { cacheControl: '3600', upsert: false });
                    
                  if (error) throw error;
                  
                  const { data: publicUrlData } = supabase.storage.from('roteiros-midia').getPublicUrl(fileName);
                  return publicUrlData.publicUrl;
                })),
                {
                  loading: `Fazendo upload de ${files.length} imagem(ns) arrastada(s)...`,
                  success: (urls) => {
                    urls.forEach(url => {
                      editor.insertEmbed(offset, 'image', url);
                      offset++;
                      editor.setSelection(offset, 0);
                    });
                    return 'Imagens arrastadas e enviadas com sucesso!';
                  },
                  error: (err: any) => `Erro ao arrastar: ${err?.message || 'Erro desconhecido'}`
                }
              );
            }
          }
        };

        editor.root.addEventListener('paste', handlePaste, true);
        editor.root.addEventListener('drop', handleDrop, true);
        editor.root.addEventListener('dragstart', handleDragStart, true);
        editor.root.addEventListener('dragend', handleDragEnd, true);
        editor.root.addEventListener('dragover', handleDragOver, true);

        // Cleanup
        return () => {
          editor.root.removeEventListener('paste', handlePaste, true);
          editor.root.removeEventListener('drop', handleDrop, true);
          editor.root.removeEventListener('dragstart', handleDragStart, true);
          editor.root.removeEventListener('dragend', handleDragEnd, true);
          editor.root.removeEventListener('dragover', handleDragOver, true);
        };
      }
    }
  }, []);

  const modules = useMemo(() => {
    return {
      magicUrl: true, // Enables automatic link identification while typing
      imageResize: {
        parchment: Quill.import('parchment'),
        modules: ['Resize', 'DisplaySize'],
        // A moldura não bloqueia o mouse (assim dá para arrastar a imagem); só as alças de redimensionar recebem clique
        overlayStyles: { pointerEvents: 'none' },
        handleStyles: { pointerEvents: 'auto' }
      },
      toolbar: {
        container: [
          [{ 'header': [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ 'color': [] }, { 'background': [] }],
          [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'list': 'check' }],
          ['link', 'image'],
          ['clean']
        ],
        handlers: {
          image: function() {
            const input = document.createElement('input');
            input.setAttribute('type', 'file');
            input.setAttribute('accept', 'image/*');
            input.setAttribute('multiple', 'true'); // Allows selecting multiple images
            input.style.display = 'none';
            document.body.appendChild(input);
            input.click();

            input.onchange = async () => {
              if (input.files && input.files.length > 0) {
                const files = Array.from(input.files);
                document.body.removeChild(input);
                const quill = quillRef.current?.getEditor();
                if (!quill) return;
                const range = quill.getSelection(true);
                let offset = range.index;

                const supabase = createClient();
                
                toast.promise(
                  Promise.all(files.map(async (file) => {
                    const ext = file.name.split('.').pop() || 'jpg';
                    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
                    const fileBuffer = await file.arrayBuffer();
                    
                    const { data, error } = await supabase.storage
                      .from('roteiros-midia')
                      .upload(fileName, fileBuffer, { 
                        cacheControl: '3600', 
                        upsert: false,
                        contentType: file.type
                      });
                      
                    if (error) {
                      console.error("Erro upload:", error);
                      throw error;
                    }
                    
                    const { data: publicUrlData } = supabase.storage
                      .from('roteiros-midia')
                      .getPublicUrl(fileName);
                      
                    return publicUrlData.publicUrl;
                  })),
                  {
                    loading: `Enviando ${files.length} imagem(ns)...`,
                    success: (urls) => {
                      urls.forEach(url => {
                        quill.insertEmbed(offset, 'image', url);
                        offset++;
                        quill.setSelection(offset, 0);
                      });
                      return 'Imagens adicionadas com sucesso!';
                    },
                    error: (err: any) => `Erro: ${err?.message || 'Falha ao enviar'}`
                  }
                );
              }
            };
          }
        }
      },
      ...(props.modules || {})
    };
  }, [props.modules]);

  return <ReactQuill ref={quillRef} {...props} modules={modules} />;
};

export default EditorWrapper;
