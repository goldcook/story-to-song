import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MANIFEST_PATH = join(ROOT, 'research/references/manifest.json')
const PRIORS_PATH = join(ROOT, 'research/composition-priors.json')
const ANALYSIS_PATH = join(ROOT, 'research/generated/reference-analysis.json')
const RUNTIME_PATH = join(ROOT, 'src/lib/generated/referenceProfiles.ts')
const CACHE_DIR = join(ROOT, 'research/cache')
const SOURCE_CHECK_ONLY = process.argv.includes('--check')
const GENERATED_CHECK_ONLY = process.argv.includes('--generated-check')
const CHECK_ONLY = SOURCE_CHECK_ONLY || GENERATED_CHECK_ONLY
const DOWNLOAD_TIMEOUT_MS = 15_000
const MAX_REFERENCE_BYTES = 8 * 1024 * 1024
const FEATURE_KEYS = [
  'density',
  'syncopation',
  'upwardContour',
  'pitchRange',
  'sustain',
  'harmonicMotion',
  'brightness',
  'tension',
  'closure',
  'dynamicContrast',
]

const clamp = (value, minimum = 0, maximum = 1) => Math.min(maximum, Math.max(minimum, value))
const round = (value) => Number(value.toFixed(4))
const median = (values) => {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`

function fingerprintHash(value) {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function durationInBeats(source, measureBeats) {
  if (/<(?:acciaccatura|appoggiatura|grace)>/.test(source)) return 0
  const type = source.match(/<durationType>([^<]+)<\/durationType>/)?.[1]
  const durations = {
    longa: 16,
    breve: 8,
    whole: 4,
    half: 2,
    quarter: 1,
    eighth: 0.5,
    '16th': 0.25,
    '32nd': 0.125,
    '64th': 0.0625,
    '128th': 0.03125,
  }
  let duration = type === 'measure' ? measureBeats : durations[type] ?? 0
  const dots = Number(source.match(/<dots>(\d+)<\/dots>/)?.[1] ?? 0)
  let addition = duration / 2
  for (let index = 0; index < dots; index += 1) {
    duration += addition
    addition /= 2
  }
  return duration
}

function extractStaffEvents(staff) {
  const events = []
  let position = 0
  let measureBeats = 4
  for (const measure of staff.matchAll(/<Measure(?:\s[^>]*)?>([\s\S]*?)<\/Measure>/g)) {
    const source = measure[1]
    const numerator = Number(source.match(/<sigN>(\d+)<\/sigN>/)?.[1])
    const denominator = Number(source.match(/<sigD>(\d+)<\/sigD>/)?.[1])
    if (numerator && denominator) measureBeats = numerator * 4 / denominator
    const voice = source.match(/<voice>([\s\S]*?)<\/voice>/)?.[1] ?? source
    let measurePosition = 0
    for (const event of voice.matchAll(/<(Chord|Rest)>([\s\S]*?)<\/\1>/g)) {
      const duration = durationInBeats(event[2], measureBeats)
      if (event[1] === 'Chord' && duration > 0) {
        const pitches = [...event[2].matchAll(/<pitch>(\d+)<\/pitch>/g)].map((match) => Number(match[1]))
        if (pitches.length) events.push({ start: position + measurePosition, duration, pitch: Math.max(...pitches) })
      }
      measurePosition += duration
    }
    position += Math.max(measureBeats, measurePosition)
  }
  const lastEvent = events.at(-1)
  return { events, totalBeats: Math.max(position, lastEvent ? lastEvent.start + lastEvent.duration : 0) }
}

function extractVocalEvents(score) {
  const vocalStaffIds = [...score.matchAll(/<Part>([\s\S]*?)<\/Part>/g)]
    .filter((match) => /<instrumentId>voice\.vocals<\/instrumentId>/.test(match[1]))
    .flatMap((match) => [...match[1].matchAll(/<Staff id="(\d+)"/g)].map((staff) => staff[1]))
  if (!vocalStaffIds.length) throw new Error('Unable to identify a vocal part')

  const candidates = [...new Set(vocalStaffIds)].flatMap((staffId) => (
    [...score.matchAll(new RegExp(`<Staff id="${staffId}">([\\s\\S]*?)<\\/Staff>`, 'g'))]
      .map((match) => match[1])
      .filter((staff) => staff.includes('<Measure'))
      .map(extractStaffEvents)
  ))
  const selected = candidates.sort((a, b) => b.events.length - a.events.length)[0]
  if (!selected || selected.events.length < 8) {
    throw new Error(`Not enough vocal notes: ${selected?.events.length ?? 0}`)
  }
  return selected
}

function extractHarmony(analysis) {
  const lines = analysis.split(/\r?\n/)
  const chords = []
  const measures = new Set()
  let major = true
  let foundKey = false
  for (const line of lines) {
    const match = line.match(/^m(\d+)(?:\.\d+)?\s+(.+)$/)
    if (!match) continue
    measures.add(Number(match[1]))
    const tokens = match[2].trim().split(/\s+/)
    for (const token of tokens) {
      if (/^[A-Ga-g](?:b|#)*:$/.test(token)) {
        if (!foundKey) {
          major = /^[A-G]/.test(token)
          foundKey = true
        }
      } else if (/^b\d+(?:\.\d+)?$/.test(token) || token === '||') {
        continue
      } else if (/^[#b]?[ivIV]+/.test(token) || /^(Ger|Fr|It|N)/.test(token)) {
        chords.push(token)
      }
    }
  }
  if (!chords.length || !measures.size) throw new Error('Unable to parse harmonic analysis')
  return { chords, measureCount: measures.size, major }
}

function getDynamicContrast(score) {
  const levels = { ppp: 0, pp: 1, p: 2, mp: 3, mf: 4, f: 5, ff: 6, fff: 7 }
  const values = [...score.matchAll(/<Dynamic>[\s\S]*?<subtype>([^<]+)<\/subtype>[\s\S]*?<\/Dynamic>/g)]
    .map((match) => levels[match[1]])
    .filter(Number.isFinite)
  if (values.length < 2) return 0.18
  return clamp((Math.max(...values) - Math.min(...values)) / 6)
}

function melodicFingerprint(events, start) {
  const window = events.slice(start, start + 3)
  if (window.length < 3) return null
  const intervals = window.slice(1).map((note, index) => clamp(note.pitch - window[index].pitch, -12, 12))
  const gaps = window.slice(1).map((note, index) => Math.max(1, Math.min(16, Math.round((note.start - window[index].start) * 4))))
  const durations = window.map((note) => Math.max(1, Math.min(16, Math.round(note.duration * 4))))
  return fingerprintHash(`${intervals.join(',')}|${gaps.join(',')}|${durations.join(',')}`)
}

function shapeBucket(value) {
  const magnitude = Math.abs(value)
  if (magnitude === 0) return 'same'
  if (magnitude <= 2) return value > 0 ? 'up-step' : 'down-step'
  if (magnitude <= 5) return value > 0 ? 'up-mid' : 'down-mid'
  return value > 0 ? 'up-leap' : 'down-leap'
}

function rhythmBucket(value) {
  if (value <= 2) return 'short'
  if (value <= 4) return 'medium'
  return 'long'
}

function melodicShapeFingerprint(events, start) {
  const window = events.slice(start, start + 3)
  if (window.length < 3) return null
  const intervals = window.slice(1).map((note, index) => shapeBucket(note.pitch - window[index].pitch))
  const gaps = window.slice(1).map((note, index) => rhythmBucket(Math.round((note.start - window[index].start) * 4)))
  const durations = window.map((note) => rhythmBucket(Math.round(note.duration * 4)))
  return fingerprintHash(`shape|${intervals.join(',')}|${gaps.join(',')}|${durations.join(',')}`)
}

function analyzeScore(score, harmonicAnalysis) {
  const { events, totalBeats } = extractVocalEvents(score)
  const { chords, measureCount, major } = extractHarmony(harmonicAnalysis)
  const pitches = events.map((event) => event.pitch)
  const intervals = pitches.slice(1).map((pitch, index) => pitch - pitches[index])
  const offBeatWeights = events.map((event) => {
    const fraction = ((event.start % 1) + 1) % 1
    if (Math.min(fraction, 1 - fraction) < 0.08) return 0
    if (Math.abs(fraction - 0.5) < 0.08) return 0.62
    return 1
  })
  const tenseChords = chords.filter((chord) => /[oø+]|Ger|Fr|It|N|\/|^[#b]/.test(chord)).length
  const finalChord = chords.at(-1).replace(/^[#b]+/, '')
  const penultimateChord = chords.at(-2)?.replace(/^[#b]+/, '') ?? ''
  const tonicEnding = /^[iI](?:\d|$|[+oø])/.test(finalChord) && !/^[iI]{2}/.test(finalChord)
  const dominantEnding = /^V(?:\d|$|[+oø])/.test(finalChord)
  const dominantToTonic = /^V/.test(penultimateChord) && tonicEnding
  const fingerprints = events.slice(0, -2).map((_, index) => melodicFingerprint(events, index)).filter(Boolean)
  const shapeFingerprints = events.slice(0, -2).map((_, index) => melodicShapeFingerprint(events, index)).filter(Boolean)
  const tempoValues = [...score.matchAll(/<tempo>([\d.]+)<\/tempo>/g)].map((match) => Number(match[1]) * 60)
  const vector = {
    density: clamp(events.length / totalBeats / 1.6),
    syncopation: average(offBeatWeights),
    upwardContour: clamp(0.5 + average(intervals) / 8),
    pitchRange: clamp((Math.max(...pitches) - Math.min(...pitches)) / 24),
    sustain: clamp(average(events.map((event) => event.duration)) / 1.5),
    harmonicMotion: clamp((chords.length / measureCount - 0.65) / 2.35),
    brightness: clamp((median(pitches) - 48) / 34 * 0.82 + (major ? 0.18 : 0.04)),
    tension: clamp(tenseChords / chords.length * 1.45 + (major ? 0 : 0.1)),
    closure: dominantToTonic ? 1 : tonicEnding ? 0.9 : dominantEnding ? 0.28 : 0.5,
    dynamicContrast: getDynamicContrast(score),
  }
  return {
    noteCount: events.length,
    measureCount,
    tempoBpm: tempoValues.length ? round(median(tempoValues)) : null,
    mode: major ? 'major' : 'minor',
    features: Object.fromEntries(Object.entries(vector).map(([key, value]) => [key, round(value)])),
    fingerprints: [...new Set(fingerprints)],
    shapeFingerprints: [...new Set(shapeFingerprints)],
  }
}

function average(values) {
  return values.reduce((total, value) => total + value, 0) / Math.max(1, values.length)
}

async function loadPinnedResource(corpus, path, expectedHash, cacheName) {
  mkdirSync(CACHE_DIR, { recursive: true })
  const cachePath = join(CACHE_DIR, `${cacheName}-${basename(path)}`)
  if (existsSync(cachePath)) {
    const cached = readFileSync(cachePath)
    if (sha256(cached) === expectedHash) return cached.toString('utf8')
    rmSync(cachePath)
  }

  const url = `${corpus.sourceBaseUrl}${path.split('/').map(encodeURIComponent).join('/')}`
  const response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) })
  if (!response.ok) throw new Error(`Unable to download ${url}: ${response.status}`)
  const declaredSize = Number(response.headers.get('content-length') ?? 0)
  if (declaredSize > MAX_REFERENCE_BYTES) throw new Error(`Reference exceeds size limit: ${url}`)
  if (!response.body) throw new Error(`Reference response has no body: ${url}`)
  const chunks = []
  let receivedBytes = 0
  const reader = response.body.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    receivedBytes += value.byteLength
    if (receivedBytes > MAX_REFERENCE_BYTES) {
      await reader.cancel()
      throw new Error(`Reference exceeds size limit: ${url}`)
    }
    chunks.push(Buffer.from(value))
  }
  const data = Buffer.concat(chunks)
  const actualHash = sha256(data)
  if (actualHash !== expectedHash) {
    throw new Error(`${cacheName} checksum mismatch: expected ${expectedHash}, received ${actualHash}`)
  }
  const temporaryPath = `${cachePath}.${process.pid}.tmp`
  try {
    writeFileSync(temporaryPath, data)
    renameSync(temporaryPath, cachePath)
  } finally {
    rmSync(temporaryPath, { force: true })
  }
  return data.toString('utf8')
}

function loadPinnedFile(corpus, work, kind) {
  const path = kind === 'score' ? work.scorePath : work.analysisPath
  const expectedHash = kind === 'score' ? work.scoreSha256 : work.analysisSha256
  return loadPinnedResource(corpus, path, expectedHash, `${work.scoreId}-${kind}`)
}

function renderRuntimeModule(analysis) {
  const metadata = {
    corpus: analysis.corpus.name,
    release: analysis.corpus.release,
    commit: analysis.corpus.commit,
    license: analysis.corpus.license,
    licenseSha256: analysis.corpus.licenseSha256,
    workCount: analysis.works.length,
    manifestSha256: analysis.manifestSha256,
    priorsSha256: analysis.priorsSha256,
  }
  return `// Generated by scripts/analyze-reference-scores.mjs. Do not edit by hand.\n`
    + `export const REFERENCE_CORPUS_METADATA = ${JSON.stringify(metadata, null, 2)}\n\n`
    + `export const REFERENCE_TASTE_PROFILES = ${JSON.stringify(analysis.profiles, null, 2)}\n\n`
    + `export const REFERENCE_NGRAM_HASHES = ${JSON.stringify(analysis.referenceNgramHashes, null, 2)}\n\n`
    + `export const REFERENCE_SHAPE_FAMILIARITY = ${JSON.stringify(analysis.referenceShapeFamiliarity, null, 2)}\n`
}

function writeOrCheck(path, content) {
  if (CHECK_ONLY) {
    if (!existsSync(path) || readFileSync(path, 'utf8') !== content) {
      throw new Error(`Generated file is stale: ${path}`)
    }
    return
  }
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

const manifestText = readFileSync(MANIFEST_PATH, 'utf8')
const manifest = JSON.parse(manifestText)
const priorsText = readFileSync(PRIORS_PATH, 'utf8')
const priors = JSON.parse(priorsText)

if (GENERATED_CHECK_ONLY) {
  if (!existsSync(ANALYSIS_PATH)) throw new Error(`Generated file is missing: ${ANALYSIS_PATH}`)
  const existingAnalysis = JSON.parse(readFileSync(ANALYSIS_PATH, 'utf8'))
  if (existingAnalysis.manifestSha256 !== sha256(manifestText)) throw new Error('Generated analysis has a stale manifest hash')
  if (existingAnalysis.priorsSha256 !== sha256(priorsText)) throw new Error('Generated analysis has stale composition priors')
  if (existingAnalysis.referenceBlend !== priors.referenceBlend) throw new Error('Generated analysis has a stale reference blend')
  if (existingAnalysis.corpus.commit !== manifest.corpus.commit
      || existingAnalysis.corpus.licenseSha256 !== manifest.corpus.licenseSha256) {
    throw new Error('Generated analysis has stale corpus provenance')
  }
  if (existingAnalysis.works.length !== manifest.works.length) throw new Error('Generated analysis has a stale work count')
  manifest.works.forEach((work) => {
    const generatedWork = existingAnalysis.works.find((candidate) => candidate.scoreId === work.scoreId)
    if (!generatedWork
        || generatedWork.scoreSha256 !== work.scoreSha256
        || generatedWork.analysisSha256 !== work.analysisSha256) {
      throw new Error(`Generated analysis has stale provenance for ${work.scoreId}`)
    }
  })
  writeOrCheck(RUNTIME_PATH, renderRuntimeModule(existingAnalysis))
  console.log(`Verified committed research artifacts for ${existingAnalysis.works.length} references`)
  process.exit(0)
}

await loadPinnedResource(
  manifest.corpus,
  manifest.corpus.licensePath,
  manifest.corpus.licenseSha256,
  'corpus-license',
)
const works = []
const fingerprintFrequency = new Map()
const shapeFrequency = new Map()

for (const work of manifest.works) {
  if (work.composerDied > manifest.selectionPolicy.composerDeathCutoff) {
    throw new Error(`${work.composer} does not meet the public-domain cutoff`)
  }
  const score = await loadPinnedFile(manifest.corpus, work, 'score')
  const harmonicAnalysis = await loadPinnedFile(manifest.corpus, work, 'analysis')
  const result = analyzeScore(score, harmonicAnalysis)
  result.fingerprints.forEach((hash) => fingerprintFrequency.set(hash, (fingerprintFrequency.get(hash) ?? 0) + 1))
  result.shapeFingerprints.forEach((hash) => shapeFrequency.set(hash, (shapeFrequency.get(hash) ?? 0) + 1))
  works.push({
    emotion: work.emotion,
    scoreId: work.scoreId,
    title: work.title,
    composer: work.composer,
    scoreSha256: work.scoreSha256,
    analysisSha256: work.analysisSha256,
    noteCount: result.noteCount,
    measureCount: result.measureCount,
    tempoBpm: result.tempoBpm,
    mode: result.mode,
    features: result.features,
    fingerprintCount: result.fingerprints.length,
    shapeFingerprintCount: result.shapeFingerprints.length,
  })
}

const observedProfiles = {}
for (const mood of Object.keys(priors.profiles)) {
  const moodWorks = works.filter((work) => work.emotion === mood)
  if (moodWorks.length !== manifest.selectionPolicy.worksPerEmotion) {
    throw new Error(`${mood} requires exactly ${manifest.selectionPolicy.worksPerEmotion} references`)
  }
  observedProfiles[mood] = Object.fromEntries(FEATURE_KEYS.map((key) => [
    key,
    round(median(moodWorks.map((work) => work.features[key]))),
  ]))
}

const calibrationRanges = Object.fromEntries(FEATURE_KEYS.map((key) => {
  const observedValues = Object.values(observedProfiles).map((profile) => profile[key])
  const authoredValues = Object.values(priors.profiles).map((profile) => profile[key])
  return [key, {
    observedMinimum: Math.min(...observedValues),
    observedMaximum: Math.max(...observedValues),
    authoredMinimum: Math.min(...authoredValues),
    authoredMaximum: Math.max(...authoredValues),
  }]
}))

const profiles = {}
for (const mood of Object.keys(priors.profiles)) {
  const moodWorks = works.filter((work) => work.emotion === mood)
  const observed = observedProfiles[mood]
  const calibratedObservation = Object.fromEntries(FEATURE_KEYS.map((key) => {
    const range = calibrationRanges[key]
    const observedSpan = range.observedMaximum - range.observedMinimum
    const authoredSpan = range.authoredMaximum - range.authoredMinimum
    const percentile = observedSpan ? (observed[key] - range.observedMinimum) / observedSpan : 0.5
    return [key, round(range.authoredMinimum + percentile * authoredSpan)]
  }))
  const target = Object.fromEntries(FEATURE_KEYS.map((key) => [
    key,
    round(priors.profiles[mood][key] * (1 - priors.referenceBlend) + calibratedObservation[key] * priors.referenceBlend),
  ]))
  profiles[mood] = {
    referenceCount: moodWorks.length,
    observed,
    calibratedObservation,
    authoredTarget: priors.profiles[mood],
    target,
  }
}

const referenceNgramHashes = [...fingerprintFrequency.entries()]
  .filter(([, count]) => count >= 2)
  .sort(([hashA, countA], [hashB, countB]) => countB - countA || hashA.localeCompare(hashB))
  .slice(0, 384)
  .map(([hash]) => hash)

const referenceShapeFamiliarity = Object.fromEntries(
  [...shapeFrequency.entries()]
    .filter(([, count]) => count >= 2)
    .sort(([hashA, countA], [hashB, countB]) => countB - countA || hashA.localeCompare(hashB))
    .map(([hash, count]) => [hash, round(count / works.length)]),
)

const analysis = {
  schemaVersion: 2,
  generator: 'scripts/analyze-reference-scores.mjs',
  corpus: manifest.corpus,
  manifestSha256: sha256(manifestText),
  priorsSha256: sha256(priorsText),
  referenceBlend: priors.referenceBlend,
  featureKeys: FEATURE_KEYS,
  methodology: {
    melodySource: 'most note-rich staff among parts explicitly marked as voice.vocals; lyric elements are not extracted or used',
    harmonySource: 'OpenScore Lieder automatic Roman-numeral analysis',
    aggregation: 'median of two editorially assigned works per emotion',
    calibration: 'per-feature affine mapping from the seven observed mood profiles into the authored runtime range',
    runtimeTarget: '78% authored composition prior plus 22% calibrated reference direction',
    noveltyData: 'hashed exact and coarse-shape transposition-invariant three-note interval/rhythm fingerprints only',
  },
  works,
  profiles,
  referenceNgramHashes,
  referenceShapeFamiliarity,
}

writeOrCheck(ANALYSIS_PATH, stableJson(analysis))
writeOrCheck(RUNTIME_PATH, renderRuntimeModule(analysis))
console.log(`${SOURCE_CHECK_ONLY ? 'Verified' : 'Generated'} ${works.length} references, ${referenceNgramHashes.length} exact and ${Object.keys(referenceShapeFamiliarity).length} shape hashes, manifest ${analysis.manifestSha256}`)
