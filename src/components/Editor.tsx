import ReactQuill, { Quill } from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

if (typeof window !== 'undefined') {
  (window as any).Quill = Quill;
  const ImageResize = require('quill-image-resize-module-react').default;
  Quill.register('modules/imageResize', ImageResize);
}

const BlockEmbed = Quill.import('blots/block/embed') as any;
class DividerBlot extends BlockEmbed { }
DividerBlot.blotName = 'divider';
DividerBlot.tagName = 'hr';
Quill.register(DividerBlot, true);

export const quillModules = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'list': 'check' }],
    ['link', 'image'],
    ['clean']
  ],
  imageResize: {
    parchment: Quill.import('parchment'),
    modules: ['Resize', 'DisplaySize', 'Toolbar']
  }
};

const EditorWrapper = (props: any) => {
  return <ReactQuill {...props} modules={{ ...quillModules, ...props.modules }} />;
};

export default EditorWrapper;
