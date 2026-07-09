import ReactQuill, { Quill } from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

const BlockEmbed = Quill.import('blots/block/embed') as any;
class DividerBlot extends BlockEmbed { }
DividerBlot.blotName = 'divider';
DividerBlot.tagName = 'hr';
Quill.register(DividerBlot, true);

export default ReactQuill;
