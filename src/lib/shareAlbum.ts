import { renderSongPreviewWav } from './audioEngine'
import type { SongResult } from '../types'

export interface AlbumVisual {
  seed: number
  rotation: number
  orbitScale: number
}

export interface AlbumAssets {
  cover: Blob
  audio: Blob
}

const assetCache = new Map<string, Promise<AlbumAssets>>()

function hash(value: string) {
  let output = 0
  for (let index = 0; index < value.length; index += 1) {
    output = (output * 31 + value.charCodeAt(index)) >>> 0
  }
  return output
}

export function getAlbumVisual(result: SongResult): AlbumVisual {
  const seed = hash(result.story)
  return {
    seed,
    rotation: (seed % 42) - 21,
    orbitScale: 0.82 + (seed % 18) / 100,
  }
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

  context.save()
  context.translate(710, 355)
  context.rotate(visual.rotation * Math.PI / 180)
  for (let ring = 9; ring >= 0; ring -= 1) {
    const radius = 72 + ring * 37
    context.beginPath()
    context.ellipse(0, 0, radius * visual.orbitScale, radius, 0, 0, Math.PI * 2)
    context.fillStyle = ring % 2 === 0 ? `${result.mood.color}18` : `${result.mood.accent}32`
    context.fill()
  }
  context.beginPath()
  context.arc(0, 0, 92, 0, Math.PI * 2)
  context.fillStyle = result.mood.color
  context.fill()
  context.beginPath()
  context.arc(0, 0, 15, 0, Math.PI * 2)
  context.fillStyle = '#f4eee3'
  context.fill()
  context.restore()

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
  context.fillText('STORY INTO SOUND', 190, 122)

  context.font = '600 74px "Noto Serif SC", "Songti SC", serif'
  const titleLines = wrapText(context, `《${result.title}》`, 760, 2)
  titleLines.forEach((line, index) => context.fillText(line, 90, 625 + index * 94))

  context.fillStyle = result.mood.color
  context.font = '600 28px "DM Sans", "PingFang SC", sans-serif'
  context.fillText(`${result.mood.label} · ${result.mood.tempo} BPM · ${result.mood.genre}`, 94, 815)

  context.fillStyle = 'rgba(41, 40, 35, .68)'
  context.font = '500 30px "Noto Serif SC", "Songti SC", serif'
  const storyLines = wrapText(context, result.story, 870, 2)
  storyLines.forEach((line, index) => context.fillText(line, 94, 884 + index * 49))

  context.fillStyle = 'rgba(41, 40, 35, .45)'
  context.font = '500 23px "DM Sans", sans-serif'
  context.letterSpacing = '2px'
  context.fillText('叙音 XIYIN · INSTRUMENTAL STORY 01', 94, 1010)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Unable to create album cover'))
    }, 'image/png')
  })
}

export function prepareAlbumAssets(result: SongResult): Promise<AlbumAssets> {
  const cached = assetCache.get(result.id)
  if (cached) return cached
  const preparation = Promise.all([
    createAlbumCover(result),
    renderSongPreviewWav(result),
  ]).then(([cover, audio]) => ({ cover, audio }))
  assetCache.set(result.id, preparation)
  void preparation.catch(() => assetCache.delete(result.id))
  return preparation
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

export async function shareAlbum(
  result: SongResult,
  assets: AlbumAssets,
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const name = safeFilename(result.title)
  const files = [
    new File([assets.cover], `${name}-专辑封面.png`, { type: 'image/png' }),
    new File([assets.audio], `${name}-纯音乐.wav`, { type: 'audio/wav' }),
  ]
  const shareData = {
    title: `《${result.title}》· 叙音`,
    text: `${result.theme}。从这个故事里生成了一段 ${Math.round(result.mood.tempo)} BPM 的${result.mood.label}旋律。\n\n${result.story.slice(0, 120)}`,
    files,
  }

  if (navigator.share && navigator.canShare?.({ files })) {
    try {
      await navigator.share(shareData)
      return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
    }
  }

  download(assets.cover, files[0].name)
  download(assets.audio, files[1].name)
  return 'downloaded'
}
