import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { getArrangementTracks, getSongPreviewDuration, playSongPreview } from './lib/audioEngine'
import { generateSong, samples } from './lib/storyEngine'
import {
  createShareUrl,
  getAlbumVisual,
  downloadStoryPoster,
  prepareAlbumAssets,
  readSharedStory,
  shareAlbum,
  shareAlbumLink,
  type AlbumAssets,
} from './lib/shareAlbum'
import type { SongResult } from './types'

type View = 'compose' | 'creating' | 'result'
type ResultTab = 'sleeve' | 'sound' | 'notes'

interface SpeechRecognitionEventLike {
  results: ArrayLike<{ 0: { transcript: string } }>
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
const SHARED_STORY = readSharedStory()
const INITIAL_SHARED_RESULT = SHARED_STORY ? generateSong(SHARED_STORY) : null

function loadHistory() {
  try {
    return (JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') as SongResult[]).slice(0, 8)
  } catch {
    localStorage.removeItem(HISTORY_KEY)
    return []
  }
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

function AlbumArtwork({ result, compact = false }: { result: SongResult; compact?: boolean }) {
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
    <div className={`album-artwork ${compact ? 'compact' : ''}`} style={style}>
      <div className="album-mark">叙音 <i /> 01</div>
      <div className="album-orbits">
        {[1, 2, 3, 4, 5].map((ring) => <i key={ring} />)}
        <span />
      </div>
      <div className="album-caption">
        <strong>《{result.title}》</strong>
        <span>{result.mood.label} · {result.mood.tempo} BPM</span>
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
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [creatingStep, setCreatingStep] = useState(0)
  const [playProgress, setPlayProgress] = useState(0)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [history, setHistory] = useState<SongResult[]>(loadHistory)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [linkState, setLinkState] = useState<'idle' | 'sharing' | 'shared' | 'copied' | 'failed'>('idle')
  const [shareAssets, setShareAssets] = useState<AlbumAssets | null>(null)
  const [shareState, setShareState] = useState<'preparing' | 'ready' | 'sharing' | 'shared' | 'downloaded' | 'failed'>('preparing')
  const audioRef = useRef<ReturnType<typeof playSongPreview> | null>(null)
  const progressTimerRef = useRef<number | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const previewDuration = result ? getSongPreviewDuration(result.mood.tempo) : 0
  const arrangementTracks = result ? getArrangementTracks(result) : []
  const draftTracks = draftResult ? getArrangementTracks(draftResult) : []

  useEffect(() => {
    return () => audioRef.current?.stop()
  }, [])

  useEffect(() => {
    document.title = result ? `《${result.title}》 · 叙音私人唱片` : '叙音 · 把一段生活做成私人唱片'
  }, [result])

  useEffect(() => {
    if (!historyOpen && !shareOpen) return
    const previousOverflow = document.body.style.overflow
    const closeSheet = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setHistoryOpen(false)
      setShareOpen(false)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeSheet)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeSheet)
    }
  }, [historyOpen, shareOpen])

  useEffect(() => {
    if (!result) return
    let active = true
    void prepareAlbumAssets(result)
      .then((assets) => {
        if (!active) return
        setShareAssets(assets)
        setShareState('ready')
      })
      .catch(() => {
        if (active) setShareState('failed')
      })
    return () => {
      active = false
    }
  }, [result])

  const createSong = () => {
    if (story.trim().length < 12) return
    setView('creating')
    setCreatingStep(0)
    const next = generateSong(story)
    setDraftResult(next)
    window.setTimeout(() => setCreatingStep(1), 650)
    window.setTimeout(() => setCreatingStep(2), 1300)
    window.setTimeout(() => setCreatingStep(3), 1950)
    window.setTimeout(() => {
      setShareAssets(null)
      setShareState('preparing')
      setSharedView(false)
      setResult(next)
      setDraftResult(null)
      setView('result')
      setTab('sleeve')
      const updated = [next, ...history.filter((item) => item.id !== next.id)].slice(0, 8)
      setHistory(updated)
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
    }, 2400)
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
      const transcript = Array.from(event.results).map((item) => item[0].transcript).join('')
      setStory((current) => `${current}${current ? ' ' : ''}${transcript}`)
    }
    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => setIsListening(false)
    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }

  const stopPlayback = () => {
    audioRef.current?.stop()
    audioRef.current = null
    setIsPlaying(false)
    setPlayProgress(0)
    if (progressTimerRef.current) window.clearInterval(progressTimerRef.current)
  }

  const togglePlay = () => {
    if (!result) return
    if (isPlaying) {
      stopPlayback()
      return
    }
    audioRef.current = playSongPreview(result, () => {
      setIsPlaying(false)
      setPlayProgress(0)
      audioRef.current = null
      if (progressTimerRef.current) window.clearInterval(progressTimerRef.current)
    })
    setIsPlaying(true)
    const duration = audioRef.current.duration * 1000
    let elapsed = 0
    progressTimerRef.current = window.setInterval(() => {
      elapsed += 180
      setPlayProgress(Math.min(100, (elapsed / duration) * 100))
    }, 180)
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
    if (!shareAssets) {
      setShareState('preparing')
      try {
        const assets = await prepareAlbumAssets(result)
        setShareAssets(assets)
        setShareState('ready')
      } catch {
        setShareState('failed')
      }
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
    if (!result || !shareAssets) return
    downloadStoryPoster(result, shareAssets)
  }

  const reset = () => {
    stopPlayback()
    setShareAssets(null)
    setShareState('preparing')
    setView('compose')
    setResult(null)
    setDraftResult(null)
    setSharedView(false)
    setReplyTo(null)
    setShareOpen(false)
    window.history.replaceState({}, '', window.location.pathname)
  }

  const openHistoryItem = (item: SongResult) => {
    stopPlayback()
    setShareAssets(null)
    setShareState('preparing')
    setSharedView(false)
    setResult(item)
    setStory(item.story)
    setHistoryOpen(false)
    setView('result')
    setTab('sleeve')
  }

  const startOwnStory = () => {
    setReplyTo(null)
    setStory('')
    reset()
  }

  const startReply = () => {
    if (!result) return
    const title = result.title
    reset()
    setReplyTo(title)
    setStory(`听完《${title}》，我想起了……`)
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
        ) : (
          <button className="history-button" onClick={() => setHistoryOpen(true)} aria-label="打开作品历史">
            <Icon name="history" size={19} /><span>唱片架</span>
          </button>
        )}
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
              <strong>《{replyTo}》</strong>
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
              onChange={(event) => setStory(event.target.value.slice(0, 1000))}
              placeholder="比如：那年夏天，外婆每天都会在院子里给我讲故事……"
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
          <button className="create-button" disabled={story.trim().length < 12} onClick={createSong}>
            <Icon name="spark" /><span>制作我的私人唱片</span><small>约 19 秒</small>
          </button>
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
            <h2>正在把这段生活<br />压进一张唱片</h2>
            <p>{draftResult ? `${draftResult.theme}，听起来是${draftResult.mood.label}里带一点${draftResult.secondaryMood}。` : '先听懂故事，再为它安排声音。'}</p>
          </div>
          {draftResult && (
            <div className="creating-insight">
              <span>这张唱片记住了</span>
              <div>{draftResult.keywords.slice(0, 3).map((keyword) => <strong key={keyword}>{keyword}</strong>)}</div>
            </div>
          )}
          <div className="creating-steps">
            {[
              draftResult ? `听见 ${draftResult.mood.label}与${draftResult.secondaryMood}` : '听见故事里的情绪',
              draftResult ? `留下 ${draftResult.keywords.slice(0, 2).join('与')}` : '找到值得留下的细节',
              draftResult ? `安排 ${draftTracks.length} 层声音` : '为它安排专属原声',
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
          <div className="result-hero">
            <div className={sharedView ? 'shared-album-stage' : 'album-stage'}>
              {!sharedView && <div className={`album-disc ${isPlaying ? 'spinning' : ''}`}><i /></div>}
              <AlbumArtwork result={result} compact={!sharedView} />
            </div>
            <div className="song-heading">
              <span className="eyebrow">PRIVATE RECORD · {new Date(result.createdAt).getFullYear()}</span>
              <h1>《{result.title}》</h1>
              <p>{result.theme} · {result.mood.genre}</p>
            </div>
          </div>

          <div className="player-card">
            <button className="play-button" onClick={togglePlay} aria-label={isPlaying ? '暂停' : '播放'}>
              <Icon name={isPlaying ? 'pause' : 'play'} size={24} />
            </button>
            <div className="player-main">
              <div className="player-meta">
                <span>{isPlaying ? '这段故事正在播放' : '播放这段故事的私人原声'}</span>
                <small>
                  {isPlaying
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

          <button
            className={`share-album-button state-${shareState}`}
            onClick={() => {
              setLinkState('idle')
              setShareOpen(true)
            }}
          >
            <span className="share-icon"><Icon name={shareState === 'shared' || shareState === 'downloaded' ? 'check' : 'share'} size={18} /></span>
            <span>
              <strong>
                {sharedView ? '把这张私人唱片转发给朋友' : '发行这张私人故事唱片'}
              </strong>
              <small>专属链接 · 4:5 海报 · {Math.round(previewDuration)} 秒纯音乐</small>
            </span>
            <Icon name="arrow" size={16} />
          </button>

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
              <p className="shared-signature">由叙音为一段真实故事制作</p>
            </div>
          ) : (
            <>
              <nav className="result-tabs" aria-label="作品内容">
                {([['sleeve', '唱片内页'], ['sound', '声音设计'], ['notes', '制作手记']] as const).map(([id, label]) => (
                  <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>
                ))}
              </nav>

              {tab === 'sleeve' && (
                <div className="tab-panel sleeve-panel">
                  <article className="liner-note-card">
                    <div className="liner-note-heading">
                      <span className="section-label">LINER NOTES · 唱片内页</span>
                      <small>一段真实生活</small>
                    </div>
                    <h3>{result.theme}</h3>
                    <blockquote>{result.story}</blockquote>
                    <div className="liner-note-tags">
                      <span>{result.mood.label}</span>
                      <span>{result.secondaryMood}</span>
                      {result.keywords.slice(0, 3).map((keyword) => <span key={keyword}>{keyword}</span>)}
                    </div>
                  </article>
                  <div className="story-echo record-echo">
                    <span className="section-label">这张唱片留下的一句话</span>
                    <blockquote>“{result.hook}”</blockquote>
                    <small>有些话没有说出口，也可以被一段旋律记住。</small>
                  </div>
                </div>
              )}

              {tab === 'sound' && (
                <div className="tab-panel sound-panel">
                  <div className="mood-card">
                    <div>
                      <span className="section-label">这张唱片的听感</span>
                      <h3>{result.mood.label}<i> + {result.secondaryMood}</i></h3>
                      <p>{result.mood.description}</p>
                    </div>
                    <div className="mood-orb"><i /><i /><i /></div>
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
                <div className="tab-panel notes-panel">
                  <div className="producer-note">
                    <span className="section-label">PRODUCER'S NOTE · 制作手记</span>
                    <h3>为什么它听起来像<br />{result.mood.description}</h3>
                    <p>故事里的“{result.keywords.slice(0, 3).join('、')}”决定了它的颜色。我们用{result.mood.instruments.join('、')}，把情绪控制在克制而真实的范围里。</p>
                  </div>
                  <div className="music-dna production-data">
                    <span className="section-label">折叠在唱片背面的制作参数</span>
                    <div className="dna-grid">
                      <div><small>速度</small><strong>{result.mood.tempo}</strong><span>BPM</span></div>
                      <div><small>调性</small><strong>{result.mood.key.split(' ')[0]}</strong><span>{result.mood.scale === 'minor' ? '小调' : '明亮'}</span></div>
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

          {!sharedView && <button className="again-button" onClick={startOwnStory}>制作下一张私人唱片 <Icon name="arrow" size={16} /></button>}
        </section>
      )}

      {shareOpen && result && (
        <div className="sheet-backdrop share-backdrop" onClick={() => setShareOpen(false)}>
          <aside className="share-studio" role="dialog" aria-modal="true" aria-label="发行私人唱片" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="share-studio-heading">
              <div>
                <span className="eyebrow">RELEASE YOUR RECORD</span>
                <h2>发行这张私人唱片</h2>
                <p>选择一种最适合你故事的分享方式。</p>
              </div>
              <button onClick={() => setShareOpen(false)}>关闭</button>
            </div>

            <div className="poster-preview">
              <AlbumArtwork result={result} />
              <div className="poster-preview-footer">
                <i />
                <span>{result.theme}</span>
                <small>PRIVATE RECORD · XIYIN</small>
              </div>
            </div>

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
              <button onClick={handleDownloadPoster} disabled={!shareAssets}>
                <span className="release-option-icon"><Icon name="download" /></span>
                <span>
                  <strong>{shareAssets ? '保存 4:5 故事海报' : '正在绘制故事海报…'}</strong>
                  <small>适合朋友圈与小红书发布</small>
                </span>
                <Icon name="arrow" size={16} />
              </button>
              <button onClick={handleShareAlbum} disabled={shareState === 'preparing' || shareState === 'sharing'}>
                <span className="release-option-icon"><Icon name={shareState === 'shared' || shareState === 'downloaded' ? 'check' : 'spark'} /></span>
                <span>
                  <strong>
                    {shareState === 'preparing'
                      ? '正在生成音乐文件…'
                      : shareState === 'sharing'
                        ? '正在打开分享…'
                        : shareState === 'shared'
                          ? '专辑文件已发送'
                          : shareState === 'downloaded'
                            ? '专辑文件已下载'
                            : shareState === 'failed'
                              ? '重新生成分享文件'
                              : '分享封面、海报与音乐'}
                  </strong>
                  <small>包含 PNG 封面和 WAV 纯音乐</small>
                </span>
                <Icon name="arrow" size={16} />
              </button>
            </div>
            <p className="release-note">完整故事只会在你主动分享作品链接时公开。</p>
          </aside>
        </div>
      )}

      {historyOpen && (
        <div className="sheet-backdrop" onClick={() => setHistoryOpen(false)}>
          <aside className="history-sheet" role="dialog" aria-modal="true" aria-label="唱片架" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-heading">
              <div><span className="eyebrow">YOUR PRIVATE RECORDS</span><h2>私人唱片架</h2></div>
              <button onClick={() => setHistoryOpen(false)}>关闭</button>
            </div>
            {history.length ? (
              <div className="history-list">
                {history.map((item) => (
                  <button key={item.id} onClick={() => openHistoryItem(item)}>
                    <i style={{ background: item.mood.color }} />
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
