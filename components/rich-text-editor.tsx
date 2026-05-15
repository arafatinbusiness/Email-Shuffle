'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import LinkExtension from '@tiptap/extension-link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  Heading1,
  Heading2,
  Heading3,
  Link,
  Link2Off,
  Variable,
  User,
  Building2,
  Mail,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'

interface RichTextEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: string
  showPersonalization?: boolean
}

// Default personalization tokens always available
const DEFAULT_TOKENS = [
  { label: 'First Name', token: '{{first_name}}', icon: 'User' },
  { label: 'Last Name', token: '{{last_name}}', icon: 'User' },
  { label: 'Full Name', token: '{{full_name}}', icon: 'User' },
  { label: 'Email', token: '{{email}}', icon: 'Mail' },
  { label: 'Company', token: '{{company}}', icon: 'Building2' },
  { label: 'Website', token: '{{website}}', icon: 'Globe' },
  { label: 'Positive Points', token: '{{positive_points}}', icon: 'ThumbsUp' },
  { label: 'Improvements', token: '{{improvements}}', icon: 'TrendingUp' },
  { label: 'Current Website Updates', token: '{{current_website_updates}}', icon: 'RefreshCw' },
  { label: 'FB Ads Notes', token: '{{fb_ads_notes}}', icon: 'Megaphone' },
  { label: 'Pixel Status', token: '{{pixel_status}}', icon: 'Activity' },
  { label: 'Custom Notes', token: '{{custom_notes}}', icon: 'FileText' },
]


export function RichTextEditor({
  content,
  onChange,
  placeholder = 'Write your email here...',
  minHeight = '200px',
  showPersonalization = false,
}: RichTextEditorProps) {
  const [customTokens, setCustomTokens] = useState<{ label: string; token: string }[]>([])
  const [showTokens, setShowTokens] = useState(false)

  // Fetch custom import columns for personalization
  useEffect(() => {
    if (showPersonalization) {
      fetch('/api/import-columns')
        .then(res => res.ok ? res.json() : [])
        .then((columns: string[]) => {
          const tokens = columns
            .filter(col => !['first_name', 'last_name', 'email', 'company_name'].includes(col.toLowerCase().replace(/\s+/g, '_')))
            .map(col => ({
              label: col.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
              token: `{{${col.toLowerCase().replace(/\s+/g, '_')}}}`,
            }))
          setCustomTokens(tokens)
        })
        .catch(() => {})
    }
  }, [showPersonalization])

  const [linkUrl, setLinkUrl] = useState('')
  const [showLinkInput, setShowLinkInput] = useState(false)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      LinkExtension.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline underline-offset-2 cursor-pointer hover:text-primary/80',
        },
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[200px] px-3 py-2',
        style: `min-height: ${minHeight}`,
      },
    },
  })

  // Update editor content when content prop changes externally (e.g., template selection)
  useEffect(() => {
    if (editor && content) {
      // Only update if the content is different to avoid cursor jumping
      const currentHtml = editor.getHTML()
      if (currentHtml !== content) {
        editor.commands.setContent(content, { emitUpdate: false })
      }
    }
  }, [editor, content])

  // Hooks must be called unconditionally - before any early return
  const handleSetLink = useCallback(() => {
    if (!editor) return
    if (linkUrl === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run()
    }
    setShowLinkInput(false)
    setLinkUrl('')
  }, [editor, linkUrl])

  const handleOpenLink = useCallback(() => {
    if (!editor) return
    const previousUrl = editor.getAttributes('link').href
    if (previousUrl) {
      window.open(previousUrl, '_blank')
    }
  }, [editor])

  const handleLinkButtonClick = useCallback(() => {
    if (!editor) return
    const previousUrl = editor.getAttributes('link').href
    if (previousUrl) {
      setLinkUrl(previousUrl)
    } else {
      setLinkUrl('')
    }
    setShowLinkInput(!showLinkInput)
  }, [editor, showLinkInput])

  if (!editor) return null

  const insertToken = (token: string) => {
    editor.chain().focus().insertContent(token).run()
    setShowTokens(false)
  }

  const ToolbarButton = ({
    onClick,
    isActive,
    children,
    title,
  }: {
    onClick: () => void
    isActive: boolean
    children: React.ReactNode
    title: string
  }) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={`h-8 w-8 p-0 ${isActive ? 'bg-accent text-accent-foreground' : ''}`}
      title={title}
    >
      {children}
    </Button>
  )

  const allTokens = [...DEFAULT_TOKENS, ...customTokens]


  return (
    <div className="border rounded-md overflow-hidden">
      <div className="flex flex-wrap items-center gap-0.5 p-1 border-b bg-muted/50">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <div className="w-px h-6 bg-border mx-1" />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive('heading', { level: 1 })}
          title="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
          title="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive('heading', { level: 3 })}
          title="Heading 3"
        >
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>
        <div className="w-px h-6 bg-border mx-1" />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          title="Ordered List"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive('blockquote')}
          title="Quote"
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <div className="w-px h-6 bg-border mx-1" />

        {/* Link button with inline URL input */}
        <div className="relative flex items-center">
          <ToolbarButton
            onClick={handleLinkButtonClick}
            isActive={editor.isActive('link')}
            title={editor.isActive('link') ? 'Edit link' : 'Insert link'}
          >
            <Link className="h-4 w-4" />
          </ToolbarButton>
          {editor.isActive('link') && (
            <ToolbarButton
              onClick={() => editor.chain().focus().unsetLink().run()}
              isActive={false}
              title="Remove link"
            >
              <Link2Off className="h-4 w-4" />
            </ToolbarButton>
          )}
          {showLinkInput && (
            <div className="absolute left-0 top-full mt-1 z-50 flex items-center gap-1 p-1.5 bg-popover border rounded-md shadow-lg min-w-[300px]">
              <Input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
                className="h-8 text-xs flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSetLink()
                  if (e.key === 'Escape') {
                    setShowLinkInput(false)
                    setLinkUrl('')
                  }
                }}
                autoFocus
              />
              <Button
                type="button"
                variant="default"
                size="sm"
                className="h-8 text-xs px-2"
                onClick={handleSetLink}
              >
                {linkUrl ? 'Apply' : 'Remove'}
              </Button>
              {editor.getAttributes('link').href && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={handleOpenLink}
                  title="Open link in new tab"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Personalization dropdown - HubSpot style */}
        {showPersonalization && (
          <div className="relative">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowTokens(!showTokens)}
              className="h-8 px-2 text-xs font-medium text-primary hover:text-primary"
              title="Insert personalization token"
            >
              <Variable className="h-4 w-4 mr-1" />
              Personalize
              {showTokens ? (
                <ChevronDown className="h-3 w-3 ml-1" />
              ) : (
                <ChevronRight className="h-3 w-3 ml-1" />
              )}
            </Button>

            {showTokens && (
              <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-popover border rounded-md shadow-lg max-h-80 overflow-y-auto">
                <div className="p-2 border-b">
                  <p className="text-xs font-medium text-muted-foreground">Insert personalization token</p>
                </div>

                {/* Default tokens */}
                <div className="p-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
                    Standard Fields
                  </p>
                  {DEFAULT_TOKENS.map((t, i) => (
                    <button
                      key={i}
                      type="button"
                      className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded flex items-center gap-2 group"
                      onClick={() => insertToken(t.token)}
                    >
                      {t.icon === 'User' ? (
                        <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      ) : t.icon === 'Building2' ? (
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      ) : (
                        <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      )}
                      <span className="flex-1">{t.label}</span>
                      <code className="text-[10px] text-muted-foreground bg-muted px-1 rounded group-hover:bg-background">
                        {t.token}
                      </code>
                    </button>
                  ))}
                </div>

                {/* Custom tokens from import columns */}
                {customTokens.length > 0 && (
                  <div className="p-1 border-t">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
                      Custom Fields (from imports)
                    </p>
                    {customTokens.map((t, i) => (
                      <button
                        key={i}
                        type="button"
                        className="w-full text-left px-2 py-1.5 text-sm hover:bg-accent rounded flex items-center gap-2 group"
                        onClick={() => insertToken(t.token)}
                      >
                        <Variable className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="flex-1">{t.label}</span>
                        <code className="text-[10px] text-muted-foreground bg-muted px-1 rounded group-hover:bg-background">
                          {t.token}
                        </code>
                      </button>
                    ))}
                  </div>
                )}

                {/* Preview hint */}
                <div className="p-2 border-t bg-muted/30">
                  <p className="text-[10px] text-muted-foreground">
                    Tokens will be replaced with actual data when sending.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          isActive={false}
          title="Undo"
        >
          <Undo className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          isActive={false}
          title="Redo"
        >
          <Redo className="h-4 w-4" />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
