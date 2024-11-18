'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { LayoutList, PenSquare, LogOut, Menu, RotateCcw, RotateCw, Eye, Save, Trash2, X, Moon, Sun, Bold, Italic, Code } from 'lucide-react'
import debounce from 'lodash/debounce'
import hljs from 'highlight.js'
import 'highlight.js/styles/atom-one-dark.css'
import ReactMarkdown from 'react-markdown'

const lowlight = createLowlight(common)

type Note = {
  id: string
  title: string
  content: string
  created_at: string
  user_id: string
}

type HistoryState = {
  content: string
  timestamp: number
}

export default function NoteEditor() {
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isPreview, setIsPreview] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [history, setHistory] = useState<HistoryState[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [isEditing, setIsEditing] = useState(false)
  const router = useRouter()
  const supabase = createClientComponentClient()
  const sidebarRef = useRef<HTMLDivElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      CodeBlockLowlight.configure({
        lowlight,
        HTMLAttributes: {
          class: 'hljs',
        },
      }),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      const newContent = editor.getHTML()
      setContent(newContent)
      updateHistory(newContent)
      setIsEditing(true)
      debouncedAutoSave(newContent)
    },
    editorProps: {
      attributes: {
        class: 'prose dark:prose-invert focus:outline-none max-w-full min-h-[500px]',
      },
    },
  })

  useEffect(() => {
    const savedHistory = localStorage.getItem('noteHistory')
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory))
      setHistoryIndex(JSON.parse(savedHistory).length - 1)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('noteHistory', JSON.stringify(history))
  }, [history])

  const updateHistory = (newContent: string) => {
    const timestamp = Date.now()
    setHistory(prev => [...prev.slice(0, historyIndex + 1), { content: newContent, timestamp }])
    setHistoryIndex(prev => prev + 1)
  }

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(prev => prev - 1)
      const previousState = history[historyIndex - 1]
      editor?.commands.setContent(previousState.content)
      setContent(previousState.content)
    }
  }

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(prev => prev + 1)
      const nextState = history[historyIndex + 1]
      editor?.commands.setContent(nextState.content)
      setContent(nextState.content)
    }
  }

  const fetchNotes = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching notes:', error)
    } else {
      setNotes(data || [])
    }
  }, [supabase, router])

  useEffect(() => {
    fetchNotes()
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' || 'dark'
    setTheme(savedTheme)
    document.documentElement.classList.toggle('dark', savedTheme === 'dark')

    // Set up real-time subscription for all notes
    const subscription = supabase
      .channel('public:notes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notes' }, (payload) => {
        const updatedNote = payload.new as Note
        setNotes(prevNotes => prevNotes.map(note => 
          note.id === updatedNote.id ? updatedNote : note
        ))
        if (selectedNote && selectedNote.id === updatedNote.id && !isEditing) {
          setSelectedNote(updatedNote)
          setTitle(updatedNote.title)
          setContent(updatedNote.content)
          editor?.commands.setContent(updatedNote.content)
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notes' }, (payload) => {
        const newNote = payload.new as Note
        setNotes(prevNotes => [newNote, ...prevNotes])
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notes' }, (payload) => {
        const deletedNoteId = payload.old.id
        setNotes(prevNotes => prevNotes.filter(note => note.id !== deletedNoteId))
        if (selectedNote && selectedNote.id === deletedNoteId) {
          setSelectedNote(null)
          setTitle('')
          setContent('')
          editor?.commands.setContent('')
        }
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [fetchNotes, supabase, editor, selectedNote, isEditing])

  useEffect(() => {
    if (editor && selectedNote) {
      editor.commands.setContent(selectedNote.content)
      setHistory([{ content: selectedNote.content, timestamp: Date.now() }])
      setHistoryIndex(0)
    }
  }, [selectedNote, editor])

  const debouncedAutoSave = useCallback(
    debounce(async (newContent: string) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const noteData = {
        title,
        content: newContent,
        user_id: user.id
      }

      if (selectedNote) {
        const { error } = await supabase
          .from('notes')
          .update(noteData)
          .match({ id: selectedNote.id })

        if (!error) {
          const updatedNotes = notes.map(note => 
            note.id === selectedNote.id ? { ...note, ...noteData } : note
          )
          setNotes(updatedNotes)
        }
      } else {
        const { data, error } = await supabase
          .from('notes')
          .insert([noteData])
          .select()

        if (!error && data) {
          setNotes([data[0], ...notes])
          setSelectedNote(data[0])
        }
      }
      setIsEditing(false)
    }, 1000),
    [selectedNote, title, notes, supabase]
  )

  const handleRemove = async (noteId: string) => {
    const { error } = await supabase
      .from('notes')
      .delete()
      .match({ id: noteId })

    if (!error) {
      const updatedNotes = notes.filter(note => note.id !== noteId)
      setNotes(updatedNotes)
      if (selectedNote?.id === noteId) {
        setSelectedNote(null)
        setTitle('')
        setContent('')
        editor?.commands.setContent('')
        setHistory([])
        setHistoryIndex(-1)
      }
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
    document.documentElement.classList.toggle('dark', newTheme === 'dark')
  }

  const filteredNotes = notes.filter(note => 
    note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.content.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className={`flex h-screen ${theme === 'dark' ? 'dark' : ''}`}>
      <div 
        ref={sidebarRef}
        className={`${
          sidebarOpen ? 'w-64 md:w-72' : 'w-0'
        } transition-all duration-300 overflow-hidden fixed md:relative h-full z-20 bg-white dark:bg-zinc-900 border-r border-gray-200 dark:border-zinc-800`}
      >
        <div className="p-4 h-full flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <LayoutList className="h-5 w-5 text-primary" />
              <span className="font-semibold text-primary">Notes</span>
            </div>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setSidebarOpen(false)}
              className="md:hidden"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close sidebar</span>
            </Button>
          </div>
          <Input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="mb-4"
          />
          <Button
            className="w-full justify-start gap-2 mb-4"
            onClick={() => {
              setSelectedNote(null)
              setTitle('')
              editor?.commands.setContent('')
              setSidebarOpen(false)
              setHistory([])
              setHistoryIndex(-1)
            }}
          >
            <PenSquare className="h-4 w-4" />
            New Note
          </Button>
          <div className="flex-1 overflow-y-auto space-y-2">
            {filteredNotes.map((note) => (
              <div key={note.id} className="group flex items-center gap-2">
                <Button
                  variant="ghost"
                  className={`flex-1 justify-start truncate ${
                    selectedNote?.id === note.id ? 'bg-primary/10 text-primary' : ''
                  }`}
                  onClick={() => {
                    setSelectedNote(note)
                    setTitle(note.title)
                    editor?.commands.setContent(note.content)
                    setSidebarOpen(false)
                  }}
                >
                  {note.title || 'Untitled Note'}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleRemove(note.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                  <span className="sr-only">Delete note</span>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col w-full bg-background text-foreground">
        <header className="flex justify-between items-center p-4 bg-muted/50 border-b border-border">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle sidebar</span>
            </Button>
            <h1 className="text-xl font-semibold">
              {selectedNote ? 'Edit note' : 'New note'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme}>
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              <span className="sr-only">Toggle theme</span>
            </Button>
            <Button 
              onClick={handleLogout}
              variant="secondary"
            >
              <LogOut className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </header>

        <div className="p-4 flex-1 flex flex-col gap-4 max-w-4xl mx-auto w-full">
          <Input
            type="text"
            placeholder="Enter your note title..."
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              setIsEditing(true)
              debouncedAutoSave(content)
            }}
            className="bg-background border-input"
          />

          {editor && (
            <Card>
              <CardContent className="p-1">
                <div className="flex items-center gap-1 mb-2 overflow-x-auto">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={undo}
                    disabled={historyIndex <= 0}
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span className="sr-only">Undo</span>
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={redo}
                    disabled={historyIndex >= history.length - 1}
                  >
                    <RotateCw className="h-4 w-4" />
                    <span className="sr-only">Redo</span>
                  </Button>
                  <div className="w-px h-6 bg-border" />
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    data-active={editor.isActive('bold')}
                    className="data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
                  >
                    <Bold className="h-4 w-4" />
                    <span className="sr-only">Bold</span>
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    data-active={editor.isActive('italic')}
                    className="data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
                  >
                    <Italic className="h-4 w-4" />
                    <span className="sr-only">Italic</span>
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                    data-active={editor.isActive('codeBlock')}
                    className="data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
                  >
                    <Code className="h-4 w-4" />
                    <span className="sr-only">Code block</span>
                  </Button>
                  <div className="flex-1" />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsPreview(!isPreview)}
                    className={isPreview ? 'bg-primary/10 text-primary' : ''}
                  >
                    <Eye className="h-4 w-4" />
                    <span className="sr-only">Toggle preview</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => debouncedAutoSave(content)}
                  >
                    <Save className="h-4 w-4" />
                    <span className="sr-only">Save note</span>
                  </Button>
                  {selectedNote && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemove(selectedNote.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                      <span className="sr-only">Delete note</span>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex-1 overflow-auto">
            {isPreview ? (
              <Card>
                <CardContent className="prose dark:prose-invert max-w-none p-4">
                  <ReactMarkdown
                    components={{
                      code({ node, className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '')
                        return !match ? (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        ) : (
                          <pre className={className}>
                            <code
                              className={match[1]}
                              {...props}
                              dangerouslySetInnerHTML={{
                                __html: hljs.highlight(match[1], children?.toString() || '').value,
                              }}
                            />
                          </pre>
                        )
                      },
                    }}
                  >
                    {content}
                  </ReactMarkdown>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <EditorContent 
                    editor={editor} 
                    className="min-h-[500px] p-4"
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}