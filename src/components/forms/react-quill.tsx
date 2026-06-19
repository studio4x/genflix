import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { mergeAttributes, Node } from '@tiptap/core';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import Gapcursor from '@tiptap/extension-gapcursor';
import { TextStyle } from '@tiptap/extension-text-style';
import { Bold, Code2, Eraser, Image as ImageIcon, Italic, Link2, List, ListOrdered, Minus, Redo2, Quote, Strikethrough, Table2, Undo2, Underline as UnderlineIcon, Film } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToolbarItem = string | Record<string, unknown> | Array<string | Record<string, unknown>>;

type ReactQuillProps = {
  value: string;
  onChange: (value: string) => void;
  onRequestImage?: () => Promise<{
    src: string;
    alt?: string;
  } | null> | {
    src: string;
    alt?: string;
  } | null;
  placeholder?: string;
  className?: string;
  minHeightClassName?: string;
  theme?: string;
  modules?: {
    toolbar?: ToolbarItem[];
  };
  formats?: string[];
  enableHtmlMode?: boolean;
  visualTabLabel?: string;
  htmlTabLabel?: string;
};

type FlattenedToolbarItem = string | Record<string, unknown>;

type RichTextImageSelection = {
  src: string;
  alt?: string;
};

type SupportedToolbarFlags = {
  header: boolean;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  ordered: boolean;
  bullet: boolean;
  align: boolean;
  link: boolean;
  image: boolean;
  video: boolean;
  table: boolean;
  columns: boolean;
  blockquote: boolean;
  codeBlock: boolean;
  clean: boolean;
  horizontalRule: boolean;
  undo: boolean;
  redo: boolean;
};

const defaultToolbar = [
  [{ header: [1, 2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  [{ align: [] }],
  ['blockquote', 'code-block'],
  ['link', 'image', 'table', 'video'],
  [{ columns: [1, 2, 3, 4] }],
  ['clean'],
] satisfies ToolbarItem[];

function flattenToolbarItems(toolbar: ToolbarItem[] | undefined) {
  return (toolbar ?? []).flatMap((item) => (Array.isArray(item) ? item : [item])) as FlattenedToolbarItem[];
}

function toolbarHasString(items: FlattenedToolbarItem[], expected: string) {
  return items.some((item) => item === expected);
}

function toolbarHasObjectKey(items: FlattenedToolbarItem[], expected: string) {
  return items.some((item) => typeof item === 'object' && item !== null && expected in item);
}

function toolbarHasObjectValue(items: FlattenedToolbarItem[], expectedKey: string, expectedValue: unknown) {
  return items.some((item) => (typeof item === 'object'
    && item !== null
    && expectedKey in item
    && (item as Record<string, unknown>)[expectedKey] === expectedValue));
}

function normalizeHtmlInput(html: string) {
  return html.replace(/\uFEFF/g, '');
}

function normalizeHtmlOutput(html: string) {
  return normalizeHtmlInput(html).replace(/\r\n/g, '\n');
}

function extractPlainText(html: string) {
  if (typeof document === 'undefined') {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const container = document.createElement('div');
  container.innerHTML = html;
  return (container.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function getYouTubeEmbedUrl(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host.includes('youtu.be')) {
      const videoId = parsed.pathname.replace('/', '').trim();
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }
    if (host.includes('youtube.com') || host.includes('m.youtube.com')) {
      const videoId = parsed.searchParams.get('v');
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }
      const parts = parsed.pathname.split('/').filter(Boolean);
      const embedIndex = parts.findIndex((part) => part === 'embed' || part === 'shorts');
      if (embedIndex >= 0 && parts[embedIndex + 1]) {
        return `https://www.youtube.com/embed/${parts[embedIndex + 1]}`;
      }
    }
  }
  catch {
    return null;
  }
  return null;
}

function isSafeVideoUrl(url: string) {
  return /^(https?:)?\/\//i.test(url) || /^https?:\/\/[^\s]+$/i.test(url) || /^\/[^/]/.test(url);
}

function normalizeVideoInput(input: string) {
  const raw = input.trim();
  if (!raw) {
    return null;
  }
  if (raw.includes('<iframe')) {
    if (typeof document === 'undefined') {
      const match = raw.match(/src=["']([^"']+)["']/i);
      return match?.[1] ? { src: match[1].trim(), title: 'Vídeo incorporado' } : null;
    }
    const container = document.createElement('div');
    container.innerHTML = raw;
    const iframe = container.querySelector('iframe');
    const src = iframe?.getAttribute('src')?.trim() ?? '';
    if (!src) {
      return null;
    }
    return {
      src,
      title: iframe?.getAttribute('title')?.trim() || 'Vídeo incorporado',
    };
  }
  const youtubeEmbedUrl = getYouTubeEmbedUrl(raw);
  if (youtubeEmbedUrl) {
    return {
      src: youtubeEmbedUrl,
      title: 'Vídeo do YouTube',
    };
  }
  if (!isSafeVideoUrl(raw)) {
    return null;
  }
  return {
    src: raw,
    title: 'Vídeo incorporado',
  };
}

function buildEqualColumnWidths(columns: number) {
  const safeColumns = Math.max(1, Math.min(4, columns));
  const base = Math.floor(100 / safeColumns);
  const widths = Array.from({ length: safeColumns }, () => base);
  widths[safeColumns - 1] += 100 - (base * safeColumns);
  return widths;
}

function createFilledParagraph(editor: any) {
  return editor.schema.nodes.paragraph.createAndFill() ?? editor.schema.nodes.paragraph.create();
}

type ToolbarGroupProps = {
  label: string;
  children: ReactNode;
  className?: string;
};

type ToolbarButtonProps = {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  active?: boolean;
  title: string;
  onClick: () => void;
};

function ToolbarGroup({ label, children, className = '' }: ToolbarGroupProps) {
  return (
    <div className={cn('rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm', className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{label}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

function ToolbarButton({ children, className = '', disabled = false, active = false, title, onClick }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-10 items-center justify-center rounded-xl border px-3 text-sm font-semibold transition',
        'focus:outline-none focus:ring-2 focus:ring-[#CBEAF3] focus:ring-offset-1',
        disabled
          ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300'
          : active
            ? 'border-[#0A3640] bg-[#0A3640] text-white shadow-sm'
            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
        className,
      )}
    >
      {children}
    </button>
  );
}

const ColumnNode = Node.create({
  name: 'column',
  content: 'block+',
  isolating: true,
  group: 'block',

  parseHTML() {
    return [
      {
        tag: 'div.genflix-column',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'genflix-column' }), 0];
  },
});

const ColumnsNode = Node.create({
  name: 'columns',
  content: 'column+',
  group: 'block',
  isolating: true,
  draggable: true,

  addAttributes() {
    return {
      count: {
        default: 2,
        parseHTML: (element) => {
          const raw = element.getAttribute('data-hcm-columns') ?? '';
          const parsed = Number.parseInt(raw, 10);
          return Number.isFinite(parsed) ? Math.max(1, Math.min(4, parsed)) : 2;
        },
      },
      widths: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-hcm-column-widths') ?? '',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div.genflix-columns',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const count = Math.max(1, Math.min(4, node.childCount || node.attrs.count || 2));
    const widths = typeof node.attrs.widths === 'string' && node.attrs.widths.trim() !== ''
      ? node.attrs.widths
      : buildEqualColumnWidths(count).map((value) => `${value}`).join(',');
    const template = widths
      .split(',')
      .map((part) => `${part.trim().replace('%', '')}%`)
      .filter((part) => part.trim() !== '')
      .join(' ');
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        class: `genflix-columns genflix-columns-${count}`,
        'data-hcm-columns': String(count),
        'data-hcm-column-widths': widths,
        style: template ? `--hcm-columns-template: ${template};` : undefined,
      }),
      0,
    ];
  },
});

const EmbeddedVideoNode = Node.create({
  name: 'embeddedVideo',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: '',
        parseHTML: (element) => {
          if (element instanceof HTMLElement) {
            return element.getAttribute('data-hcm-video-src')
              ?? element.getAttribute('src')
              ?? element.querySelector('iframe')?.getAttribute('src')
              ?? '';
          }
          return '';
        },
      },
      title: {
        default: 'Vídeo incorporado',
        parseHTML: (element) => {
          if (element instanceof HTMLElement) {
            return element.getAttribute('data-hcm-video-title')
              ?? element.getAttribute('title')
              ?? element.querySelector('iframe')?.getAttribute('title')
              ?? 'Vídeo incorporado';
          }
          return 'Vídeo incorporado';
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div.embedded-video',
        getAttrs: (element) => {
          if (!(element instanceof HTMLElement)) {
            return false;
          }
          const iframe = element.querySelector('iframe');
          const src = iframe?.getAttribute('src')?.trim() ?? element.getAttribute('data-hcm-video-src')?.trim() ?? '';
          if (!src) {
            return false;
          }
          return {
            src,
            title: iframe?.getAttribute('title')?.trim() || element.getAttribute('data-hcm-video-title')?.trim() || 'Vídeo incorporado',
          };
        },
      },
      {
        tag: 'iframe[src]',
        getAttrs: (element) => {
          if (!(element instanceof HTMLIFrameElement)) {
            return false;
          }
          const src = element.getAttribute('src')?.trim() ?? '';
          if (!src) {
            return false;
          }
          return {
            src,
            title: element.getAttribute('title')?.trim() || 'Vídeo incorporado',
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const src = node.attrs.src as string;
    const title = (node.attrs.title as string) || 'Vídeo incorporado';
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        class: 'embedded-video',
        'data-hcm-movable': 'true',
        'data-hcm-video-src': src,
        'data-hcm-video-title': title,
      }),
      [
        'iframe',
        {
          src,
          title,
          frameborder: '0',
          allowfullscreen: 'true',
          allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
          referrerpolicy: 'strict-origin-when-cross-origin',
        },
      ],
    ];
  },
});

function createEditorExtensions(placeholder: string | undefined) {
  return [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3, 4, 5, 6],
      },
    }),
    Underline,
    TextStyle,
    Link.configure({
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      HTMLAttributes: {
        rel: 'noreferrer noopener',
        target: '_blank',
      },
    }),
    Image.configure({
      inline: false,
      allowBase64: false,
      HTMLAttributes: {
        class: 'genflix-editor-image',
        loading: 'lazy',
      },
    }),
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),
    Placeholder.configure({
      placeholder: placeholder ?? '',
      emptyEditorClass: 'is-editor-empty',
      emptyNodeClass: 'is-empty-node',
    }),
    Table.configure({
      resizable: true,
      HTMLAttributes: {
        class: 'genflix-editor-table',
      },
    }),
    TableRow,
    TableHeader,
    TableCell,
    Gapcursor,
    ColumnNode,
    ColumnsNode,
    EmbeddedVideoNode,
  ];
}

export default function ReactQuill({
  value,
  onChange,
  onRequestImage,
  placeholder,
  className = '',
  minHeightClassName = 'min-h-[180px]',
  modules,
  enableHtmlMode = false,
  visualTabLabel = 'Visual',
  htmlTabLabel = 'HTML',
}: ReactQuillProps) {
  const [activeMode, setActiveMode] = useState<'visual' | 'html'>('visual');
  const [selectionTick, setSelectionTick] = useState(0);
  const [headingChoice, setHeadingChoice] = useState('');
  const [alignChoice, setAlignChoice] = useState('');
  const [columnsChoice, setColumnsChoice] = useState('');
  const onChangeRef = useRef(onChange);
  const activeModeRef = useRef(activeMode);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    activeModeRef.current = activeMode;
  }, [activeMode]);

  useEffect(() => {
    if (!enableHtmlMode && activeMode === 'html') {
      setActiveMode('visual');
    }
  }, [activeMode, enableHtmlMode]);

  const toolbarItems = useMemo(() => flattenToolbarItems(modules?.toolbar ?? defaultToolbar), [modules]);
  const toolbarButtons = useMemo<SupportedToolbarFlags>(() => ({
    header: toolbarHasObjectKey(toolbarItems, 'header'),
    bold: toolbarHasString(toolbarItems, 'bold'),
    italic: toolbarHasString(toolbarItems, 'italic'),
    underline: toolbarHasString(toolbarItems, 'underline'),
    strike: toolbarHasString(toolbarItems, 'strike'),
    ordered: toolbarHasObjectValue(toolbarItems, 'list', 'ordered'),
    bullet: toolbarHasObjectValue(toolbarItems, 'list', 'bullet'),
    align: toolbarHasObjectKey(toolbarItems, 'align'),
    link: toolbarHasString(toolbarItems, 'link'),
    image: toolbarHasString(toolbarItems, 'image'),
    video: toolbarHasString(toolbarItems, 'video'),
    table: toolbarHasString(toolbarItems, 'table'),
    columns: toolbarHasObjectKey(toolbarItems, 'columns'),
    blockquote: toolbarHasString(toolbarItems, 'blockquote'),
    codeBlock: toolbarHasString(toolbarItems, 'code-block'),
    clean: toolbarHasString(toolbarItems, 'clean'),
    horizontalRule: toolbarHasString(toolbarItems, 'hr'),
    undo: toolbarHasString(toolbarItems, 'undo'),
    redo: toolbarHasString(toolbarItems, 'redo'),
  }), [toolbarItems]);

  const editor = useEditor({
    extensions: createEditorExtensions(placeholder),
    content: normalizeHtmlInput(value),
    editorProps: {
      attributes: {
        class: cn(
          'tiptap-content focus:outline-none',
          'w-full bg-white px-4 py-4 text-sm leading-7 text-slate-800',
          minHeightClassName,
          '[&_a]:text-sky-700 [&_a]:underline [&_a]:underline-offset-2',
          '[&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:pl-4 [&_blockquote]:italic',
          '[&_h1]:my-4 [&_h1]:text-3xl [&_h1]:font-black [&_h1]:leading-tight',
          '[&_h2]:my-4 [&_h2]:text-2xl [&_h2]:font-black [&_h2]:leading-tight',
          '[&_h3]:my-3 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:leading-tight',
          '[&_h4]:my-3 [&_h4]:text-lg [&_h4]:font-bold [&_h4]:leading-tight',
          '[&_h5]:my-2 [&_h5]:text-base [&_h5]:font-bold',
          '[&_h6]:my-2 [&_h6]:text-sm [&_h6]:font-bold',
          '[&_img]:h-auto [&_img]:max-w-full',
          '[&_li]:my-1 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6',
          '[&_p]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-slate-950 [&_pre]:p-4 [&_pre]:font-mono [&_pre]:text-slate-100',
          '[&_strong]:font-bold',
          '[&_table]:my-6 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-slate-300 [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-slate-300 [&_th]:bg-slate-100 [&_th]:px-3 [&_th]:py-2',
          '[&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6',
          '[&_iframe]:min-h-[320px] [&_iframe]:w-full',
          '[&_.embedded-video]:my-5 [&_.embedded-video]:overflow-hidden [&_.embedded-video]:rounded-2xl [&_.embedded-video]:border [&_.embedded-video]:border-slate-200 [&_.embedded-video]:bg-slate-950',
          '[&_.embedded-video_iframe]:aspect-video [&_.embedded-video_iframe]:w-full [&_.embedded-video_iframe]:min-h-[320px]',
          '[&_.genflix-columns]:my-6 [&_.genflix-columns]:grid [&_.genflix-columns]:gap-4',
          '[&_.genflix-column]:min-h-[110px] [&_.genflix-column]:rounded-[16px] [&_.genflix-column]:border [&_.genflix-column]:border-dashed [&_.genflix-column]:border-slate-300 [&_.genflix-column]:bg-slate-50 [&_.genflix-column]:p-4',
          '[&_.genflix-editor-table]:overflow-hidden',
          '[&_.genflix-editor-image]:h-auto [&_.genflix-editor-image]:max-w-full',
        ),
      },
    },
    immediatelyRender: false,
    onUpdate: ({ editor: nextEditor }) => {
      if (activeModeRef.current !== 'visual') {
        return;
      }
      onChangeRef.current(normalizeHtmlOutput(nextEditor.getHTML()));
    },
    onSelectionUpdate: () => {
      setSelectionTick((value) => value + 1);
    },
  });

  useEffect(() => {
    if (!editor || activeMode !== 'visual') {
      return;
    }
    const nextHtml = normalizeHtmlOutput(value);
    const currentHtml = normalizeHtmlOutput(editor.getHTML());
    if (nextHtml !== currentHtml) {
      editor.commands.setContent(nextHtml, { emitUpdate: false });
    }
  }, [activeMode, editor, value]);

  useEffect(() => {
    if (!editor) {
      return;
    }
    editor.setEditable(activeMode === 'visual');
  }, [activeMode, editor]);

  function setHeading(level: number | false) {
    if (!editor) {
      return;
    }
    if (level === false) {
      editor.chain().focus().setParagraph().run();
      return;
    }
    editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 }).run();
  }

  async function handleInsertImage() {
    if (!editor) {
      return;
    }
    let selectedImage: RichTextImageSelection | null | undefined;
    if (onRequestImage) {
      selectedImage = await onRequestImage();
    }
    else {
      const src = window.prompt('Digite a URL da imagem');
      if (!src) {
        return;
      }
      const alt = window.prompt('Texto alternativo da imagem') ?? '';
      selectedImage = { src, alt };
    }
    if (!selectedImage?.src?.trim()) {
      return;
    }
    editor.chain().focus().setImage({
      src: selectedImage.src.trim(),
      alt: selectedImage.alt?.trim() || '',
    }).run();
  }

  function handleInsertLink() {
    if (!editor) {
      return;
    }
    const previousHref = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Digite a URL do link', previousHref ?? '');
    if (url === null) {
      return;
    }
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: trimmedUrl }).run();
  }

  function handleInsertVideo() {
    if (!editor) {
      return;
    }
    const rawValue = window.prompt('Cole a URL do vídeo ou um iframe completo');
    if (!rawValue) {
      return;
    }
    const normalized = normalizeVideoInput(rawValue);
    if (!normalized) {
      return;
    }
    editor.chain().focus().insertContent({
      type: 'embeddedVideo',
      attrs: normalized,
    }).run();
  }

  function handleInsertTable() {
    if (!editor) {
      return;
    }
    const rowsInput = window.prompt('Quantas linhas a tabela deve ter?', '3');
    const columnsInput = window.prompt('Quantas colunas a tabela deve ter?', '3');
    if (!rowsInput || !columnsInput) {
      return;
    }
    const rows = Number.parseInt(rowsInput, 10);
    const columns = Number.parseInt(columnsInput, 10);
    if (!Number.isFinite(rows) || !Number.isFinite(columns)) {
      return;
    }
    editor.chain().focus().insertTable({
      rows: Math.max(1, Math.min(12, rows)),
      cols: Math.max(1, Math.min(8, columns)),
      withHeaderRow: true,
    }).run();
  }

  function handleInsertColumns(event: ChangeEvent<HTMLSelectElement>) {
    if (!editor) {
      event.currentTarget.value = '';
      return;
    }
    const columns = Number.parseInt(event.target.value, 10);
    if (!Number.isFinite(columns)) {
      event.currentTarget.value = '';
      return;
    }
    const safeColumns = Math.max(1, Math.min(4, columns));
    if (safeColumns === 1) {
      editor.chain().focus().setParagraph().run();
      event.currentTarget.value = '';
      return;
    }
    const columnsNode = editor.schema.nodes.columns;
    const columnNode = editor.schema.nodes.column;
    const widths = buildEqualColumnWidths(safeColumns).join(',');
    const columnChildren = Array.from({ length: safeColumns }, () => columnNode.create({}, [createFilledParagraph(editor)]));
    editor.chain().focus().insertContent(columnsNode.create({ count: safeColumns, widths }, columnChildren)).run();
    event.currentTarget.value = '';
  }

  function handleSetAlign(alignment: string) {
    if (!editor) {
      return;
    }
    if (alignment === 'left' || alignment === 'center' || alignment === 'right' || alignment === 'justify') {
      editor.chain().focus().setTextAlign(alignment).run();
    }
  }

  function handleCleanFormatting() {
    if (!editor) {
      return;
    }
    editor.chain().focus().unsetAllMarks().clearNodes().run();
  }

  const textStats = useMemo(() => {
    const htmlValue = activeMode === 'visual' && editor ? editor.getHTML() : value;
    const text = activeMode === 'visual' && editor ? editor.getText() : extractPlainText(htmlValue);
    const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
    const characters = text.length;
    return { words, characters };
  }, [activeMode, editor, selectionTick, value]);

  const visualToolbar = (
    <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-4">
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
        <ToolbarGroup label="Estrutura">
          {toolbarButtons.header ? (
            <label title="Escolher nível de título" className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50">
              <select
                value={headingChoice}
                onChange={(event) => {
                  const level = event.currentTarget.value;
                  if (!level) {
                    return;
                  }
                  setHeading(level === 'false' ? false : Number.parseInt(level, 10));
                  setHeadingChoice('');
                }}
                className="min-w-0 border-0 bg-transparent p-0 text-sm font-semibold text-slate-700 outline-none focus:ring-0"
              >
                <option value="" disabled>
                  Estrutura
                </option>
                <option value="1">H1</option>
                <option value="2">H2</option>
                <option value="3">H3</option>
                <option value="4">H4</option>
                <option value="5">H5</option>
                <option value="6">H6</option>
                <option value="false">Parágrafo</option>
              </select>
            </label>
          ) : null}
          {toolbarButtons.align ? (
            <label title="Alinhamento do texto" className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50">
              <select
                value={alignChoice}
                onChange={(event) => {
                  const alignment = event.currentTarget.value;
                  if (!alignment) {
                    return;
                  }
                  handleSetAlign(alignment);
                  setAlignChoice('');
                }}
                className="min-w-0 border-0 bg-transparent p-0 text-sm font-semibold text-slate-700 outline-none focus:ring-0"
              >
                <option value="" disabled>
                  Alinhar
                </option>
                <option value="left">Esquerda</option>
                <option value="center">Centro</option>
                <option value="right">Direita</option>
                <option value="justify">Justificar</option>
              </select>
            </label>
          ) : null}
        </ToolbarGroup>

        <ToolbarGroup label="Texto">
          {toolbarButtons.bold ? (
            <ToolbarButton title="Negrito" active={editor?.isActive('bold') ?? false} onClick={() => editor?.chain().focus().toggleBold().run()} className="w-10 px-0">
              <Bold className="h-4 w-4" />
            </ToolbarButton>
          ) : null}
          {toolbarButtons.italic ? (
            <ToolbarButton title="Itálico" active={editor?.isActive('italic') ?? false} onClick={() => editor?.chain().focus().toggleItalic().run()} className="w-10 px-0">
              <Italic className="h-4 w-4" />
            </ToolbarButton>
          ) : null}
          {toolbarButtons.underline ? (
            <ToolbarButton title="Sublinhado" active={editor?.isActive('underline') ?? false} onClick={() => editor?.chain().focus().toggleUnderline().run()} className="w-10 px-0">
              <UnderlineIcon className="h-4 w-4" />
            </ToolbarButton>
          ) : null}
          {toolbarButtons.strike ? (
            <ToolbarButton title="Tachado" active={editor?.isActive('strike') ?? false} onClick={() => editor?.chain().focus().toggleStrike().run()} className="w-10 px-0">
              <Strikethrough className="h-4 w-4" />
            </ToolbarButton>
          ) : null}
        </ToolbarGroup>

        <ToolbarGroup label="Listas e blocos">
          {toolbarButtons.ordered ? (
            <ToolbarButton title="Lista numerada" active={editor?.isActive('orderedList') ?? false} onClick={() => editor?.chain().focus().toggleOrderedList().run()} className="w-10 px-0">
              <ListOrdered className="h-4 w-4" />
            </ToolbarButton>
          ) : null}
          {toolbarButtons.bullet ? (
            <ToolbarButton title="Lista com marcadores" active={editor?.isActive('bulletList') ?? false} onClick={() => editor?.chain().focus().toggleBulletList().run()} className="w-10 px-0">
              <List className="h-4 w-4" />
            </ToolbarButton>
          ) : null}
          {toolbarButtons.blockquote ? (
            <ToolbarButton title="Citação" active={editor?.isActive('blockquote') ?? false} onClick={() => editor?.chain().focus().toggleBlockquote().run()} className="w-10 px-0">
              <Quote className="h-4 w-4" />
            </ToolbarButton>
          ) : null}
          {toolbarButtons.codeBlock ? (
            <ToolbarButton title="Bloco de código" active={editor?.isActive('codeBlock') ?? false} onClick={() => editor?.chain().focus().toggleCodeBlock().run()} className="w-10 px-0">
              <Code2 className="h-4 w-4" />
            </ToolbarButton>
          ) : null}
          {toolbarButtons.horizontalRule ? (
            <ToolbarButton title="Linha divisória" onClick={() => editor?.chain().focus().setHorizontalRule().run()} className="w-10 px-0">
              <Minus className="h-4 w-4" />
            </ToolbarButton>
          ) : null}
        </ToolbarGroup>

        <ToolbarGroup label="Inserir">
          {toolbarButtons.link ? (
            <>
              <ToolbarButton title="Inserir link" active={editor?.isActive('link') ?? false} onClick={handleInsertLink} className="w-10 px-0">
                <Link2 className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton title="Remover link" onClick={() => editor?.chain().focus().extendMarkRange('link').unsetLink().run()} className="w-10 px-0">
                <Link2 className="h-4 w-4 rotate-45" />
              </ToolbarButton>
            </>
          ) : null}
          {toolbarButtons.image ? (
            <ToolbarButton title="Inserir imagem" onClick={() => void handleInsertImage()} className="w-10 px-0">
              <ImageIcon className="h-4 w-4" />
            </ToolbarButton>
          ) : null}
          {toolbarButtons.video ? (
            <ToolbarButton title="Inserir vídeo" onClick={handleInsertVideo} className="w-10 px-0">
              <Film className="h-4 w-4" />
            </ToolbarButton>
          ) : null}
          {toolbarButtons.table ? (
            <ToolbarButton title="Inserir tabela" onClick={handleInsertTable} className="w-10 px-0">
              <Table2 className="h-4 w-4" />
            </ToolbarButton>
          ) : null}
          {toolbarButtons.columns ? (
            <label title="Inserir colunas" className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50">
              <select
                value={columnsChoice}
                onChange={(event) => {
                  handleInsertColumns(event);
                  setColumnsChoice('');
                }}
                className="min-w-0 border-0 bg-transparent p-0 text-sm font-semibold text-slate-700 outline-none focus:ring-0"
              >
                <option value="" disabled>
                  Colunas
                </option>
                <option value="1">1 coluna</option>
                <option value="2">2 colunas</option>
                <option value="3">3 colunas</option>
                <option value="4">4 colunas</option>
              </select>
            </label>
          ) : null}
        </ToolbarGroup>

        <ToolbarGroup label="Ações">
          {toolbarButtons.clean ? (
            <ToolbarButton title="Limpar formatação" onClick={handleCleanFormatting} className="w-10 px-0">
              <Eraser className="h-4 w-4" />
            </ToolbarButton>
          ) : null}
          {toolbarButtons.undo ? (
            <ToolbarButton title="Desfazer" onClick={() => editor?.chain().focus().undo().run()} className="w-10 px-0">
              <Undo2 className="h-4 w-4" />
            </ToolbarButton>
          ) : null}
          {toolbarButtons.redo ? (
            <ToolbarButton title="Refazer" onClick={() => editor?.chain().focus().redo().run()} className="w-10 px-0">
              <Redo2 className="h-4 w-4" />
            </ToolbarButton>
          ) : null}
        </ToolbarGroup>
      </div>
    </div>
  );

  return (
    <div className={cn('react-quill-local flex flex-col overflow-hidden', className)}>
      {enableHtmlMode ? (
        <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50 px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-full bg-[#E8F6FA] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#0A3640]">
                  Editor rico
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-500">
                  {textStats.words} palavras · {textStats.characters} caracteres
                </span>
              </div>
              <span className="block text-sm font-medium text-slate-500">
                Altere entre visual e HTML quando precisar. A barra abaixo reúne as ações mais usadas por grupo.
              </span>
            </div>
            <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setActiveMode('visual')}
              className={cn('rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em]', activeMode === 'visual' ? 'bg-[#0A3640] text-white' : 'text-slate-500 hover:bg-slate-100')}
            >
              {visualTabLabel}
            </button>
            <button
              type="button"
              onClick={() => setActiveMode('html')}
              className={cn('rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em]', activeMode === 'html' ? 'bg-[#0A3640] text-white' : 'text-slate-500 hover:bg-slate-100')}
            >
              {htmlTabLabel}
            </button>
            </div>
          </div>
        </div>
      ) : null}

      {activeMode === 'visual' ? (
        <>
          {visualToolbar}
          <div className="relative">
            <EditorContent
              editor={editor}
              className={cn(
                'tiptap-editor w-full bg-white px-4 py-4 text-sm leading-7 text-slate-800 outline-none',
                minHeightClassName,
              )}
            />
          </div>
        </>
      ) : (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={16}
          className="min-h-[220px] w-full resize-y bg-[#0B1220] px-4 py-4 font-mono text-sm leading-6 text-slate-100 outline-none"
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-semibold text-slate-500">
        <span>{activeMode === 'visual' ? 'Modo visual ativo. Use os grupos abaixo para estruturar e inserir conteúdo.' : 'Modo HTML ativo. Aqui você pode ajustar a marcação manualmente.'}</span>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
          HTML como fonte
        </span>
      </div>

      <style>{`
        .react-quill-local .tiptap-editor p.is-editor-empty:first-child::before {
          color: #94a3b8;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }

        .react-quill-local .tiptap-editor .genflix-columns {
          display: grid;
          gap: 1rem;
          margin: 1.5rem 0;
          grid-template-columns: var(--hcm-columns-template, repeat(2, minmax(0, 1fr)));
        }

        @media (min-width: 768px) {
          .react-quill-local .tiptap-editor .genflix-columns[data-hcm-columns="2"] {
            grid-template-columns: var(--hcm-columns-template, repeat(2, minmax(0, 1fr)));
          }

          .react-quill-local .tiptap-editor .genflix-columns[data-hcm-columns="3"] {
            grid-template-columns: var(--hcm-columns-template, repeat(3, minmax(0, 1fr)));
          }

          .react-quill-local .tiptap-editor .genflix-columns[data-hcm-columns="4"] {
            grid-template-columns: var(--hcm-columns-template, repeat(4, minmax(0, 1fr)));
          }
        }

        .react-quill-local .tiptap-editor .genflix-column > :first-child {
          margin-top: 0;
        }

        .react-quill-local .tiptap-editor .genflix-column > :last-child {
          margin-bottom: 0;
        }

        .react-quill-local .tiptap-editor .genflix-column {
          min-height: 110px;
          border: 1px dashed #cbd5e1;
          border-radius: 16px;
          padding: 1rem;
          background: #f8fafc;
        }

        .react-quill-local .tiptap-editor .embedded-video iframe {
          display: block;
          border: 0;
        }
      `}</style>
    </div>
  );
}


