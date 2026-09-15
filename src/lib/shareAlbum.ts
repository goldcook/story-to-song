import { strToU8, zipSync } from 'fflate'
import { renderSongPreviewWav } from './audioEngine'
import { assessStorySafety, generateSong, hasAffirmedStoryTerm } from './storyEngine'
import type { MoodId, SongResult } from '../types'

export type AlbumMotif = 'memory' | 'rain' | 'horizon' | 'constellation' | 'window' | 'orbit'

export interface AlbumVisual {
  seed: number
  rotation: number
  orbitScale: number
  motif: AlbumMotif
}

export interface AlbumAssets {
  cover?: Blob
  poster?: Blob
  audio?: Blob
}

const assetCache = new Map<string, Promise<AlbumAssets>>()
const MAX_ASSET_CACHE_SIZE = 3

const AUDIO_SAMPLE_ATTRIBUTION = `XIYIN AUDIO SAMPLE ATTRIBUTION

Piano, acoustic guitar, cello, clarinet, and xylophone samples
Source: tonejs-instruments by Nicholaus P. Brosowsky
Repository: https://github.com/nbrosowsky/tonejs-instruments
Source revision: 622c2f1c32c8cfce4158ddc3eb26e518ddef37e5
License: Creative Commons Attribution 3.0
License URL: https://creativecommons.org/licenses/by/3.0/
Changes: redistributed as an unmodified, reduced multisample subset.
Original sources documented by the collection:
- Piano, clarinet, and xylophone: VSCO 2 Community Edition / Versilian Studios
- Acoustic guitar: University of Iowa Musical Instrument Samples
- Cello: Freesound user flcellogrl, recording 12408__flcellogrl__real-cello-notes

Frame drum, kick, shaker, and woodblock samples
Source: Versilian Community Sample Library (VCSL)
Repository: https://github.com/sgossner/VCSL
Source revision: c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e
License: CC0 1.0 Universal
License URL: https://creativecommons.org/publicdomain/zero/1.0/
Changes: redistributed without audio modification.
`

function hash(value: string) {
  let output = 0
  for (let index = 0; index < value.length; index += 1) {
    output = (output * 31 + value.charCodeAt(index)) >>> 0
  }
  return output
}

export function getAlbumVisual(result: SongResult): AlbumVisual {
  const seed = hash(result.story)
  const includes = (...terms: string[]) => hasAffirmedStoryTerm(result.story, terms)
  const motif: AlbumMotif = result.analysis.sensitivity === 'sensitive'
    ? 'orbit'
    : includes('雨', '站台', '车站', '伞')
    ? 'rain'
    : includes('海', '火车', '远方', '出发', '公路')
      ? 'horizon'
      : includes('照片', '礼物', '书信', '日记', '蒲扇')
        ? 'memory'
        : includes('星星', '月亮', '夜空', '夏夜')
          ? 'constellation'
          : includes('城市', '房间', '窗', '家', '院子')
            ? 'window'
            : includes('外婆', '爷爷', '奶奶', '妈妈', '爸爸', '孩子', '朋友', '爱人')
            ? 'memory'
            : 'orbit'
  return {
    seed,
    rotation: (seed % 42) - 21,
    orbitScale: 0.82 + (seed % 18) / 100,
    motif,
  }
}

function drawAlbumMotif(context: CanvasRenderingContext2D, result: SongResult, visual: AlbumVisual) {
  const color = result.mood.color
  const accent = result.mood.accent
  context.save()
  context.translate(710, 355)
  context.rotate(visual.rotation * Math.PI / 180)
  context.lineCap = 'round'

  if (visual.motif === 'rain') {
    context.strokeStyle = `${color}70`
    context.lineWidth = 7
    for (let index = -4; index <= 4; index += 1) {
      const x = index * 63
      const length = 150 + ((visual.seed + index * 19) % 150)
      context.beginPath()
      context.moveTo(x, -250)
      context.lineTo(x - 115, -250 + length)
      context.stroke()
    }
    context.strokeStyle = color
    context.lineWidth = 14
    context.beginPath()
    context.moveTo(-255, 160)
    context.lineTo(245, 160)
    context.stroke()
  } else if (visual.motif === 'horizon') {
    context.strokeStyle = `${color}65`
    context.lineWidth = 8
    for (let wave = 0; wave < 4; wave += 1) {
      context.beginPath()
      context.moveTo(-330, 65 + wave * 48)
      context.bezierCurveTo(-150, -10 + wave * 58, 90, 150 + wave * 34, 330, 50 + wave * 50)
      context.stroke()
    }
    context.beginPath()
    context.arc(95, -92, 82, 0, Math.PI * 2)
    context.fillStyle = color
    context.fill()
  } else if (visual.motif === 'constellation') {
    const points = [[-230, 90], [-125, -105], [5, 45], [145, -145], [245, 30], [80, 185]]
    context.strokeStyle = `${color}62`
    context.lineWidth = 5
    context.beginPath()
    points.forEach(([x, y], index) => index ? context.lineTo(x, y) : context.moveTo(x, y))
    context.stroke()
    points.forEach(([x, y], index) => {
      context.beginPath()
      context.arc(x, y, index % 2 ? 14 : 8, 0, Math.PI * 2)
      context.fillStyle = index === 3 ? color : accent
      context.fill()
    })
  } else if (visual.motif === 'window') {
    context.strokeStyle = color
    context.lineWidth = 11
    context.strokeRect(-235, -225, 470, 450)
    context.beginPath()
    context.moveTo(0, -225)
    context.lineTo(0, 225)
    context.moveTo(-235, 5)
    context.lineTo(235, 5)
    context.stroke()
    context.fillStyle = `${accent}65`
    context.fillRect(-216, -206, 197, 192)
    context.fillStyle = `${color}28`
    context.fillRect(19, 24, 197, 182)
  } else if (visual.motif === 'memory') {
    context.beginPath()
    context.arc(0, 0, 245, 0, Math.PI * 2)
    context.fillStyle = `${accent}75`
    context.fill()
    context.beginPath()
    context.arc(-52, -22, 132, 0, Math.PI * 2)
    context.fillStyle = color
    context.fill()
    context.beginPath()
    context.arc(98, 77, 73, 0, Math.PI * 2)
    context.fillStyle = '#f4eee3'
    context.fill()
  } else {
    for (let ring = 9; ring >= 0; ring -= 1) {
      const radius = 72 + ring * 37
      context.beginPath()
      context.ellipse(0, 0, radius * visual.orbitScale, radius, 0, 0, Math.PI * 2)
      context.fillStyle = ring % 2 === 0 ? `${color}18` : `${accent}32`
      context.fill()
    }
    context.beginPath()
    context.arc(0, 0, 92, 0, Math.PI * 2)
    context.fillStyle = color
    context.fill()
    context.beginPath()
    context.arc(0, 0, 15, 0, Math.PI * 2)
    context.fillStyle = '#f4eee3'
    context.fill()
  }
  context.restore()
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const lines: string[] = []
  let current = ''
  for (const character of text) {
    if (context.measureText(current + character).width > maxWidth && current) {
      lines.push(current)
      current = character
      if (lines.length === maxLines - 1) break
    } else {
      current += character
    }
  }
  if (current && lines.length < maxLines) lines.push(current)
  const consumed = lines.join('').length
  if (consumed < text.length && lines.length) {
    lines[lines.length - 1] = `${lines.at(-1)?.slice(0, -1)}…`
  }
  return lines
}

async function createAlbumCover(result: SongResult) {
  await document.fonts?.ready
  const size = 1080
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is not available')

  const visual = getAlbumVisual(result)
  const background = context.createLinearGradient(0, 0, size, size)
  background.addColorStop(0, '#f4eee3')
  background.addColorStop(0.58, '#e8dfd1')
  background.addColorStop(1, result.mood.accent)
  context.fillStyle = background
  context.fillRect(0, 0, size, size)

  drawAlbumMotif(context, result, visual)

  context.strokeStyle = result.mood.color
  context.lineWidth = 8
  context.lineCap = 'round'
  context.beginPath()
  context.moveTo(90, 112)
  context.lineTo(165, 112)
  context.stroke()

  context.fillStyle = '#292823'
  context.font = '600 28px "DM Sans", sans-serif'
  context.letterSpacing = '5px'
  context.fillText('A PRIVATE RECORD', 190, 122)

  context.font = '600 74px "Noto Serif SC", "Songti SC", serif'
  const titleLines = wrapText(context, `《${result.title}》`, 760, 2)
  titleLines.forEach((line, index) => context.fillText(line, 90, 625 + index * 94))

  context.fillStyle = result.mood.color
  context.font = '600 28px "DM Sans", "PingFang SC", sans-serif'
  context.fillText(`${result.mood.label} · ${result.theme} · PRIVATE RECORD`, 94, 815)

  context.fillStyle = 'rgba(41, 40, 35, .68)'
  context.font = '500 30px "Noto Serif SC", "Songti SC", serif'
  const coverStory = result.analysis.sensitivity === 'sensitive' ? result.excerpt : result.story
  const storyLines = wrapText(context, coverStory, 870, 2)
  storyLines.forEach((line, index) => context.fillText(line, 94, 884 + index * 49))

  context.fillStyle = 'rgba(41, 40, 35, .45)'
  context.font = '500 23px "DM Sans", sans-serif'
  context.letterSpacing = '2px'
  context.fillText('叙音 XIYIN · PRIVATE RECORD 01', 94, 1010)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Unable to create album cover'))
    }, 'image/png')
  })
}

async function drawBlob(context: CanvasRenderingContext2D, blob: Blob, width: number, height: number) {
  if ('createImageBitmap' in window) {
    try {
      const bitmap = await createImageBitmap(blob)
      context.drawImage(bitmap, 0, 0, width, height)
      bitmap.close()
      return
    } catch {
      // Older Safari and embedded webviews can expose createImageBitmap but reject Blob input.
    }
  }
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.decoding = 'async'
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Unable to load album cover'))
      image.src = url
    })
    context.drawImage(image, 0, 0, width, height)
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function createStoryPoster(result: SongResult, cover: Blob) {
  const width = 1080
  const height = 1350
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is not available')
  await drawBlob(context, cover, width, width)

  context.fillStyle = '#292823'
  context.fillRect(0, width, width, height - width)
  context.fillStyle = result.mood.accent
  context.fillRect(88, 1128, 62, 7)
  context.fillStyle = '#f3ede2'
  context.font = '600 27px "Noto Serif SC", "Songti SC", serif'
  const hookLines = wrapText(context, `“${result.excerpt}”`, 780, 2)
  hookLines.forEach((line, index) => context.fillText(line, 88, 1182 + index * 42))
  context.fillStyle = 'rgba(243, 237, 226, .65)'
  context.font = '500 21px "DM Sans", "PingFang SC", sans-serif'
  context.letterSpacing = '2px'
  context.fillText(`${result.theme}  ·  ${new Date(result.createdAt).getFullYear()}`, 88, 1300)
  context.fillStyle = result.mood.accent
  context.font = '600 22px "DM Sans", sans-serif'
  context.fillText('XIYIN / 叙音', 850, 1300)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Unable to create story poster'))
    }, 'image/png')
  })
}

export function prepareAlbumAssets(result: SongResult): Promise<AlbumAssets> {
  const cacheKey = `${result.id}:${result.title}`
  const cached = assetCache.get(cacheKey)
  if (cached) return cached
  const preparation = Promise.allSettled([createAlbumCover(result), renderSongPreviewWav(result)])
    .then(async ([coverResult, audioResult]) => {
      const cover = coverResult.status === 'fulfilled' ? coverResult.value : undefined
      let poster: Blob | undefined
      if (cover) {
        try {
          poster = await createStoryPoster(result, cover)
        } catch {
          poster = undefined
        }
      }
      const audio = audioResult.status === 'fulfilled' ? audioResult.value : undefined
      if (!cover && !poster && !audio) throw new Error('Unable to prepare album assets')
      const assets = { cover, poster, audio }
      if (!cover || !poster || !audio) assetCache.delete(cacheKey)
      return assets
    })
  assetCache.set(cacheKey, preparation)
  while (assetCache.size > MAX_ASSET_CACHE_SIZE) {
    const oldestKey = assetCache.keys().next().value
    if (typeof oldestKey === 'string') assetCache.delete(oldestKey)
  }
  void preparation.catch(() => assetCache.delete(cacheKey))
  return preparation
}

export function createShareUrl(result: SongResult) {
  if (assessStorySafety(result.story) === 'crisis') {
    throw new Error('Crisis stories cannot be shared')
  }
  const payload = JSON.stringify({
    version: 3,
    generator: 3,
    id: result.id,
    createdAt: result.createdAt,
    story: result.story,
    title: result.title,
    moodId: result.mood.id,
    secondaryMood: result.secondaryMood,
    theme: result.theme,
    keywords: result.keywords,
    excerpt: result.excerpt,
    replyTo: result.replyTo,
  })
  const bytes = new TextEncoder().encode(payload)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  const token = btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = ''
  url.hash = `album=${token}`
  return url.toString()
}

interface SharedRecordPayload {
  version?: number
  generator?: number
  id?: string
  createdAt?: number
  story?: string
  title?: string
  moodId?: MoodId
  secondaryMood?: string
  theme?: string
  keywords?: string[]
  excerpt?: string
  replyTo?: { title?: string }
}

export function readSharedResult() {
  const url = new URL(window.location.href)
  const fragment = new URLSearchParams(url.hash.slice(1))
  const token = fragment.get('album') ?? url.searchParams.get('album')
  if (!token) return null
  try {
    const normalized = token.replaceAll('-', '+').replaceAll('_', '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const binary = atob(padded)
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as SharedRecordPayload
    if (typeof payload.story !== 'string' || ![1, 2, 3].includes(payload.version ?? 0)) return null
    const story = payload.story.slice(0, 1000)
    if (assessStorySafety(story) === 'crisis') return null
    if (payload.version === 1) return generateSong(story)
    const generated = generateSong(story, {
      id: typeof payload.id === 'string' ? payload.id : undefined,
      createdAt: typeof payload.createdAt === 'number' ? payload.createdAt : undefined,
      title: typeof payload.title === 'string' ? payload.title.slice(0, 32) : undefined,
      moodId: payload.generator === 3 && typeof payload.moodId === 'string' && ['nostalgic', 'joyful', 'melancholy', 'hopeful', 'tense', 'tender', 'calm'].includes(payload.moodId)
        ? payload.moodId as MoodId
        : undefined,
      replyTo: typeof payload.replyTo?.title === 'string' ? { title: payload.replyTo.title.slice(0, 32) } : undefined,
    })
    return {
      ...generated,
      secondaryMood: payload.version === 3 && typeof payload.secondaryMood === 'string'
        ? payload.secondaryMood.slice(0, 12)
        : generated.secondaryMood,
      theme: generated.analysis.sensitivity === 'sensitive'
        ? generated.theme
        : typeof payload.theme === 'string' ? payload.theme.slice(0, 32) : generated.theme,
      keywords: Array.isArray(payload.keywords)
        ? payload.keywords.filter((item): item is string => typeof item === 'string').slice(0, 5)
        : generated.keywords,
      excerpt: generated.analysis.sensitivity === 'sensitive'
        ? generated.excerpt
        : typeof payload.excerpt === 'string' ? payload.excerpt.slice(0, 60) : generated.excerpt,
    }
  } catch {
    return null
  }
}

function safeFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, '').slice(0, 48) || '叙音作品'
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    return
  } catch {
    const input = document.createElement('textarea')
    input.value = value
    input.style.position = 'fixed'
    input.style.opacity = '0'
    document.body.appendChild(input)
    input.select()
    const copied = document.execCommand('copy')
    input.remove()
    if (!copied) throw new Error('Clipboard is not available')
  }
}

export async function createAlbumArchive(
  result: SongResult,
  assets: AlbumAssets,
): Promise<Blob> {
  const name = safeFilename(result.title)
  const entries: Record<string, Uint8Array> = {}
  const addBlob = async (filename: string, blob?: Blob) => {
    if (blob) entries[filename] = new Uint8Array(await blob.arrayBuffer())
  }
  await Promise.all([
    addBlob(`${name}-专辑封面.png`, assets.cover),
    addBlob(`${name}-故事海报.png`, assets.poster),
    addBlob(`${name}-纯音乐.wav`, assets.audio),
  ])
  entries[`${name}-作品信息.txt`] = strToU8([
    `《${result.title}》`,
    result.theme,
    '',
    result.story,
    '',
    `可播放链接：${createShareUrl(result)}`,
    '',
    '由叙音为这段真实故事制作',
  ].join('\n'))
  entries['声音素材许可.txt'] = strToU8(AUDIO_SAMPLE_ATTRIBUTION)
  const archive = zipSync(entries, { level: 0 })
  const archiveBuffer = archive.buffer.slice(archive.byteOffset, archive.byteOffset + archive.byteLength) as ArrayBuffer
  return new Blob([archiveBuffer], { type: 'application/zip' })
}

export async function exportAlbumBundle(result: SongResult, assets: AlbumAssets): Promise<void> {
  const archive = await createAlbumArchive(result, assets)
  download(archive, `${safeFilename(result.title)}-完整唱片包.zip`)
}

export async function shareAlbumLink(result: SongResult) {
  const url = createShareUrl(result)
  const subject = result.keywords[0] || '这段生活'
  const shareText = result.analysis.sensitivity === 'sensitive'
    ? `我为一段不容易说出口的经历留下一张私人唱片《${result.title}》，想谨慎地分享给你。`
    : result.replyTo
    ? `听完《${result.replyTo.title}》，我把想起的那段生活做成了《${result.title}》。这是一张回应唱片，想发回给你。`
    : `我把关于${subject}的那段生活，做成了《${result.title}》。这是为这段生活留下的一张私人唱片。`
  if (navigator.share) {
    try {
      await navigator.share({
        title: `《${result.title}》· 一张叙音私人唱片`,
        text: shareText,
        url,
      })
      return 'shared' as const
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled' as const
    }
  }
  await copyText(url)
  return 'copied' as const
}

export function exportStoryPoster(result: SongResult, assets: AlbumAssets) {
  if (assets.poster) download(assets.poster, `${safeFilename(result.title)}-故事海报.png`)
}
