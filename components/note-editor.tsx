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
import { LayoutList, PenSquare, LogOut, Menu, RotateCcw, RotateCw, Eye, Save, Trash2, X, Moon, Sun } from 'lucide-react'
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
  const router = useRouter()
  const supabase = createClientComponentClient()
  const sidebarRef = useRef<HTMLDivElement>(null)
  const lastUpdateRef = useRef<number>(0)
  const isLocalUpdateRef = useRef(false)

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

    // Set up real-time subscription
    const subscription = supabase
      .channel('notes_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          const updatedNote = payload.new as Note
          setNotes(prevNotes => prevNotes.map(note => 
            note.id === updatedNote.id ? updatedNote : note
          ))
          if (updatedNote.id === selectedNote?.id && !isLocalUpdateRef.current) {
            setSelectedNote(updatedNote)
            setTitle(updatedNote.title)
            editor?.commands.setContent(updatedNote.content)
            setContent(updatedNote.content)
          }
        } else if (payload.eventType === 'INSERT') {
          const newNote = payload.new as Note
          setNotes(prevNotes => [newNote, ...prevNotes])
        } else if (payload.eventType === 'DELETE') {
          const deletedNoteId = payload.old.id
          setNotes(prevNotes => prevNotes.filter(note => note.id !== deletedNoteId))
          if (selectedNote?.id === deletedNoteId) {
            setSelectedNote(null)
            setTitle('')
            setContent('')
            editor?.commands.setContent('')
          }
        }
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [fetchNotes, supabase, editor, selectedNote])

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

      isLocalUpdateRef.current = true
      if (selectedNote) {
        const { data, error } = await supabase
          .from('notes')
          .update(noteData)
          .match({ id: selectedNote.id })
          .select()

        if (!error && data) {
          setNotes(prevNotes => prevNotes.map(note => 
            note.id === selectedNote.id ? data[0] : note
          ))
          setSelectedNote(data[0])
        }
      } else {
        const { data, error } = await supabase
          .from('notes')
          .insert([noteData])
          .select()

        if (!error && data) {
          setNotes(prevNotes => [data[0], ...prevNotes])
          setSelectedNote(data[0])
        }
      }
      isLocalUpdateRef.current = false
    }, 1000),
    [selectedNote, title, supabase]
  )

  const handleRemove = async (noteId: string) => {
    const { error } = await supabase
      .from('notes')
      .delete()
      .match({ id: noteId })

    if (!error) {
      setNotes(prevNotes => prevNotes.filter(note => note.id !== noteId))
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
              <LayoutList className="h-5 w-5 text-purple-500" />
              <span className="font-semibold text-gray-900 dark:text-white">Notes</span>
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
            className="w-full justify-start gap-2 mb-4 bg-gradient-to-r from-blue-500 to-pink-300 hover:from-blue-600 hover:to-pink-400 text-white border-0"
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
                    selectedNote?.id === note.id ? 'bg-gradient-to-r from-purple-500/10 to-pink-500/10 text-purple-500 dark:text-purple-400' : ''
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
                  <Trash2 className="h-4 w-4 text-red-400" />
                  <span className="sr-only">Delete note</span>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col w-full bg-white dark:bg-zinc-900 text-gray-900 dark:text-white">
        <header className="flex justify-between items-center p-4 bg-gray-50 dark:bg-zinc-800/50 border-b border-gray-200 dark:border-zinc-800">
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
              className="bg-gradient-to-r from-blue-500 to-pink-300 hover:from-blue-600 hover:to-pink-400 text-white border-0"
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
              debouncedAutoSave(content)
            }}
            className="bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700"
          />

          {editor && (
            <div className="flex items-center gap-1 p-1 rounded-md bg-gray-50 dark:bg-zinc-800/50 overflow-x-auto">
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
              <div className="w-px h-6 bg-gray-300 dark:bg-zinc-700" />
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => editor.chain().focus().toggleBold().run()}
                data-active={editor.isActive('bold')}
                className="data-[active=true]:bg-gradient-to-r data-[active=true]:from-purple-500/10 data-[active=true]:to-pink-500/10"
              >
                <span className="font-bold">B</span>
              </Button>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                data-active={editor.isActive('italic')}
                className="data-[active=true]:bg-gradient-to-r data-[active=true]:from-purple-500/10 data-[active=true]:to-pink-500/10"
              >
                <span className="italic">I</span>
              </Button>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                data-active={editor.isActive('codeBlock')}
                className="data-[active=true]:bg-gradient-to-r data-[active=true]:from-purple-500/10 data-[active=true]:to-pink-500/10"
              >
                <span className="font-mono">{'</>'}</span>
              </Button>
              <div className="flex-1" />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsPreview(!isPreview)}
                className={isPreview ? 'bg-gradient-to-r from-purple-500/10 to-pink-500/10' : ''}
              >
                <Eye className="h-4 w-4" />
                <span className="sr-only">Toggle preview</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => debouncedAutoSave(content)}
                className="hover:bg-gradient-to-r hover:from-purple-500/10 hover:to-pink-500/10"
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
                  <Trash2 className="h-4 w-4 text-red-400" />
                  <span className="sr-only">Delete note</span>
                </Button>
              )}
            </div>
          )}

          <div className="flex-1 overflow-auto">
            {isPreview ? (
              <div className="prose dark:prose-invert max-w-none bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-md p-4">
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
              </div>
            ) : (
              <EditorContent 
                editor={editor} 
                className="h-full bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-md p-4"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}