# Music taste methodology

This project does not train on, transcribe, retrieve, or copy commercial songs.
Its composition taste layer combines explicit product judgment with normalized
measurements from a pinned, legally reusable score corpus. The process is
reproducible and remains separate from the audio samples used for playback.

## Two distinct source layers

### Playback samples

The piano, guitar, cello, clarinet, frame-drum, shaker, and woodblock files in
`public/audio` are the sound sources used by the browser renderer. Their
licenses and required attribution are recorded in `public/audio/ATTRIBUTION.txt`
and included in full-album exports. They are not training or reference songs.

### Composition references

`references/manifest.json` pins 14 scores from OpenScore Lieder Corpus v3.0.0
at commit `f44e962a1ff85ddcc2f6f42bed3b0c529555ee15` (CC0-1.0,
DOI `10.5281/zenodo.15450143`). Two works are editorially assigned to each of
the seven product emotions. The manifest records exact paths, checksums,
composer death dates, and the selection rationale.

Lyrics embedded in source files are not extracted, used as features, emitted,
or shipped. The analyzer uses only the most note-rich staff among parts
explicitly marked `voice.vocals` plus the corpus's automatic Roman-numeral
harmony analysis. Composer death dates are also checked against the manifest's
conservative cutoff before any output is produced.

### Released-song listening study

`real-song-listening-study.json` records a separate, human-authored qualitative
review of ten released songs. It is used to challenge simplistic assumptions
such as "major means happy" or "sad stories must be slow" and to study broad
relationships between narrative direction, pulse, articulation, arrangement,
dynamic growth, and closure.

This file stores titles, factual metadata, paraphrased story summaries, broad
arrangement observations, generalized lessons, and public source links only.
It contains no lyric text, audio, scores, chord transcriptions, or reusable
melodic sequences, and it is never imported by the runtime. Its distilled
principles are implemented as authored interaction rules, not as templates for
imitating any named song.

## Measured observations

Run `npm run research:music` to download the pinned files into the ignored
`research/cache` directory, verify every SHA-256 checksum, and regenerate:

- `research/generated/reference-analysis.json`, the auditable aggregate report.
- `src/lib/generated/referenceProfiles.ts`, the bounded runtime data.

The analyzer measures normalized density, syncopation, melodic contour, pitch
range, sustain, harmonic motion, brightness, tension, closure, and dynamic
contrast. It aggregates the median of two references per emotion. These values
are descriptive observations, not claims of universal emotional meaning.

## Authored judgment and runtime behavior

`composition-priors.json` contains authored product targets and a declared
reference blend of 22%. Because score measurements and renderer parameters are
not identical units, each observed feature is first mapped from its seven-mood
reference range into the corresponding authored runtime range. Runtime targets
are then 78% authored judgment and 22% calibrated reference direction. This
limited blend avoids treating unlike measurements as equal and prevents a
small historical corpus from erasing product intent.

For each story, multi-dimensional semantic analysis adjusts the target. The
runtime scores combinations of original motif grammars, progressions,
arrangements, cadences, development styles, and texture shapes. It rejects
invalid timing, extreme range or leaps, repeated pitches, and excessive
reference overlap; it then ranks the remaining candidates by taste fit,
structural quality, and novelty. Interaction terms preserve mixed emotion rather
than averaging it into a generic mood: rising stories earn a wider dynamic arc,
falling stories lose final closure, high-arousal bittersweet stories can retain
pulse while adding tension, and quiet confession becomes sparser and more
sustained.

Only aggregate feature values and opaque hashes of transposition-invariant
three-note interval/rhythm windows found in at least two different reference
works ship in the app. Source scores, lyrics, titles, note sequences, and raw interval sequences are not runtime inputs.
`npm run research:verify` checks committed provenance and runtime synchronization
without network access. `npm run research:check` additionally re-downloads or
uses cached pinned sources and fails if the regenerated output is stale. The
deployment workflow uses the offline check; a separate scheduled/manual
workflow performs the full source-backed verification.

## Validation and limitations

`emotion-prototypes.json` defines canonical, low-arousal, and mixed variants
for each of the seven emotions, with human listening criteria. Automated tests
verify story classification across all 21 cases, the canonical 7-by-7 target
matrix, within-emotion variation, pairwise plan separation, candidate quality,
fingerprint transposition invariance, and generated-data synchronization.

These checks prevent obvious collapse, copying, and structural defects; they do
not prove that a piece is tasteful. Human listening across phones, headphones,
and different cultural backgrounds remains the final acceptance gate. Future
references must have a clearly recorded commercial-use license, exact version,
checksum, transformation method, and a documented reason for inclusion.
