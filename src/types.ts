export type MoodId =
  | 'nostalgic'
  | 'joyful'
  | 'melancholy'
  | 'hopeful'
  | 'tense'
  | 'tender'
  | 'calm'

export interface MoodProfile {
  id: MoodId
  label: string
  description: string
  color: string
  accent: string
  tempo: number
  key: string
  scale: 'major' | 'minor' | 'pentatonic'
  energy: number
  warmth: number
  genre: string
  instruments: string[]
}

export interface LyricSection {
  label: string
  lines: string[]
}

export interface ReplyReference {
  title: string
}

export interface SongResult {
  id: string
  createdAt: number
  story: string
  title: string
  mood: MoodProfile
  secondaryMood: string
  theme: string
  keywords: string[]
  excerpt: string
  hook: string
  lyrics: LyricSection[]
  prompt: string
  replyTo?: ReplyReference
}
