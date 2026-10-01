import { FontSize, TextStyle } from '@tiptap/extension-text-style'
import type { JSONContent } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { EditorContent, useEditor } from '@tiptap/react'
import { useEffect } from 'react'
import './CharacterRichTextEditor.css'

const emptyDocument: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] }

function parseContent(value: string): JSONContent {
  if (value) {
    try {
      const parsed: unknown = JSON.parse(value)
      if (parsed && typeof parsed === 'object' && 'type' in parsed && parsed.type === 'doc') return parsed as JSONContent
    } catch {
      return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: value }] }] }
    }
    return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: value }] }] }
  }
  return emptyDocument
}

export function CharacterRichTextEditor({ value, onChange, editable = false, emptyText = '—' }: {
  value: string
  onChange?: (value: string) => void
  editable?: boolean
  emptyText?: string
}) {
  const editor = useEditor({
    extensions: [StarterKit, TextStyle, FontSize],
    content: parseContent(value),
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor: changedEditor }) => onChange?.(changedEditor.isEmpty ? '' : JSON.stringify(changedEditor.getJSON())),
  })

  useEffect(() => {
    if (!editor) return
    const next = parseContent(value)
    if (JSON.stringify(editor.getJSON()) !== JSON.stringify(next)) editor.commands.setContent(next, { emitUpdate: false })
  }, [editor, value])

  if (!value && !editable) return <p className="character-rich-text-empty">{emptyText}</p>
  if (!editor) return null

  return <div className={`character-rich-text${editable ? ' character-rich-text--editable' : ' character-rich-text--readonly'}`}>
    {editable && <div aria-label="Formatação do texto" className="character-rich-text__toolbar">
      <button aria-label="Negrito" aria-pressed={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} onMouseDown={(event) => event.preventDefault()} title="Negrito" type="button"><strong>N</strong></button>
      <button aria-label="Itálico" aria-pressed={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} onMouseDown={(event) => event.preventDefault()} title="Itálico" type="button"><em>I</em></button>
      <span aria-hidden="true" className="character-rich-text__toolbar-divider" />
      <button aria-label="Lista com marcadores" aria-pressed={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} onMouseDown={(event) => event.preventDefault()} title="Lista com marcadores" type="button">• Lista</button>
      <button aria-label="Lista numerada" aria-pressed={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} onMouseDown={(event) => event.preventDefault()} title="Lista numerada" type="button">1. Lista</button>
      <select aria-label="Tamanho do texto" onChange={(event) => { if (event.target.value) editor.chain().focus().setFontSize(event.target.value).run(); event.target.value = '' }} value="">
        <option disabled value="">Tamanho</option>
        <option value="12px">Pequeno</option>
        <option value="14px">Normal</option>
        <option value="18px">Grande</option>
        <option value="24px">Título</option>
      </select>
    </div>}
    <EditorContent aria-label={editable ? 'Texto editável' : undefined} className="character-rich-text__content" editor={editor} />
  </div>
}
