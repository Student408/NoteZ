'use client'

import { useState, useEffect, useRef } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LayoutList, PenSquare, LogOut, Menu, RotateCcw, RotateCw, Eye, Save, Trash2, X } from 'lucide-react'

type Note = {
  id: string
  title: string
  content: string
  created_at: string
  user_id: string
}

export default function NoteEditor() {
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isPreview, setIsPreview] = useState(false)
  const router = useRouter()
  const supabase = createClientComponentClient()
  const sidebarRef = useRef<HTMLDivElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
    ],
    content: '',
    onUpdate: ({ editor }) => {
      setContent(editor.getHTML())
    },
  })

  useEffect(() => {
    fetchNotes()
  }, [])

  useEffect(() => {
    if (editor && selectedNote) {
      editor.commands.setContent(selectedNote.content)
    }
  }, [selectedNote, editor])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        setSidebarOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const fetchNotes = async () => {
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
  }

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const noteData = {
      title,
      content,
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
  }

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
      }
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex h-screen bg-[#1A1A1A] text-white">
      {/* Sidebar */}
      <div 
        ref={sidebarRef}
        className={`${
          sidebarOpen ? 'w-64 md:w-72' : 'w-0'
        } transition-all duration-300 overflow-hidden fixed md:relative h-full z-20 bg-[#262626] border-r border-[#404040]`}
      >
        <div className="p-4 h-full flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <LayoutList className="h-5 w-5" />
              <span className="font-semibold">Notes</span>
            </div>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setSidebarOpen(false)}
              className="md:hidden"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 mb-4"
            onClick={() => {
              setSelectedNote(null)
              setTitle('')
              editor?.commands.setContent('')
              setSidebarOpen(false)
            }}
          >
            <PenSquare className="h-4 w-4" />
            New Note
          </Button>
          <div className="flex-1 overflow-y-auto space-y-2">
            {notes.map((note) => (
              <div key={note.id} className="group flex items-center gap-2">
                <Button
                  variant="ghost"
                  className={`flex-1 justify-start truncate ${
                    selectedNote?.id === note.id ? 'bg-[#404040]' : ''
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
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col w-full">
        <header className="flex justify-between items-center p-4 bg-[#262626] border-b border-[#404040]">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-semibold">
              {selectedNote ? 'Edit note' : 'New note'}
            </h1>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </header>

        <div className="p-4 flex-1 flex flex-col gap-4 max-w-4xl mx-auto w-full">
          <Input
            type="text"
            placeholder="Enter your note title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-[#262626] border-[#404040]"
          />

          {editor && (
            <div className="flex items-center gap-1 p-1 rounded-md bg-[#262626] overflow-x-auto">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().undo()}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().redo()}
              >
                <RotateCw className="h-4 w-4" />
              </Button>
              <div className="w-px h-6 bg-[#404040]" />
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => editor.chain().focus().toggleBold().run()}
                data-active={editor.isActive('bold')}
                className="data-[active=true]:bg-[#404040]"
              >
                <span className="font-bold">B</span>
              </Button>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                data-active={editor.isActive('italic')}
                className="data-[active=true]:bg-[#404040]"
              >
                <span className="italic">I</span>
              </Button>
              <div className="flex-1" />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsPreview(!isPreview)}
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSave}
              >
                <Save className="h-4 w-4" />
              </Button>
              {selectedNote && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemove(selectedNote.id)}
                >
                  <Trash2 className="h-4 w-4 text-red-400" />
                </Button>
              )}
            </div>
          )}

          <div className="flex-1 overflow-auto">
            <EditorContent 
              editor={editor} 
              className={`h-full ${
                isPreview ? 'prose prose-invert max-w-none' : ''
              } bg-[#262626] border border-[#404040] rounded-md p-4`}
            />
          </div>
        </div>
      </div>
    </div>
  )
}