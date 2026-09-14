import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { playSongPreview } from './lib/audioEngine'
import { generateSong, samples } from './lib/storyEngine'
import type { SongResult } from './types'

type View = 'compose' | 'creating' | 'result'
type ResultTab = 'song' | 'lyrics' | 'prompt'

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

function loadHistory() {
  try {
    return (JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') as SongResult[]).slice(0, 8)
  } catch {
    localStorage.removeItem(HISTORY_KEY)
    return []
  }
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

function App() {
  const [story, setStory] = useState('')
  const [view, setView] = useState<View>('compose')
  const [result, setResult] = useState<SongResult | null>(null)
  const [tab, setTab] = useState<ResultTab>('song')
  const [isListening, setIsListening] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [creatingStep, setCreatingStep] = useState(0)
  const [playProgress, setPlayProgress] = useState(0)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [history, setHistory] = useState<SongResult[]>(loadHistory)
  const [historyOpen, setHistoryOpen] = useState(false)
  const audioRef = useRef<ReturnType<typeof playSongPreview> | null>(null)
  const progressTimerRef = useRef<number | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

  useEffect(() => {
    return () => audioRef.current?.stop()
  }, [])

  const createSong = () => {
    if (story.trim().length < 12) return
    setView('creating')
    setCreatingStep(0)
    const next = generateSong(story)
    window.setTimeout(() => setCreatingStep(1), 650)
    window.setTimeout(() => setCreatingStep(2), 1300)
    window.setTimeout(() => setCreatingStep(3), 1950)
    window.setTimeout(() => {
      setResult(next)
      setView('result')
      setTab('song')
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

  const reset = () => {
    stopPlayback()
    setView('compose')
    setResult(null)
  }

  const openHistoryItem = (item: SongResult) => {
    stopPlayback()
    setResult(item)
    setStory(item.story)
    setHistoryOpen(false)
    setView('result')
    setTab('song')
  }

  return (
    <main className={`app-shell ${view === 'result' && result ? `mood-${result.mood.id}` : ''}`}>
      <div className="paper-noise" />
      <header className="topbar">
        {view === 'result' ? (
          <button className="icon-button" onClick={reset} aria-label="返回创作"><Icon name="back" /></button>
        ) : <Logo />}
        {view === 'result' && <Logo />}
        <button className="history-button" onClick={() => setHistoryOpen(true)} aria-label="打开作品历史">
          <Icon name="history" size={19} /><span>作品</span>
        </button>
      </header>

      {view === 'compose' && (
        <section className="compose-view page-enter">
          <div className="intro-copy">
            <span className="eyebrow"><i /> STORY INTO SOUND</span>
            <h1>你的故事，<br /><em>值得被唱出来。</em></h1>
            <p>不必组织语言。说一段回忆、一次心动，或一个还没有结局的故事。</p>
          </div>
          <div className={`story-card ${isListening ? 'is-listening' : ''}`}>
            <div className="story-card-head">
              <span>{isListening ? '正在聆听…' : '讲讲发生了什么'}</span>
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
            <span>不知道从哪说起？</span>
            <div className="sample-row">
              {samples.map((sample) => (
                <button key={sample.label} onClick={() => setStory(sample.story)}>
                  {sample.label}<Icon name="arrow" size={14} />
                </button>
              ))}
            </div>
          </div>
          <button className="create-button" disabled={story.trim().length < 12} onClick={createSong}>
            <Icon name="spark" /><span>把故事变成歌</span><small>约 3 秒</small>
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
            <span className="eyebrow"><i /> COMPOSING</span>
            <h2>正在听懂<br />这个故事</h2>
            <p>每一种情绪，都有自己的速度与和弦。</p>
          </div>
          <div className="creating-steps">
            {['捕捉故事里的情绪', '提炼歌词与核心意象', '设计旋律与乐器'].map((label, index) => (
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
          className="result-view page-enter"
          style={{ '--mood-color': result.mood.color, '--mood-accent': result.mood.accent } as CSSProperties}
        >
          <div className="result-hero">
            <div className="vinyl-wrap">
              <div className={`vinyl ${isPlaying ? 'spinning' : ''}`}>
                <div className="vinyl-groove" />
                <div className="vinyl-label"><span>{result.mood.label}</span><i /></div>
              </div>
              <span className="vinyl-shadow" />
            </div>
            <div className="song-heading">
              <span className="eyebrow">YOUR SONG · {result.mood.tempo} BPM</span>
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
                <span>{isPlaying ? '正在演奏情绪旋律' : '试听浏览器生成的旋律'}</span><small>DEMO</small>
              </div>
              <div className="progress-track"><i style={{ width: `${playProgress}%` }} /></div>
            </div>
            <div className={`equalizer ${isPlaying ? 'active' : ''}`} aria-hidden="true">
              {[1, 2, 3, 4].map((bar) => <i key={bar} />)}
            </div>
          </div>

          <nav className="result-tabs" aria-label="作品内容">
            {([['song', '歌曲'], ['lyrics', '歌词'], ['prompt', '专业 Prompt']] as const).map(([id, label]) => (
              <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>
            ))}
          </nav>

          {tab === 'song' && (
            <div className="tab-panel song-panel">
              <div className="mood-card">
                <div>
                  <span className="section-label">情绪解读</span>
                  <h3>{result.mood.label}<i> + {result.secondaryMood}</i></h3>
                  <p>{result.mood.description}</p>
                </div>
                <div className="mood-orb"><i /><i /><i /></div>
              </div>
              <div className="music-dna">
                <span className="section-label">音乐 DNA</span>
                <div className="dna-grid">
                  <div><small>速度</small><strong>{result.mood.tempo}</strong><span>BPM</span></div>
                  <div><small>调性</small><strong>{result.mood.key.split(' ')[0]}</strong><span>{result.mood.scale === 'minor' ? '小调' : '明亮'}</span></div>
                  <div><small>能量</small><strong>{result.mood.energy}</strong><span>/ 100</span></div>
                </div>
                <div className="instrument-list">
                  {result.mood.instruments.map((instrument) => <span key={instrument}>{instrument}</span>)}
                </div>
              </div>
              <div className="story-echo">
                <span className="section-label">从故事里听见</span>
                <blockquote>“{result.hook}”</blockquote>
                <div>{result.keywords.slice(0, 4).map((keyword) => <span key={keyword}>#{keyword}</span>)}</div>
              </div>
            </div>
          )}

          {tab === 'lyrics' && (
            <div className="tab-panel lyrics-panel">
              <div className="lyrics-title">
                <span className="section-label">完整歌词</span>
                <button onClick={downloadLyrics}><Icon name="download" size={16} />导出</button>
              </div>
              {result.lyrics.map((section) => (
                <div className="lyric-section" key={section.label}>
                  <span>{section.label}</span>
                  <p>{section.lines.map((line, index) => <span key={`${line}-${index}`}>{line}</span>)}</p>
                </div>
              ))}
            </div>
          )}

          {tab === 'prompt' && (
            <div className="tab-panel prompt-panel">
              <div className="prompt-intro">
                <span className="section-label">交给专业音乐 AI</span>
                <h3>编曲说明已经准备好</h3>
                <p>复制后可直接粘贴到 Suno、Udio 或其他音乐生成工具。</p>
              </div>
              <pre>{result.prompt}</pre>
              <button className="copy-button" onClick={copyPrompt}>
                <Icon name={copyState === 'copied' ? 'check' : 'copy'} size={18} />
                {copyState === 'copied' ? '已复制到剪贴板' : copyState === 'failed' ? '复制失败，请手动选择' : '复制完整 Prompt'}
              </button>
            </div>
          )}

          <button className="again-button" onClick={reset}>再讲一个故事 <Icon name="arrow" size={16} /></button>
        </section>
      )}

      {historyOpen && (
        <div className="sheet-backdrop" onClick={() => setHistoryOpen(false)}>
          <aside className="history-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-heading">
              <div><span className="eyebrow">YOUR STORIES</span><h2>作品盒子</h2></div>
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
              <div className="empty-history"><Icon name="history" size={32} /><p>你的第一首歌<br />会出现在这里</p></div>
            )}
          </aside>
        </div>
      )}
    </main>
  )
}

export default App
