'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'

type Note = {
  id: string
  content: string
  created_at: string
  user_id: string
}

export default function NoteList() {
  const [notes, setNotes] = useState<Note[]>([])
  const [newNote, setNewNote] = useState('')
  const router = useRouter()
  const supabase = createClientComponentClient()

  useEffect(() => {
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

    fetchNotes()

    const channel = supabase
      .channel('realtime notes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, (payload) => {
        console.log('Change received!', payload)
        fetchNotes()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, router])

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newNote.trim() === '') return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.error('User not authenticated')
      return
    }

    const { error } = await supabase
      .from('notes')
      .insert({ content: newNote, user_id: user.id })

    if (error) {
      console.error('Error adding note:', error)
    } else {
      setNewNote('')
    }
  }

  const handleDeleteNote = async (id: string) => {
    const { error } = await supabase
      .from('notes')
      .delete()
      .match({ id })

    if (error) {
      console.error('Error deleting note:', error)
    }
  }

  return (
    <div className="w-full max-w-md">
      <form onSubmit={handleAddNote} className="mb-4">
        <input
          type="text"
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add a new note"
          className="w-full p-2 border rounded"
        />
        <button type="submit" className="mt-2 w-full bg-blue-500 text-white p-2 rounded">
          Add Note
        </button>
      </form>
      <ul>
        {notes.map((note) => (
          <li key={note.id} className="mb-2 p-2 bg-gray-100 rounded flex justify-between">
            <span>{note.content}</span>
            <button
              onClick={() => handleDeleteNote(note.id)}
              className="text-red-500"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}