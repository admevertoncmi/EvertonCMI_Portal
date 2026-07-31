import React, { useRef, useEffect, useMemo } from 'react';
import ReactQuill, { Quill } from 'react-quill-new';
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

            input.onchange = () => {
              if (input.files && input.files.length > 0) {
                const quill = quillRef.current?.getEditor();
                if (!quill) return;
                const range = quill.getSelection(true);
                let offset = range.index;

                Array.from(input.files).forEach((file) => {
                  const reader = new FileReader();
                  reader.onload = (e) => {
                    const base64ImageSrc = e.target?.result;
                    if (base64ImageSrc) {
                      quill.insertEmbed(offset, 'image', base64ImageSrc);
                      offset++; // increment offset for the next image
                      quill.setSelection(offset, 0); // move cursor after the inserted image
                    }
                  };
                  reader.readAsDataURL(file);
                });
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
