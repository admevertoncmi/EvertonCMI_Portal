import React, { useRef, useEffect, useMemo } from 'react';
import ReactQuill, { Quill } from 'react-quill-new';
import { createClient } from '@/lib/supabase-browser';
import { toast } from 'sonner';
import 'react-quill-new/dist/quill.snow.css';

if (typeof window !== 'undefined') {
  (window as any).Quill = Quill;
  const ImageResize = require('quill-image-resize-module-react').default;
  Quill.register('modules/imageResize', ImageResize);
  const MagicUrl = require('quill-magic-url').default;
  Quill.register('modules/magicUrl', MagicUrl);
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
                  error: 'Erro ao fazer upload da imagem colada.'
                }
              );
            }
          }
        };

        // --- INTERCEPTADOR DE DROP (Arrastar e Soltar) ---
        const handleDrop = async (e: DragEvent) => {
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
                  error: 'Erro ao fazer upload da imagem arrastada.'
                }
              );
            }
          }
        };

        editor.root.addEventListener('paste', handlePaste, true);
        editor.root.addEventListener('drop', handleDrop, true);

        // Cleanup
        return () => {
          editor.root.removeEventListener('paste', handlePaste, true);
          editor.root.removeEventListener('drop', handleDrop, true);
        };
      }
    }
  }, []);

  const modules = useMemo(() => {
    return {
      magicUrl: true, // Enables automatic link identification while typing
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
            input.click();

            input.onchange = async () => {
              if (input.files && input.files.length > 0) {
                const quill = quillRef.current?.getEditor();
                if (!quill) return;
                const range = quill.getSelection(true);
                let offset = range.index;

                const supabase = createClient();
                const files = Array.from(input.files);
                
                toast.promise(
                  Promise.all(files.map(async (file) => {
                    const ext = file.name.split('.').pop() || 'jpg';
                    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
                    
                    const { data, error } = await supabase.storage
                      .from('roteiros-midia')
                      .upload(fileName, file, { cacheControl: '3600', upsert: false });
                      
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
                    error: 'Erro ao enviar imagens. O Bucket "roteiros-midia" existe e é público?'
                  }
                );
              }
            };
          }
        }
      },
      imageResize: {
        parchment: Quill.import('parchment'),
        modules: ['Resize', 'DisplaySize', 'Toolbar']
      },
      ...(props.modules || {})
    };
  }, [props.modules]);

  return <ReactQuill ref={quillRef} {...props} modules={modules} />;
};

export default EditorWrapper;
