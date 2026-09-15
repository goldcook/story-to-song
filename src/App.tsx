import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { getArrangementTracks, getSongPreviewDuration, playSongPreview, preloadAudioSamples } from './lib/audioEngine'
import { generateSong, getAlternateTitle, samples } from './lib/storyEngine'
import {
  createShareUrl,
  getAlbumVisual,
  downloadStoryPoster,
  prepareAlbumAssets,
  readSharedResult,
  shareAlbum,
  shareAlbumLink,
  type AlbumAssets,
} from './lib/shareAlbum'
import type { ReplyReference, SongResult, StoryEmotionDimensions } from './types'

type View = 'compose' | 'creating' | 'result'
type ResultTab = 'sleeve' | 'sound' | 'notes'
type PlaybackState = 'idle' | 'loading' | 'playing' | 'error'
const RESULT_TABS: Array<[ResultTab, string]> = [['sleeve', '唱片内页'], ['sound', '声音设计'], ['notes', '制作手记']]
const CREATION_STATUS = ['正在理解故事的情绪曲线', '正在写主题动机与回应旋律', '正在调入真实乐器与场景声', '正在完成混音与唱片母带', '私人唱片已经刻好']
const DIMENSION_LABELS: Record<keyof StoryEmotionDimensions, string> = {
  joy: '喜悦',
  grief: '失落',
  tension: '紧张',
  tenderness: '温柔',
  nostalgia: '怀念',
  hope: '希望',
  calm: '平静',
  agency: '行动感',
  openness: '空间感',
  isolation: '孤独感',
}

function getStrongestDimensions(result: SongResult, limit = 5) {
  return (Object.entries(result.analysis.dimensions) as Array<[keyof StoryEmotionDimensions, number]>)
    .filter(([, value]) => value >= 0.12)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
}

interface SpeechRecognitionEventLike {
  resultIndex: number
  results: ArrayLike<{ 0: { transcript: string }; isFinal?: boolean }>
}

interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
}

const HISTORY_KEY = 'story-to-song-history'
const MAX_STORY_LENGTH = 1000
const MIN_STORY_LENGTH = 12
const MOOD_IDS = ['nostalgic', 'joyful', 'melancholy', 'hopeful', 'tense', 'tender', 'calm'] as const
const INITIAL_SHARED_RESULT = readSharedResult()

function restoreHistoryItem(value: unknown): SongResult | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Partial<SongResult>
  if (typeof item.id !== 'string'
    || typeof item.createdAt !== 'number'
    || !Number.isFinite(item.createdAt)
    || typeof item.story !== 'string'
    || !item.story.trim()
    || typeof item.title !== 'string') return null
  const moodId = item.mood && MOOD_IDS.includes(item.mood.id as typeof MOOD_IDS[number])
    ? item.mood.id
    : undefined
  const rebuilt = generateSong(item.story.slice(0, MAX_STORY_LENGTH), {
    id: item.id.slice(0, 96),
    createdAt: item.createdAt,
    title: item.title.slice(0, 32),
    moodId: item.analysis ? moodId : undefined,
    replyTo: typeof item.replyTo?.title === 'string' ? { title: item.replyTo.title.slice(0, 32) } : undefined,
  })
  return rebuilt
}

function loadHistory() {
  try {
    const stored = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') as unknown
    return Array.isArray(stored)
      ? stored.map(restoreHistoryItem).filter((item): item is SongResult => Boolean(item)).slice(0, 12)
      : []
  } catch {
    try { localStorage.removeItem(HISTORY_KEY) } catch { /* Storage can be unavailable in private mode. */ }
    return []
  }
}

function saveHistory(items: SongResult[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items))
  } catch {
    // The current record remains usable even when local persistence is unavailable.
  }
}

function appendStory(current: string, addition: string) {
  return `${current}${current && addition ? ' ' : ''}${addition}`.slice(0, MAX_STORY_LENGTH)
}

function formatDuration(seconds: number) {
  const rounded = Math.max(0, Math.round(seconds))
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`
}

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    spark: <path d="M12 2l1.5 5.1L18 9l-4.5 1.9L12 16l-1.5-5.1L6 9l4.5-1.9L12 2Zm6 12 .8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14Z" />,
    mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6" /></>,
    arrow: <path d="m9 18 6-6-6-6" />,
    play: <path d="m9 7 8 5-8 5V7Z" />,
    pause: <><path d="M9 7v10M15 7v10" /></>,
    copy: <><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
    download: <><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14" /></>,
    back: <path d="m15 18-6-6 6-6" />,
    check: <path d="m5 12 4 4L19 6" />,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>,
    share: <><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.2 10.8 7.6-4.5m-7.6 6.9 7.6 4.5" /></>,
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

function Logo() {
  return (
    <div className="logo" aria-label="叙音">
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <path d="M7 26.5c4-13 8.8-17.8 14.4-14.4 5.3 3.1 2.1 12.4 8 14.8" />
        <path d="M8.2 30.5c5.2-5.4 9.2-4.8 12-.8 2.8 4.3 7 4.3 11.5-.3" />
        <circle cx="29.8" cy="10.2" r="2.2" />
      </svg>
      <span>叙音</span>
    </div>
  )
}

function AlbumMotif({ motif }: { motif: ReturnType<typeof getAlbumVisual>['motif'] }) {
  if (motif === 'rain') {
    return <svg className="album-motif" viewBox="0 0 100 100" aria-hidden="true"><path d="M19 3 4 36M41 0 20 46M64 6 42 54M86 2 60 59M101 21 76 69M8 78h83" /></svg>
  }
  if (motif === 'horizon') {
    return <svg className="album-motif" viewBox="0 0 100 100" aria-hidden="true"><circle cx="67" cy="29" r="12" /><path d="M-3 57C18 40 37 72 59 55s38 4 48-5M-3 70c23-13 43 14 66-1s36 4 45 1M-3 83c22-9 42 10 64-1s36 1 46 0" /></svg>
  }
  if (motif === 'constellation') {
    return <svg className="album-motif" viewBox="0 0 100 100" aria-hidden="true"><path d="m9 62 23-39 19 31 22-42 19 41-29 29Z" /><circle cx="9" cy="62" r="2" /><circle cx="32" cy="23" r="3" /><circle cx="51" cy="54" r="2" /><circle cx="73" cy="12" r="4" /><circle cx="92" cy="53" r="2" /><circle cx="63" cy="82" r="3" /></svg>
  }
  if (motif === 'window') {
    return <svg className="album-motif" viewBox="0 0 100 100" aria-hidden="true"><rect x="13" y="8" width="74" height="76" /><path d="M50 8v76M13 47h74" /><rect className="fill" x="17" y="12" width="29" height="31" /></svg>
  }
  if (motif === 'memory') {
    return <svg className="album-motif" viewBox="0 0 100 100" aria-hidden="true"><circle className="wash" cx="50" cy="47" r="39" /><circle cx="42" cy="42" r="21" /><circle className="cutout" cx="65" cy="60" r="13" /></svg>
  }
  return (
    <div className="album-orbits">
      {[1, 2, 3, 4, 5].map((ring) => <i key={ring} />)}
      <span />
    </div>
  )
}

function AlbumArtwork({ result, compact = false, mini = false }: { result: SongResult; compact?: boolean; mini?: boolean }) {
  const visual = getAlbumVisual(result)
  const style = {
    '--album-color': result.mood.color,
    '--album-accent': result.mood.accent,
    '--album-rotation': `${visual.rotation}deg`,
    '--album-scale': visual.orbitScale,
    '--album-x': `${48 + visual.seed % 18}%`,
    '--album-y': `${28 + visual.seed % 14}%`,
  } as CSSProperties

  return (
    <div className={`album-artwork motif-${visual.motif} ${compact ? 'compact' : ''} ${mini ? 'mini' : ''}`} style={style}>
      <div className="album-mark">叙音 <i /> 01</div>
      <AlbumMotif motif={visual.motif} />
      <div className="album-caption">
        <strong>《{result.title}》</strong>
        <span>{result.mood.label} · {result.theme}</span>
      </div>
    </div>
  )
}

function ActualPosterPreview({ result, poster }: { result: SongResult; poster: Blob }) {
  const [posterUrl] = useState(() => URL.createObjectURL(poster))
  useEffect(() => {
    return () => URL.revokeObjectURL(posterUrl)
  }, [posterUrl])

  return <div className="poster-preview actual-poster"><img src={posterUrl} alt={`《${result.title}》故事海报预览`} /></div>
}

function PosterPreview({ result, poster }: { result: SongResult; poster?: Blob }) {
  if (poster) return <ActualPosterPreview result={result} poster={poster} />

  return (
    <div className="poster-preview">
      <AlbumArtwork result={result} />
      <div className="poster-preview-footer">
        <i />
        <span>“{result.excerpt}”</span>
        <small>{new Date(result.createdAt).getFullYear()} · XIYIN</small>
      </div>
    </div>
  )
}

function App() {
  const [story, setStory] = useState('')
  const [view, setView] = useState<View>(INITIAL_SHARED_RESULT ? 'result' : 'compose')
  const [result, setResult] = useState<SongResult | null>(INITIAL_SHARED_RESULT)
  const [draftResult, setDraftResult] = useState<SongResult | null>(null)
  const [sharedView, setSharedView] = useState(Boolean(INITIAL_SHARED_RESULT))
  const [tab, setTab] = useState<ResultTab>('sleeve')
  const [replyTo, setReplyTo] = useState<ReplyReference | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle')
  const [creatingStep, setCreatingStep] = useState(0)
  const [creationProgress, setCreationProgress] = useState(0)
  const [playProgress, setPlayProgress] = useState(0)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [history, setHistory] = useState<SongResult[]>(loadHistory)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [linkState, setLinkState] = useState<'idle' | 'sharing' | 'shared' | 'copied' | 'failed'>('idle')
  const [shareAssets, setShareAssets] = useState<AlbumAssets | null>(null)
  const [shareState, setShareState] = useState<'preparing' | 'ready' | 'partial' | 'sharing' | 'shared' | 'downloaded' | 'failed'>('preparing')
  const [storyExpanded, setStoryExpanded] = useState(false)
  const audioRef = useRef<Awaited<ReturnType<typeof playSongPreview>> | null>(null)
  const progressTimerRef = useRef<number | null>(null)
  const playbackRequestRef = useRef(0)
  const playbackAbortRef = useRef<AbortController | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const creationTimersRef = useRef<number[]>([])
  const creationProgressTimerRef = useRef<number | null>(null)
  const creationRequestRef = useRef(0)
  const sharePreparationRef = useRef(0)
  const dialogTriggerRef = useRef<HTMLElement | null>(null)
  const shareDialogRef = useRef<HTMLElement | null>(null)
  const historyDialogRef = useRef<HTMLElement | null>(null)
  const shareCloseRef = useRef<HTMLButtonElement | null>(null)
  const historyCloseRef = useRef<HTMLButtonElement | null>(null)
  const previewDuration = result ? getSongPreviewDuration(result.mood.tempo) : 0
  const arrangementTracks = result ? getArrangementTracks(result) : []
  const draftTracks = draftResult ? getArrangementTracks(draftResult) : []
  const dimensionSpectrum = result ? getStrongestDimensions(result) : []
  const draftDimensions = draftResult ? getStrongestDimensions(draftResult, 3) : []
  const isPlaying = playbackState === 'playing'
  const isAudioLoading = playbackState === 'loading'

  useEffect(() => {
    return () => {
      creationRequestRef.current += 1
      sharePreparationRef.current += 1
      playbackRequestRef.current += 1
      playbackAbortRef.current?.abort()
      audioRef.current?.stop()
      recognitionRef.current?.stop()
      if (progressTimerRef.current) window.clearInterval(progressTimerRef.current)
      creationTimersRef.current.forEach((timer) => window.clearTimeout(timer))
      if (creationProgressTimerRef.current) window.clearInterval(creationProgressTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (result) void preloadAudioSamples()
  }, [result])

  useEffect(() => {
    document.title = result ? `《${result.title}》 · 叙音私人唱片` : '叙音 · 把一段生活做成私人唱片'
  }, [result])

  useEffect(() => {
    const syncSharedRoute = () => {
      const sharedResult = readSharedResult()
      audioRef.current?.stop()
      audioRef.current = null
      playbackRequestRef.current += 1
      playbackAbortRef.current?.abort()
      playbackAbortRef.current = null
      if (progressTimerRef.current) window.clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
      setPlaybackState('idle')
      setPlayProgress(0)
      setShareOpen(false)
      setHistoryOpen(false)
      setStoryExpanded(false)
      if (sharedResult) {
        setResult(sharedResult)
        setStory(sharedResult.story)
        setSharedView(true)
        setView('result')
        setTab('sleeve')
      } else {
        setResult(null)
        setSharedView(false)
        setView('compose')
      }
    }
    window.addEventListener('hashchange', syncSharedRoute)
    window.addEventListener('popstate', syncSharedRoute)
    return () => {
      window.removeEventListener('hashchange', syncSharedRoute)
      window.removeEventListener('popstate', syncSharedRoute)
    }
  }, [])

  useEffect(() => {
    if (!historyOpen && !shareOpen) return
    const previousOverflow = document.body.style.overflow
    const dialog = shareOpen ? shareDialogRef.current : historyDialogRef.current
    const closeButton = shareOpen ? shareCloseRef.current : historyCloseRef.current
    const background = Array.from(document.querySelectorAll<HTMLElement>('.topbar, .compose-view, .creating-view, .result-view'))
    background.forEach((element) => {
      element.inert = true
      element.setAttribute('aria-hidden', 'true')
    })
    const handleDialogKeys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setHistoryOpen(false)
        setShareOpen(false)
        return
      }
      if (event.key !== 'Tab' || !dialog) return
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])'))
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable.at(-1)!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleDialogKeys)
    window.requestAnimationFrame(() => closeButton?.focus())
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleDialogKeys)
      background.forEach((element) => {
        element.inert = false
        element.removeAttribute('aria-hidden')
      })
      dialogTriggerRef.current?.focus()
    }
  }, [historyOpen, shareOpen])

  const clearCreationTimers = () => {
    creationRequestRef.current += 1
    creationTimersRef.current.forEach((timer) => window.clearTimeout(timer))
    creationTimersRef.current = []
    if (creationProgressTimerRef.current) window.clearInterval(creationProgressTimerRef.current)
    creationProgressTimerRef.current = null
  }

  const createSong = () => {
    if (story.trim().length < MIN_STORY_LENGTH) return
    recognitionRef.current?.stop()
    clearCreationTimers()
    const requestId = ++creationRequestRef.current
    const shareRequestId = ++sharePreparationRef.current
    setView('creating')
    setCreatingStep(0)
    setCreationProgress(3)
    setShareAssets(null)
    setShareState('preparing')
    const next = generateSong(story, { replyTo: replyTo ?? undefined })
    setDraftResult(next)
    const minimumDuration = Math.min(13_000, 8_500 + story.trim().length * 8)
    const hardLimit = 18_000
    const revealDelay = 380
    let minimumElapsed = false
    let assetsSettled = false
    let finished = false

    const revealResult = () => {
      if (requestId !== creationRequestRef.current) return
      setSharedView(false)
      setResult(next)
      setDraftResult(null)
      setView('result')
      setTab('sleeve')
      setStoryExpanded(false)
      setHistory((current) => {
        const updated = [next, ...current.filter((item) => item.id !== next.id)].slice(0, 12)
        saveHistory(updated)
        return updated
      })
      creationTimersRef.current = []
    }

    const finishCreation = () => {
      if (finished || requestId !== creationRequestRef.current) return
      finished = true
      creationTimersRef.current.forEach((timer) => window.clearTimeout(timer))
      creationTimersRef.current = []
      if (creationProgressTimerRef.current) window.clearInterval(creationProgressTimerRef.current)
      creationProgressTimerRef.current = null
      setCreatingStep(4)
      setCreationProgress(100)
      creationTimersRef.current.push(window.setTimeout(revealResult, revealDelay))
    }

    const finishWhenReady = () => {
      if (minimumElapsed && assetsSettled) finishCreation()
    }

    void prepareAlbumAssets(next)
      .then((assets) => {
        if (shareRequestId !== sharePreparationRef.current) return
        setShareAssets(assets)
        setShareState(assets.cover && assets.poster && assets.audio ? 'ready' : 'partial')
      })
      .catch(() => {
        if (shareRequestId === sharePreparationRef.current) setShareState('failed')
      })
      .finally(() => {
        assetsSettled = true
        finishWhenReady()
      })

    const progressTicks = Math.max(1, Math.ceil((minimumDuration - revealDelay) / 120))
    const progressIncrement = 92 / progressTicks
    creationProgressTimerRef.current = window.setInterval(() => {
      setCreationProgress((current) => Math.min(95, current + progressIncrement))
    }, 120)

    creationTimersRef.current = [
      window.setTimeout(() => {
        setCreatingStep(1)
        setCreationProgress((current) => Math.max(current, 24))
      }, minimumDuration * 0.22),
      window.setTimeout(() => {
        setCreatingStep(2)
        setCreationProgress((current) => Math.max(current, 49))
      }, minimumDuration * 0.46),
      window.setTimeout(() => {
        setCreatingStep(3)
        setCreationProgress((current) => Math.max(current, 74))
      }, minimumDuration * 0.7),
      window.setTimeout(() => {
        minimumElapsed = true
        setCreationProgress((current) => Math.max(current, 96))
        finishWhenReady()
      }, minimumDuration - revealDelay),
      window.setTimeout(finishCreation, hardLimit - revealDelay),
    ]
  }

  const toggleListen = () => {
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Recognition) {
      alert('当前浏览器不支持语音输入，请使用 Chrome 或直接输入文字。')
      return
    }
    const recognition = new Recognition()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'zh-CN'
    recognition.onresult = (event) => {
      let transcript = ''
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const speechResult = event.results[index]
        if (speechResult.isFinal !== false) transcript += speechResult[0].transcript
      }
      if (transcript) setStory((current) => appendStory(current, transcript))
    }
    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => setIsListening(false)
    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }

  const stopPlayback = () => {
    playbackRequestRef.current += 1
    playbackAbortRef.current?.abort()
    playbackAbortRef.current = null
    audioRef.current?.stop()
    audioRef.current = null
    setPlaybackState('idle')
    setPlayProgress(0)
    if (progressTimerRef.current) window.clearInterval(progressTimerRef.current)
    progressTimerRef.current = null
  }

  const togglePlay = async () => {
    if (!result) return
    if (isPlaying || isAudioLoading) {
      stopPlayback()
      return
    }
    const requestId = ++playbackRequestRef.current
    const controller = new AbortController()
    playbackAbortRef.current = controller
    setPlaybackState('loading')
    setPlayProgress(0)
    try {
      const handle = await playSongPreview(result, () => {
        if (requestId !== playbackRequestRef.current) return
        setPlaybackState('idle')
        setPlayProgress(0)
        audioRef.current = null
        playbackAbortRef.current = null
        if (progressTimerRef.current) window.clearInterval(progressTimerRef.current)
        progressTimerRef.current = null
      }, controller.signal)
      if (requestId !== playbackRequestRef.current) {
        handle.stop()
        return
      }
      audioRef.current = handle
      playbackAbortRef.current = null
      setPlaybackState('playing')
      const duration = handle.duration * 1000
      let elapsed = 0
      progressTimerRef.current = window.setInterval(() => {
        elapsed += 180
        setPlayProgress(Math.min(100, (elapsed / duration) * 100))
      }, 180)
    } catch (error) {
      if (requestId !== playbackRequestRef.current) return
      playbackAbortRef.current = null
      setPlaybackState(error instanceof DOMException && error.name === 'AbortError' ? 'idle' : 'error')
    }
  }

  const copyPrompt = async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.prompt)
      setCopyState('copied')
    } catch {
      const input = document.createElement('textarea')
      input.value = result.prompt
      input.style.position = 'fixed'
      input.style.opacity = '0'
      document.body.appendChild(input)
      input.select()
      const succeeded = document.execCommand('copy')
      input.remove()
      setCopyState(succeeded ? 'copied' : 'failed')
    }
    window.setTimeout(() => setCopyState('idle'), 1800)
  }

  const downloadLyrics = () => {
    if (!result) return
    const lyrics = result.lyrics.map((section) => `[${section.label}]\n${section.lines.join('\n')}`).join('\n\n')
    const content = `《${result.title}》\n\n${lyrics}\n\n--- 音乐生成 Prompt ---\n${result.prompt}`
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${result.title}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleShareAlbum = async () => {
    if (!result || shareState === 'sharing' || shareState === 'preparing') return
    if (!shareAssets || shareState === 'partial' || shareState === 'failed') {
      prepareShareStudio(result)
      return
    }
    setShareState('sharing')
    try {
      const outcome = await shareAlbum(result, shareAssets)
      if (outcome === 'cancelled') {
        setShareState('ready')
        return
      }
      setShareState(outcome)
      window.setTimeout(() => setShareState('ready'), 2600)
    } catch {
      setShareState('failed')
    }
  }

  const handleShareLink = async () => {
    if (!result || linkState === 'sharing') return
    setLinkState('sharing')
    try {
      const outcome = await shareAlbumLink(result)
      if (outcome === 'cancelled') {
        setLinkState('idle')
        return
      }
      setLinkState(outcome)
      window.setTimeout(() => setLinkState('idle'), 2200)
    } catch {
      setLinkState('failed')
    }
  }

  const handleDownloadPoster = () => {
    if (!result || !shareAssets?.poster) return
    downloadStoryPoster(result, shareAssets)
  }

  const prepareShareStudio = (record: SongResult) => {
    const requestId = ++sharePreparationRef.current
    setShareAssets(null)
    setShareState('preparing')
    void prepareAlbumAssets(record)
      .then((assets) => {
        if (requestId !== sharePreparationRef.current) return
        setShareAssets(assets)
        setShareState(assets.cover && assets.poster && assets.audio ? 'ready' : 'partial')
      })
      .catch(() => {
        if (requestId === sharePreparationRef.current) setShareState('failed')
      })
  }

  const openShareStudio = (event?: ReactMouseEvent<HTMLButtonElement>) => {
    if (!result) return
    dialogTriggerRef.current = event?.currentTarget ?? document.activeElement as HTMLElement | null
    setLinkState('idle')
    setShareOpen(true)
    prepareShareStudio(result)
  }

  const openHistory = (event: ReactMouseEvent<HTMLButtonElement>) => {
    dialogTriggerRef.current = event.currentTarget
    setHistoryOpen(true)
  }

  const rerollTitle = () => {
    if (!result) return
    const nextTitle = getAlternateTitle(result, 1)
    const updated = generateSong(result.story, {
        id: result.id,
        createdAt: result.createdAt,
        title: nextTitle,
        moodId: result.mood.id,
        replyTo: result.replyTo,
    })
    setHistory((items) => {
      const nextItems = items.map((item) => item.id === updated.id ? updated : item)
      saveHistory(nextItems)
      return nextItems
    })
    sharePreparationRef.current += 1
    setShareAssets(null)
    setShareState('preparing')
    setResult(updated)
  }

  const reset = () => {
    clearCreationTimers()
    sharePreparationRef.current += 1
    stopPlayback()
    recognitionRef.current?.stop()
    setShareAssets(null)
    setShareState('preparing')
    setView('compose')
    setResult(null)
    setDraftResult(null)
    setSharedView(false)
    setReplyTo(null)
    setShareOpen(false)
    setHistoryOpen(false)
    setStoryExpanded(false)
    window.history.replaceState({}, '', window.location.pathname)
  }

  const openHistoryItem = (item: SongResult) => {
    clearCreationTimers()
    sharePreparationRef.current += 1
    stopPlayback()
    setShareAssets(null)
    setShareState('preparing')
    setSharedView(false)
    setResult(item)
    setStory(item.story)
    setHistoryOpen(false)
    setView('result')
    setTab('sleeve')
    setStoryExpanded(false)
  }

  const startOwnStory = () => {
    setReplyTo(null)
    setStory('')
    reset()
  }

  const startReply = () => {
    if (!result) return
    const reference = { title: result.title }
    reset()
    setReplyTo(reference)
    setStory('')
  }

  const handleTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, currentTab: ResultTab) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const currentIndex = RESULT_TABS.findIndex(([id]) => id === currentTab)
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? RESULT_TABS.length - 1
        : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + RESULT_TABS.length) % RESULT_TABS.length
    const nextTab = RESULT_TABS[nextIndex][0]
    setTab(nextTab)
    document.getElementById(`record-tab-${nextTab}`)?.focus()
  }

  return (
    <main className={`app-shell ${view === 'result' && result ? `mood-${result.mood.id}` : ''}`}>
      <div className="paper-noise" />
      <header className="topbar">
        {view === 'result' && !sharedView ? (
          <button className="icon-button" onClick={reset} aria-label="返回创作"><Icon name="back" /></button>
        ) : <Logo />}
        {view === 'result' && !sharedView && <Logo />}
        {sharedView ? (
          <span className="shared-edition">SHARED RECORD</span>
        ) : view !== 'creating' ? (
          <button className="history-button" onClick={openHistory} aria-label="打开作品历史">
            <Icon name="history" size={19} /><span>唱片架</span>
          </button>
        ) : <span className="pressing-label">PRESSING 01</span>}
      </header>

      {view === 'compose' && (
        <section className="compose-view page-enter">
          <div className="intro-copy">
            <span className="eyebrow"><i /> A PRIVATE RECORD OF YOUR LIFE</span>
            <h1>把一段生活，<br /><em>做成一张私人唱片。</em></h1>
            <p>写下一次想念、一场告别，或今天突然想起的人。叙音会为它制作封面和一段纯器乐原声。</p>
          </div>
          {replyTo && (
            <div className="reply-context">
              <span>正在回应</span>
              <strong>《{replyTo.title}》</strong>
              <button onClick={() => { setReplyTo(null); setStory('') }}>改写自己的故事</button>
            </div>
          )}
          <div className={`story-card ${isListening ? 'is-listening' : ''}`}>
            <div className="story-card-head">
              <span>{isListening ? '正在聆听…' : replyTo ? '写下这张唱片让你想起的事' : '讲讲你想留下的那一刻'}</span>
              <span className="char-count">{story.length} / 1000</span>
            </div>
            <textarea
              value={story}
              onChange={(event) => setStory(event.target.value.slice(0, MAX_STORY_LENGTH))}
              placeholder={replyTo ? '不用评价原故事，只写它让你想起的那个人、那个瞬间……' : '比如：那年夏天，外婆每天都会在院子里给我讲故事……'}
              aria-label="输入你的故事"
            />
            <div className="story-actions">
              <button className={`mic-button ${isListening ? 'active' : ''}`} onClick={toggleListen}>
                <span className="mic-rings" /><Icon name="mic" size={18} />
                <span>{isListening ? '停止' : '用声音讲'}</span>
              </button>
              <span className="privacy-note">本站不上传故事文本</span>
            </div>
          </div>
          <p className={`story-guidance ${story.trim().length > 0 && story.trim().length < MIN_STORY_LENGTH ? 'needs-more' : ''}`}>
            {story.trim().length > 0 && story.trim().length < MIN_STORY_LENGTH
              ? `再写 ${MIN_STORY_LENGTH - story.trim().length} 个字，就能开始制作`
              : '写到谁、哪个瞬间，以及一个你最记得的细节。'}
          </p>
          <button className="create-button" disabled={story.trim().length < MIN_STORY_LENGTH} onClick={createSong}>
            <Icon name="spark" /><span>制作我的私人唱片</span><small>约 26 秒</small>
          </button>
          <div className="sample-block">
            <span>可以从一个自然的时刻开始</span>
            <div className="sample-row">
              {samples.map((sample) => (
                <button key={sample.label} onClick={() => { setReplyTo(null); setStory(sample.story) }}>
                  {sample.label}<Icon name="arrow" size={14} />
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {view === 'creating' && (
        <section className="creating-view page-enter">
          <div className="sound-orbit">
            <span className="orbit orbit-one" /><span className="orbit orbit-two" /><span className="orbit orbit-three" />
            <div className="orbit-center"><Icon name="spark" size={28} /></div>
          </div>
          <div className="creating-copy">
            <span className="eyebrow"><i /> PRESSING YOUR RECORD</span>
            <h2>正在为这段生活<br />安排一段声音</h2>
            <p>{draftResult ? draftResult.analysis.summary : '从文字里留下画面，再为它组织旋律。'}</p>
          </div>
          {draftResult && (
            <div className="creating-insight">
              <span>这张唱片记住了</span>
              <div>{draftResult.keywords.slice(0, 3).map((keyword) => <strong key={keyword}>{keyword}</strong>)}</div>
            </div>
          )}
          <div
            className="creation-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(creationProgress)}
            aria-label="私人唱片制作进度"
          >
            <div className="creation-progress-meta">
              <span role="status" aria-live="polite" aria-atomic="true">
                {CREATION_STATUS[Math.min(creatingStep, CREATION_STATUS.length - 1)]}
              </span>
              <strong>{Math.round(creationProgress)}%</strong>
            </div>
            <div className="creation-progress-rail"><i style={{ width: `${creationProgress}%` }} /></div>
          </div>
          <div className="creating-steps">
            {[
              draftResult ? `读出 ${draftDimensions.map(([key]) => DIMENSION_LABELS[key]).join('、')}` : '理解这段故事的情绪曲线',
              draftResult ? `把 ${draftResult.keywords.slice(0, 2).join('与')}写进主题` : '写下可以被记住的主题旋律',
              draftResult ? `安排 ${draftTracks.length} 层真实声音` : '调入真实乐器与场景声',
              '混音、收束，并刻下这张唱片',
            ].map((label, index) => (
              <div className={creatingStep > index ? 'complete' : creatingStep === index ? 'active' : ''} key={label}>
                <span>{creatingStep > index ? <Icon name="check" size={14} /> : `0${index + 1}`}</span>
                <p>{label}</p><i />
              </div>
            ))}
          </div>
        </section>
      )}

      {view === 'result' && result && (
        <section
          className={`result-view page-enter ${sharedView ? 'shared-result' : ''}`}
          style={{ '--mood-color': result.mood.color, '--mood-accent': result.mood.accent } as CSSProperties}
        >
          {result.replyTo && (
            <div className="record-reply-line"><span>回应</span>《{result.replyTo.title}》</div>
          )}
          <div className="result-hero">
            <div className={sharedView ? 'shared-album-stage' : 'album-stage'}>
              {!sharedView && <div className={`album-disc ${isPlaying ? 'spinning' : ''}`}><i /></div>}
              <AlbumArtwork result={result} compact={!sharedView} />
            </div>
            {!sharedView && (
              <div className="song-heading">
                <span className="eyebrow">PRIVATE RECORD · {new Date(result.createdAt).getFullYear()}</span>
                <h1>《{result.title}》</h1>
                <p>{result.theme} · {result.mood.genre}</p>
                <button className="retitle-button" onClick={rerollTitle}>换一个唱片名</button>
              </div>
            )}
          </div>

          {sharedView && (
            <div className="shared-record-intro">
              <span>{result.theme} · {new Date(result.createdAt).toLocaleDateString('zh-CN')}</span>
              <blockquote>“{result.excerpt}”</blockquote>
            </div>
          )}

          <div className="player-card" aria-busy={isAudioLoading}>
            <button
              className={`play-button ${isAudioLoading ? 'loading' : ''}`}
              onClick={togglePlay}
              aria-label={isAudioLoading ? '取消准备音频' : isPlaying ? '暂停' : playbackState === 'error' ? '重试播放' : '播放'}
            >
              <Icon name={isPlaying ? 'pause' : isAudioLoading ? 'spark' : 'play'} size={24} />
            </button>
            <div className="player-main">
              <div className="player-meta" aria-live="polite">
                <span>
                  {isAudioLoading
                    ? '正在准备真实乐器…'
                    : playbackState === 'error'
                      ? '声音加载失败，点此重试'
                      : isPlaying
                        ? '这段故事正在播放'
                        : `播放这段故事的 ${Math.round(previewDuration)} 秒私人原声`}
                </span>
                <small>
                  {isAudioLoading
                    ? '首次播放需要片刻'
                    : playbackState === 'error'
                      ? '请检查网络后重试'
                      : isPlaying
                    ? `${formatDuration(previewDuration * playProgress / 100)} / ${formatDuration(previewDuration)}`
                    : `约 ${Math.round(previewDuration)} 秒`}
                </small>
              </div>
              <div className="progress-track"><i style={{ width: `${playProgress}%` }} /></div>
            </div>
            <div className={`equalizer ${isPlaying ? 'active' : ''}`} aria-hidden="true">
              {[1, 2, 3, 4].map((bar) => <i key={bar} />)}
            </div>
          </div>

          {!sharedView && (
            <button className={`share-album-button state-${shareState}`} onClick={openShareStudio}>
              <span className="share-icon"><Icon name={shareState === 'shared' || shareState === 'downloaded' ? 'check' : 'share'} size={18} /></span>
              <span>
                <strong>{result.replyTo ? '把这张回应唱片发回给 TA' : '发行这张私人故事唱片'}</strong>
                <small>专属链接 · 4:5 海报 · {Math.round(previewDuration)} 秒纯音乐</small>
              </span>
              <Icon name="arrow" size={16} />
            </button>
          )}

          {sharedView ? (
            <div className="shared-story-content">
              <div className="shared-story-card">
                <span className="section-label">THE STORY BEHIND THE RECORD</span>
                <blockquote>{result.story}</blockquote>
                <div>
                  <span>{result.theme}</span>
                  <span>{result.mood.label} + {result.secondaryMood}</span>
                </div>
              </div>
              <div className="shared-soundscape">
                <span className="section-label">这张唱片用了这些声音</span>
                <div>
                  {arrangementTracks.map((track) => <span key={track.id}>{track.label}</span>)}
                </div>
              </div>
              <div className="shared-actions">
                <button className="reply-record-button" onClick={startReply}>
                  <span><small>ANSWER WITH A MEMORY</small>写一张回应唱片</span>
                  <Icon name="arrow" size={19} />
                </button>
                <button className="make-yours-button" onClick={startOwnStory}>
                  <span><small>START A NEW RECORD</small>制作我自己的私人唱片</span>
                  <Icon name="arrow" size={19} />
                </button>
              </div>
              <button className="shared-forward-button" onClick={openShareStudio}><Icon name="share" size={16} />转发这张唱片</button>
              <p className="shared-signature">由叙音为一段真实故事制作</p>
            </div>
          ) : (
            <>
              <nav className="result-tabs" aria-label="作品内容" role="tablist">
                {RESULT_TABS.map(([id, label]) => (
                  <button
                    id={`record-tab-${id}`}
                    key={id}
                    className={tab === id ? 'active' : ''}
                    role="tab"
                    aria-selected={tab === id}
                    aria-controls={`record-panel-${id}`}
                    tabIndex={tab === id ? 0 : -1}
                    onClick={() => setTab(id)}
                    onKeyDown={(event) => handleTabKeyDown(event, id)}
                  >{label}</button>
                ))}
              </nav>

              {tab === 'sleeve' && (
                <div className="tab-panel sleeve-panel" id="record-panel-sleeve" role="tabpanel" aria-labelledby="record-tab-sleeve">
                  <article className="liner-note-card">
                    <div className="liner-note-heading">
                      <span className="section-label">LINER NOTES · 唱片内页</span>
                      <small>一段真实生活</small>
                    </div>
                    <h3>{result.theme}</h3>
                    <blockquote id="record-story-text">{storyExpanded || result.story.length <= 180 ? result.story : `${result.story.slice(0, 180)}…`}</blockquote>
                    {result.story.length > 180 && (
                      <button
                        className="story-expand-button"
                        aria-expanded={storyExpanded}
                        aria-controls="record-story-text"
                        onClick={() => setStoryExpanded((expanded) => !expanded)}
                      >
                        {storyExpanded ? '收起故事' : '展开完整故事'}
                      </button>
                    )}
                    <div className="liner-note-tags">
                      <span>{result.mood.label}</span>
                      <span>{result.secondaryMood}</span>
                      {result.keywords.slice(0, 3).map((keyword) => <span key={keyword}>{keyword}</span>)}
                    </div>
                  </article>
                  <div className="story-echo record-echo">
                    <span className="section-label">这张唱片留下的一句话</span>
                    <blockquote>“{result.excerpt}”</blockquote>
                    <small>有些话没有说出口，也可以被一段旋律记住。</small>
                  </div>
                </div>
              )}

              {tab === 'sound' && (
                <div className="tab-panel sound-panel" id="record-panel-sound" role="tabpanel" aria-labelledby="record-tab-sound">
                  <div className="mood-card">
                    <div>
                      <span className="section-label">这张唱片的听感</span>
                      <h3>{result.mood.label}<i> + {result.secondaryMood}</i></h3>
                      <p>{result.mood.description}</p>
                    </div>
                    <div className="mood-orb"><i /><i /><i /></div>
                  </div>
                  <div className="emotion-spectrum-card">
                    <div className="emotion-spectrum-heading">
                      <div><span className="section-label">EMOTIONAL SPECTRUM</span><h3>故事不是一种情绪</h3></div>
                      <small>{dimensionSpectrum.length} 个有效维度</small>
                    </div>
                    <div className="emotion-spectrum-list">
                      {dimensionSpectrum.map(([key, value]) => (
                        <div className="emotion-spectrum-row" key={key}>
                          <span>{DIMENSION_LABELS[key]}</span>
                          <i><b style={{ width: `${Math.round(value * 100)}%` }} /></i>
                          <small>{Math.round(value * 100)}</small>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="arrangement-card">
                    <div className="arrangement-heading">
                      <div><span className="section-label">SOUND DESIGN</span><h3>故事被放进这些声音里</h3></div>
                      <small>{arrangementTracks.length} 层</small>
                    </div>
                    <div className="track-list">
                      {arrangementTracks.map((track, index) => (
                        <div className="track-row" key={track.id}>
                          <span className="track-number">{String(index + 1).padStart(2, '0')}</span>
                          <div><strong>{track.label}</strong><small>{track.role}</small></div>
                          <span className={`track-wave ${isPlaying ? 'active' : ''}`}>
                            {[1, 2, 3, 4, 5, 6].map((bar) => <i key={bar} />)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {tab === 'notes' && (
                <div className="tab-panel notes-panel" id="record-panel-notes" role="tabpanel" aria-labelledby="record-tab-notes">
                  <div className="producer-note">
                    <span className="section-label">PRODUCER'S NOTE · 制作手记</span>
                    <h3>为什么它听起来像<br />{result.mood.description}</h3>
                    <p>{result.analysis.summary} 最终用{result.mood.instruments.join('、')}，把这些情绪放进同一段旋律，而不是只套用一个情绪标签。</p>
                  </div>
                  <div className="music-dna production-data">
                    <span className="section-label">折叠在唱片背面的制作参数</span>
                    <div className="dna-grid">
                      <div><small>速度</small><strong>{result.mood.tempo}</strong><span>BPM</span></div>
                      <div><small>调性</small><strong>{result.mood.key.split(' ')[0]}</strong><span>{result.mood.scale === 'minor' ? '小调' : result.mood.scale === 'major' ? '大调' : '五声音阶'}</span></div>
                      <div><small>能量</small><strong>{result.mood.energy}</strong><span>/ 100</span></div>
                    </div>
                    <div className="instrument-list">
                      {result.mood.instruments.map((instrument) => <span key={instrument}>{instrument}</span>)}
                    </div>
                  </div>
                  <details className="advanced-record-tools">
                    <summary>
                      <span><small>OPTIONAL CREATIVE MATERIAL</small>把它继续发展成完整歌曲</span>
                      <Icon name="arrow" size={17} />
                    </summary>
                    <p>纯器乐唱片已经完成。这里保留歌词草稿和专业制作说明，只在你需要继续创作时使用。</p>
                    <div className="studio-actions">
                      <button onClick={downloadLyrics}><Icon name="download" size={16} />导出创作素材</button>
                      <button onClick={copyPrompt}>
                        <Icon name={copyState === 'copied' ? 'check' : 'copy'} size={16} />
                        {copyState === 'copied' ? '制作说明已复制' : copyState === 'failed' ? '复制失败' : '复制制作说明'}
                      </button>
                    </div>
                    <details className="prompt-disclosure">
                      <summary>查看完整制作说明</summary>
                      <pre>{result.prompt}</pre>
                    </details>
                  </details>
                </div>
              )}
            </>
          )}

          {!sharedView && (
            <button className="again-button" onClick={startOwnStory}>
              {result.keywords[0] ? `再留下一段关于${result.keywords[0]}的记忆` : '制作下一张私人唱片'} <Icon name="arrow" size={16} />
            </button>
          )}
        </section>
      )}

      <a className="credits-link" href={`${import.meta.env.BASE_URL}audio/ATTRIBUTION.txt`} target="_blank" rel="noreferrer">
        声音素材许可
      </a>

      {shareOpen && result && (
        <div className="sheet-backdrop share-backdrop" onClick={() => setShareOpen(false)}>
          <aside ref={shareDialogRef} className="share-studio" role="dialog" aria-modal="true" aria-label="发行私人唱片" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="share-studio-heading">
              <div>
                <span className="eyebrow">RELEASE YOUR RECORD</span>
                <h2>发行这张私人唱片</h2>
                <p>选择一种最适合你故事的分享方式。</p>
              </div>
              <button ref={shareCloseRef} onClick={() => setShareOpen(false)}>关闭</button>
            </div>

            <PosterPreview result={result} poster={shareAssets?.poster} />

            <div className="release-options">
              <button onClick={handleShareLink} disabled={linkState === 'sharing'}>
                <span className="release-option-icon"><Icon name={linkState === 'copied' || linkState === 'shared' ? 'check' : 'share'} /></span>
                <span>
                  <strong>{linkState === 'copied' ? '唱片链接已复制' : linkState === 'shared' ? '已打开系统分享' : linkState === 'failed' ? '链接分享失败' : '发送可播放的唱片链接'}</strong>
                  <small>朋友点开即可听旋律、读故事</small>
                </span>
                <Icon name="arrow" size={16} />
              </button>
              {linkState === 'failed' && (
                <label className="manual-share-link">
                  <span>长按下面的链接手动复制</span>
                  <input
                    readOnly
                    value={createShareUrl(result)}
                    onFocus={(event) => event.currentTarget.select()}
                    onClick={(event) => event.currentTarget.select()}
                    aria-label="作品分享链接"
                  />
                </label>
              )}
              <button onClick={handleDownloadPoster} disabled={!shareAssets?.poster}>
                <span className="release-option-icon"><Icon name="download" /></span>
                <span>
                  <strong>
                    {shareAssets?.poster
                      ? '保存 4:5 故事海报'
                      : shareState === 'ready' || shareState === 'failed'
                        ? '当前浏览器无法生成海报'
                        : '正在绘制故事海报…'}
                  </strong>
                  <small>适合朋友圈与小红书发布</small>
                </span>
                <Icon name="arrow" size={16} />
              </button>
              <button onClick={handleShareAlbum} disabled={shareState === 'preparing' || shareState === 'sharing'}>
                <span className="release-option-icon"><Icon name={shareState === 'shared' || shareState === 'downloaded' ? 'check' : 'spark'} /></span>
                <span>
                  <strong>
                    {shareState === 'preparing'
                      ? `正在准备海报与 ${Math.round(previewDuration)} 秒音乐…`
                      : shareState === 'sharing'
                        ? '正在打开分享…'
                        : shareState === 'shared'
                          ? '专辑文件已发送'
                          : shareState === 'downloaded'
                            ? '专辑文件已下载'
                            : shareState === 'partial'
                              ? '部分文件未生成，点此重试'
                              : shareState === 'failed'
                              ? '重新生成分享文件'
                              : '分享封面、海报与音乐'}
                  </strong>
                  <small>
                    {shareState === 'preparing'
                      ? '首次导出真实乐器音轨可能需要几秒'
                      : shareState === 'partial'
                        ? '成功的文件仍可在上方单独保存'
                        : '包含 PNG 封面和 WAV 纯音乐'}
                  </small>
                </span>
                <Icon name="arrow" size={16} />
              </button>
            </div>
            <p className="release-note">链接内容只保存在网址片段中，不会发送给本站服务器；任何拿到链接的人都能查看。</p>
          </aside>
        </div>
      )}

      {historyOpen && (
        <div className="sheet-backdrop" onClick={() => setHistoryOpen(false)}>
          <aside ref={historyDialogRef} className="history-sheet" role="dialog" aria-modal="true" aria-label="唱片架" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-heading">
              <div><span className="eyebrow">YOUR PRIVATE RECORDS</span><h2>私人唱片架</h2></div>
              <button ref={historyCloseRef} onClick={() => setHistoryOpen(false)}>关闭</button>
            </div>
            {history.length ? (
              <div className="history-list">
                {history.map((item) => (
                  <button key={item.id} onClick={() => openHistoryItem(item)}>
                    <AlbumArtwork result={item} mini />
                    <div>
                      <strong>《{item.title}》</strong>
                      <span>{item.mood.label} · {new Date(item.createdAt).toLocaleDateString('zh-CN')}</span>
                    </div>
                    <Icon name="arrow" size={18} />
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-history"><Icon name="history" size={32} /><p>你的第一张私人唱片<br />会出现在这里</p></div>
            )}
          </aside>
        </div>
      )}
    </main>
  )
}

export default App
