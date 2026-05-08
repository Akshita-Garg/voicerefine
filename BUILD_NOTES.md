# VoiceRefine — Build Notes

A living document explaining what has been built, how the pieces connect, and why certain decisions were made. Written for someone comfortable with software and AI but new to frontend development.

---

## Session log

### 2026-05-08

**Model upgrade — `whisper-tiny.en` → `cohere-transcribe-03-2026-ONNX`**

The transcription model was swapped from `onnx-community/whisper-tiny.en` to `onnx-community/cohere-transcribe-03-2026-ONNX`. This is a more significant change than swapping a model ID — the two models have different architectures and different pipeline requirements.

**What Cohere Transcribe is:** A 2B-parameter open-source ASR model from Cohere, built on a Conformer architecture (not a Whisper encoder-decoder). It supports 14 languages. It is larger and higher-quality than whisper-tiny, but the 2B size means it will be slower to download and run on lower-end hardware.

**Pipeline changes required (`transcribe.js`):**

| parameter | whisper-tiny | cohere-transcribe | why |
|---|---|---|---|
| `device` | not passed (library default) | `'webgpu'` explicit | model card example passes it directly; the Conformer uses WebGPU-optimized ops |
| `chunk_length_s` | `30` | removed | Whisper-specific: its encoder has a fixed 30s window. Cohere handles variable-length audio natively |
| `stride_length_s` | `5` | removed | same — only meaningful for chunked Whisper inference |
| `max_new_tokens` | not needed | `1024` | caps output token length; this is what the model card example uses |

**What did NOT change:** `dtype: 'q4'` stays. The 16kHz mono audio preprocessing stays — that is a standard ASR input format, not Whisper-specific. The singleton pattern, the `blobToAudioSamples` function, and the overall pipeline structure are unchanged.

**Prompt tightened: LLM no longer adds preamble**

The LLM was prepending meta-commentary ("Okay, here's the cleaned-up version:") despite the system message already containing "Output only the transformed text. No preamble, no commentary, no meta-text." That instruction was buried mid-message and too abstract — LLMs interpret "no meta-text" inconsistently.

Fix: removed the buried rule and added an explicit, concrete instruction as the very last line of the system message — after all the intent and mode blocks, immediately before the model generates its response:

> "Begin your response with the first word of the transformed text. Do not write any introduction, label, or acknowledgment — no 'Here is the cleaned-up version:', no 'Sure!', nothing before the text itself."

Placing it last matters: LLMs weight recent context more heavily. Putting the output format instruction closest to the generation boundary makes it more reliably followed.

**Refine button disabled during recording and transcription**

Previously the Refine button was only disabled when `isRefining` or when the transcript was empty. A user could click Refine mid-recording, which would run the LLM on a partial or stale transcript.

The recording state lived inside `RecordButton`/`useAudioRecorder` and was not visible to App. Fix: added an `onRecordingChange(isRecording)` callback prop to `RecordButton`. A `useEffect` in RecordButton fires it whenever the recording state changes. App tracks `isRecording` in its own state and gates the Refine button on `isRecording || isTranscribing || isRefining || !rawTranscript.trim()`.

**Recording cap lifted from 90s → 3 minutes**

The 90-second cap was pinned in the brief as a whisper-tiny quality guardrail — that model's quality degrades on long single-pass audio. With Cohere Transcribe (a Conformer with no fixed input window), that rationale is gone. The cap was raised to 180 seconds (3 minutes). The practical output limit is ~1024 tokens ≈ 750–800 words ≈ ~5–6 minutes of speech, so 3 minutes sits well within that. Changed `MAX_SECONDS` in `useAudioRecorder.js` and the hardcoded `01:30` display string in `RecordButton.jsx`.

**Fixed: transcription silently truncates at 30 seconds**

Whisper's encoder was trained on fixed 30-second windows (480,000 samples at 16kHz). Without extra options, the pipeline passes the full audio buffer directly to the encoder — anything past 30 seconds is silently dropped.

Fix: pass `chunk_length_s` and `stride_length_s` to the transcriber call:

```js
const result = await transcriber(audio, {
  chunk_length_s: 30,
  stride_length_s: 5,
})
```

`chunk_length_s: 30` tells the pipeline to split the audio into 30-second windows. `stride_length_s: 5` adds 5 seconds of overlap between adjacent windows so words that fall on a boundary are seen by both chunks — the library picks the higher-confidence result. Without the overlap, a word spanning the 30-second mark would appear in neither chunk.

**Fixed: countdown timer did not reset on second recording**

Root cause: `setCountdown(MAX_SECONDS)` was called at the top of `start()`, *before* `await getUserMedia()`. `setState('recording')` was called after the await. Because there is an `await` between the two calls, React does not batch them into the same render. The sequence was:

1. `setCountdown(90)` — renders with `countdown=90, state='idle'` → display: "Click to record" (timer hidden)
2. `await getUserMedia()` resolves
3. `setState('recording')` — renders with the *previous* countdown value (whatever it was when recording stopped), not 90

Fix: move `setCountdown(MAX_SECONDS)` to immediately before `setState('recording')`, so both state updates are in the same synchronous block after the await and React batches them into one render. The timer display only becomes visible when `isRecording` is true, so it is critical that countdown and recording state flip together.

**Added: append-by-default for multi-take recordings**

Previous behaviour: `handleAudioReady` called `setRawTranscript('')` then set the new text — every new recording wiped the previous transcript.

New behaviour: each new recording's text is appended to whatever is already in the textarea, separated by a blank line:

```js
setRawTranscript(prev => prev ? prev + '\n\n' + text : text)
```

This means the 90-second per-recording limit is no longer a practical session limit — you can record multiple chunks and refine the full accumulated transcript at once. The 90s cap remains (it is a `whisper-tiny` quality guardrail per the brief, to be lifted in v1.5 with a model upgrade).

A **Clear** button was added to the Raw Transcript card header. It only appears when there is text in the textarea and calls `setRawTranscript('')`. Styled muted, turns red on hover to signal it is destructive. No confirmation prompt — the append-by-default design already makes clearing an intentional act.

**`env.allowLocalModels = false` — what this actually does**

In `@huggingface/transformers`, `allowLocalModels` controls whether the library tries to resolve model files from a local file system path. In a browser context there is no file system, so this setting is effectively a no-op — the library would fail to find anything locally regardless. It is more meaningful in Node.js environments where you might have models stored in a folder.

Browser caching is not controlled by this flag. On first load, model weights are fetched from Hugging Face's CDN and stored in the browser's Cache API automatically. Every subsequent load serves from that cache. `allowLocalModels = false` does not affect this.

The line could be removed without changing behaviour. It is defensive boilerplate from examples written to target both browser and Node.

---

## Current status (after Step 5)

We have a working transcription pipeline: you can click the mic, speak, click again, and Whisper running in the browser produces a text transcript that appears in the editable textarea. The transcript panel is live; the refined output panel is still a placeholder.

Step 6 is complete: `src/utils/composePrompt.js` (the pure composition function) is written, explained, and covered by 8 passing unit tests in `src/utils/composePrompt.test.js`. Run `npm test` to verify. The module is not yet wired to the UI — that happens in Step 7 (LLM call).

---

## Directory structure

```
track-5-voicerefine/               ← git repo root (outer folder)
├── voicerefine-claude-code-brief.md   ← the project spec
└── voicerefine/                   ← the actual React app (has its own git repo)
    ├── package.json               ← project manifest: lists all dependencies
    ├── package-lock.json          ← locked exact versions of every package installed
    ├── vite.config.js             ← build tool configuration
    ├── index.html                 ← the single HTML file the browser loads
    ├── public/                    ← static files served as-is (favicon etc.)
    └── src/                       ← all the source code we write
        ├── main.jsx               ← entry point: mounts the React app into index.html
        ├── App.jsx                ← root component: the top-level layout
        ├── index.css              ← global CSS (just imports Tailwind)
        ├── hooks/
        │   └── useAudioRecorder.js    ← all MediaRecorder logic
        ├── components/
        │   └── RecordButton.jsx       ← the record button UI
        ├── services/
        │   └── transcribe.js          ← Whisper pipeline (Step 5)
        └── utils/
            └── composePrompt.js       ← prompt composition module (Step 6)
```

The outer `track-5-voicerefine/` folder holds the brief and will later hold the article draft. The inner `voicerefine/` is the deployable app — it has its own git history and will go to Vercel.

---

## The toolchain

### Vite

Vite is the build tool. It does two things:

1. **Dev mode** (`npm run dev`): starts a local server at `localhost:5173`. Every time you save a file, the browser updates instantly without a full page reload. This is called Hot Module Replacement (HMR).
2. **Production build** (`npm run build`): bundles all your JavaScript, CSS, and assets into optimised files in `dist/` that can be served from any static host (like Vercel).

`vite.config.js` configures it. Right now it just registers two plugins:
- `@vitejs/plugin-react` — lets Vite understand JSX (the HTML-like syntax React uses)
- `@tailwindcss/vite` — integrates Tailwind's CSS processing directly into the build

### React

React is a JavaScript library for building UIs. Its core idea: you describe what the UI *should look like* for a given state, and React figures out the minimum set of DOM changes to make it so. You never manually add or remove elements — you just update state and React re-renders.

The files ending in `.jsx` are React component files. JSX is just JavaScript that lets you write HTML-like syntax (`<button onClick={...}>`) which Vite compiles down to regular function calls.

### Tailwind CSS

Tailwind is a CSS utility library. Instead of writing CSS rules in a separate file, you put small, single-purpose class names directly on your HTML elements. For example:

```jsx
// Without Tailwind (requires a separate .css file):
<div className="card">...</div>

// With Tailwind (styles are right there in the element):
<div className="bg-gray-900 rounded-lg border border-gray-800 p-4">...</div>
```

`bg-gray-900` sets the background colour, `rounded-lg` adds border radius, `p-4` adds padding. Tailwind ships with thousands of these pre-defined classes. At build time it scans your source files and only includes the classes you actually used — so the final CSS is small.

In v4 (which we're using), setup is minimal: one line in `src/index.css` (`@import "tailwindcss"`) and a Vite plugin. No config file needed.

### @huggingface/transformers

This is the package that runs Whisper in the browser. It is the maintained successor to the older `@xenova/transformers` package (same API, same author, renamed after Hugging Face officially adopted the project).

Under the hood it uses **ONNX Runtime Web** — a JavaScript runtime for executing machine learning models in the ONNX format. When a user first loads the app, the package downloads the Whisper model weights from Hugging Face's CDN and caches them in the browser's Cache API. All inference happens locally — no audio is ever sent to any server.

**How Whisper runs in the browser:**

Whisper is a sequence-to-sequence neural network: it takes audio and outputs token IDs that map to text. ONNX Runtime Web executes the network's computation graph entirely in JavaScript, using one of two backends:

- **WASM (WebAssembly):** Runs on the CPU. Slower but universally supported.
- **WebGPU:** Runs on the GPU via the browser's WebGPU API. Much faster, but requires a browser and hardware that support WebGPU.

The library picks the backend automatically. In `@huggingface/transformers@4.2.0`, WebGPU is preferred when available — the `device: 'wasm'` option in the pipeline call is silently ignored in this version.

**Why the model and dtype matter:**

WebGPU uses a different quantization path than WASM. The relevant operator is called **MatMulNBits** — it handles quantized matrix multiplication, which is how the model's weight matrices are efficiently computed.

MatMulNBits requires **per-block scale tensors**: a small scaling factor for every small block of weights. Not all exported model variants include these.

- `q8` quantization (8-bit, the default `'quantized'` dtype): per-tensor scales only. Incompatible with WebGPU's MatMulNBits.
- `q4` quantization (4-bit): exports per-block scales specifically to satisfy WebGPU's operator. Works on both backends.

The original `Xenova/whisper-tiny.en` model on Hugging Face was exported for an older v2 WASM API and lacks the WebGPU-compatible weight format entirely. The `onnx-community/whisper-tiny.en` model is a newer export designed for the current library and supports both backends.

**Final choices in `transcribe.js`:**
- Model: `onnx-community/whisper-tiny.en`
- dtype: `'q4'`

These two are the non-obvious hard-won decisions. The error that surfaces if either is wrong is `TransposeDQWeightsForMatMulNBits Missing required scale` — deep inside ONNX Runtime, with no guidance toward the fix.

---

## File-by-file walkthrough

### `index.html`

The single HTML file the browser downloads. It is almost empty by design — just a `<div id="root"></div>` that acts as the mount point for the React app, and a `<script>` tag that loads `src/main.jsx`. Everything the user sees is injected into that `#root` div by React at runtime.

### `src/main.jsx`

The entry point. It finds the `#root` div and tells React to render the `<App />` component into it. You will almost never need to touch this file.

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

`StrictMode` is a React development helper — it intentionally runs some things twice to surface bugs early. It has no effect in production.

### `src/App.jsx`

The root of our component tree. After Step 5 it owns three pieces of state and drives the full record → transcribe flow:

```
App
├── <header> — title, intent switcher (placeholder), settings button (placeholder)
├── <RecordButton onAudioReady={handleAudioReady} />
├── isTranscribing → "Transcribing..." message (pulsing)
├── transcribeError → red error message
└── two-panel layout
    ├── Raw Transcript panel — editable textarea, value=rawTranscript
    └── Refined Output panel — placeholder (Step 7)
```

**State in App after Step 5:**

| state | type | purpose |
|---|---|---|
| `rawTranscript` | string | Whisper output, also editable by the user before refinement |
| `isTranscribing` | boolean | shows the "Transcribing..." indicator |
| `transcribeError` | boolean | shows an error message if the pipeline throws |

**The `handleAudioReady` callback:**

```js
const handleAudioReady = useCallback(async (blob) => {
  setRawTranscript('')
  setTranscribeError(false)
  setIsTranscribing(true)
  try {
    const text = await transcribe(blob)
    setRawTranscript(text)
  } catch (err) {
    console.error('[App] Transcription failed:', err)
    setTranscribeError(true)
  } finally {
    setIsTranscribing(false)
  }
}, [])
```

`useCallback(fn, [])` memoises the function so its reference is stable across renders. This matters because `handleAudioReady` is passed as a prop to `RecordButton`, which has a `useEffect` that depends on it. If `handleAudioReady` got a new reference on every render, that `useEffect` would re-fire every time App re-rendered — even without a new blob.

**The preload call:**

```js
useEffect(() => {
  preloadTranscriber()
}, [])
```

The empty dependency array `[]` means this runs once, immediately after the first render. It starts the model download in the background. `getTranscriber()` is a singleton, so the promise started here and the promise `transcribe()` awaits later are the same object.

**Why App owns `rawTranscript` (not RecordButton):**

The raw transcript needs to be:
- Editable by the user (the textarea's `onChange` handler calls `setRawTranscript`)
- Read by the composition module (Step 6) to assemble the LLM prompt
- Read by the LLM call (Step 7)

All three points of access are in or above App. If `rawTranscript` lived in `RecordButton`, we'd have to pass it upward through props, which is the opposite of how data is meant to flow in React.

### `src/hooks/useAudioRecorder.js`

This is where all the audio recording logic lives. It is a *custom React hook* — a function whose name starts with `use` that can call other React hooks internally. Hooks let you package logic + state together and reuse them across components.

**What it manages:**

| piece | type | purpose |
|---|---|---|
| `state` | React state | `'idle'` or `'recording'` — drives the UI |
| `countdown` | React state | seconds remaining, displayed in the button |
| `audioBlob` | React state | the finished audio data, passed up to App |
| `error` | React state | `null`, `'permission_denied'`, or `'unavailable'` |
| `recorderRef` | ref | the `MediaRecorder` instance |
| `chunksRef` | ref | array that accumulates audio data as it arrives |
| `streamRef` | ref | the microphone `MediaStream` (needed to stop it later) |
| `timerRef` | ref | the interval ID for the countdown |

**Why refs for the MediaRecorder and stream, not state?**

React re-renders a component every time state changes. The `MediaRecorder` object and the microphone stream are not things you want to display — they're infrastructure. If you put them in state, React would re-render on every update to them, which would be incorrect and wasteful. `useRef` gives you a box that holds a value across renders without triggering re-renders. Think of it as an instance variable in a class.

**The recording flow:**

1. `start()` calls `navigator.mediaDevices.getUserMedia({ audio: true })` — this is the browser API that asks for microphone permission. It returns a `Promise` that resolves to a `MediaStream`.
2. We create a `MediaRecorder` from that stream.
3. `MediaRecorder` collects audio in chunks: every time audio data is available, `ondataavailable` fires and we push the chunk into `chunksRef.current`.
4. When `stop()` is called (manually or by the timer), the recorder flushes its final chunk, then fires `onstop`. In `onstop` we assemble all the chunks into a single `Blob` — a binary object holding the complete audio file.
5. We `setAudioBlob(blob)` which causes React to re-render with the new blob, which then triggers the `useEffect` in `RecordButton` that calls `onAudioReady`.

**Why `onstop` builds the blob, not `stop()`:**

This is a subtle but important point. `MediaRecorder.stop()` is asynchronous — it schedules the recorder to stop and flush, then returns immediately. One final `ondataavailable` event fires *after* `stop()` returns. If we built the blob inside `stop()`, we would miss that last chunk. `onstop` is guaranteed to fire only after all data has been delivered, so it's the correct place to assemble the final blob.

**Why `secondsLeft` is a local variable, not state:**

```js
let secondsLeft = MAX_SECONDS
timerRef.current = setInterval(() => {
  secondsLeft -= 1
  setCountdown(secondsLeft)   // update display
  if (secondsLeft <= 0) stop()
}, 1000)
```

The interval callback is a *closure* — it captures variables from the scope where it was created. If we read `countdown` (React state) inside the callback, we'd always see 90, because the closure captures the *initial* value at the time the interval was created, not the current value. The local `secondsLeft` variable is part of the same closure and correctly decrements with each tick. We only call `setCountdown` to update the display.

**`useCallback` on `stop`, `start`, and `toggle`:**

`useCallback(fn, [deps])` memoises a function — React gives back the same function object as long as `deps` has not changed. We use it here because `stop` (which has no dependencies) is referenced inside the `setInterval` closure and as a dependency of `start`. If `stop` got a new identity on every render, `start` would too, which would then cause the `setInterval` to be re-created unnecessarily. `useCallback` keeps identities stable.

### `src/components/RecordButton.jsx`

The visual layer over `useAudioRecorder`. It is intentionally thin — no logic, just rendering.

**The `useEffect` for forwarding the blob:**

```js
useEffect(() => {
  if (audioBlob) onAudioReady?.(audioBlob)
}, [audioBlob, onAudioReady])
```

`useEffect` runs *after* a render, whenever one of its dependencies changes. Here: whenever `audioBlob` gets a new value (i.e., a recording just finished), call `onAudioReady` with it. The `?.` is optional chaining — it safely does nothing if `onAudioReady` was not passed.

**Why not call `onAudioReady` directly inside `onstop`?**

Inside `onstop` we only have access to the hook's internal scope — we can't reach props of `RecordButton` from there. The `useEffect` pattern is the standard React way to "react to a state change and trigger a side effect" — here the side effect is notifying the parent.

**The pulsing animation:**

```jsx
{isRecording && (
  <span className="absolute inset-0 rounded-full animate-ping bg-red-600 opacity-30" />
)}
```

`animate-ping` is a Tailwind class that applies a CSS keyframe animation: it scales the element from 1× to 2× and fades it out, on a ~1-second loop. The `absolute inset-0` positions it exactly over the button. This gives the "sonar pulse" effect while recording.

### `src/services/transcribe.js`

This is the Whisper integration. It exports two functions: `transcribe(blob)` for actually running the model, and `preloadTranscriber()` to kick off the model download in the background before the user has recorded anything.

**The singleton pattern:**

```js
let transcriberPromise = null

function getTranscriber() {
  if (!transcriberPromise) {
    transcriberPromise = pipeline(...)
  }
  return transcriberPromise
}
```

`pipeline()` is the Hugging Face function that downloads the model and returns a callable. It returns a `Promise` — an asynchronous operation that resolves to the ready transcriber. We store that promise in a module-level variable the first time it is created. Every subsequent call to `getTranscriber()` returns the same promise, so the model is only downloaded once regardless of how many times `transcribe()` is called. This is the singleton pattern: at most one instance of the expensive resource, shared across all callers.

**Converting audio to what Whisper expects:**

```js
async function blobToAudioSamples(blob) {
  const arrayBuffer = await blob.arrayBuffer()
  const audioContext = new AudioContext({ sampleRate: 16000 })
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
  await audioContext.close()
  return audioBuffer.getChannelData(0)
}
```

Whisper expects audio as a `Float32Array` of single-channel (mono) samples at 16,000 Hz. The `Blob` from `MediaRecorder` is a compressed audio file (WebM or MP4). `AudioContext.decodeAudioData` decodes the compressed file and simultaneously resamples it to the target sample rate — a two-for-one. `getChannelData(0)` extracts the first (and only, after downmix) channel as a typed array.

**Why `AudioContext` not `OfflineAudioContext`:**

`OfflineAudioContext` is designed for faster-than-realtime processing, but it requires knowing the exact output length in advance (number of frames = sample rate × duration in seconds). We don't know the duration before decoding. `AudioContext` with a fixed `sampleRate` handles this cleanly: decode and resample in one call, no length calculation needed.

**Preloading:**

```js
export function preloadTranscriber() {
  return getTranscriber()
}
```

`App.jsx` calls this on mount via `useEffect([], [])`. The singleton promise starts resolving (model downloads in the background) while the user is looking at the UI. By the time they record and click stop, the model is ready and transcription feels instant. Without preloading, the user would wait 5–15 seconds after their first recording.

---

## Design decisions made so far

| decision | what we chose | alternative | why |
|---|---|---|---|
| Audio format | `audio/webm` (browser default) | `audio/wav`, `audio/mp4` | WebM is what `MediaRecorder` produces natively on most browsers. We let the browser choose rather than forcing a specific codec. Whisper accepts it fine. |
| Recording trigger | click-to-toggle | hold-to-record | Pinned in brief. Hold-to-record is natural for short voice commands; click-to-toggle is better for longer dictation where you don't want to hold a button. |
| 90-second cap | hard auto-stop | no cap, or configurable | Pinned in brief. `whisper-tiny` quality degrades on long audio. The cap is a quality guardrail, not a technical limitation. We lift it in v1.5. |
| Error handling | two distinct messages | one generic error | Microphone permission denied and microphone not found are different problems with different fixes. A generic message would frustrate users. |
| Hook/component split | logic in hook, UI in component | everything in one file | Separation makes the logic unit-testable and lets us walk through it line by line for the article without the UI getting in the way. |
| State for `audioBlob` lives in App | App owns it | RecordButton owns it | The blob needs to be accessible to the transcription logic (Step 5) and later to the refinement call. Putting it in the nearest common ancestor (`App`) avoids prop-drilling it down from a separate location. |
| Whisper package | `@huggingface/transformers` | `@xenova/transformers` | The Xenova package is the unmaintained predecessor. The HuggingFace package is the official successor with the same API. The rename is the only breaking change. |
| Whisper model | `onnx-community/whisper-tiny.en` | `Xenova/whisper-tiny.en` | The Xenova model was exported for the older v2 WASM-only API and lacks the per-block weight scales that the WebGPU MatMulNBits operator requires. The onnx-community model supports both backends. |
| Whisper dtype | `q4` (4-bit quantization) | `q8` / default `'quantized'` | The default `q8` export has per-tensor scales, which the WebGPU MatMulNBits operator rejects. The `q4` export includes per-block scales that the operator requires. |
| No Web Worker | flat service module | Worker + `postMessage` | The spec says flat module. Workers add complexity (separate module bundling, `postMessage` serialization, COOP/COEP headers for `SharedArrayBuffer`) with no benefit for a single-page app. |
| ONNX backend | WebGPU (library default) | force WASM | In `@huggingface/transformers@4.2.0` the `device: 'wasm'` option is silently ignored; WebGPU is used when available. With `q4` weights this is correct behaviour, so we accept it rather than fighting it. |
| `AudioContext` for decode+resample | `new AudioContext({ sampleRate: 16000 })` | `OfflineAudioContext` | `OfflineAudioContext` is faster-than-realtime but requires knowing the output length in advance. `AudioContext` with a fixed sample rate decodes and resamples in one call with no length calculation. |
| Singleton promise for model | module-level `let transcriberPromise` | create new pipeline per call | Model loading takes 5–15 seconds on first load. A singleton ensures the download happens once and the ready pipeline is reused for every recording in the session. |

---

## Things to revisit later

**No cleanup on unmount.** `useAudioRecorder` does not stop the stream or clear the timer if the component unmounts mid-recording. Fine for a single-page app where this never happens, but worth adding a `useEffect` cleanup if the component is ever rendered conditionally.

**`audio/webm` Safari compatibility.** Safari's `MediaRecorder` does not support `audio/webm` — it produces `audio/mp4` instead. The current code detects support at start time (`MediaRecorder.isTypeSupported('audio/webm')`) and falls back to the browser default, so the Blob is correctly typed. But if you ever hardcode the MIME type anywhere else, test on Safari.

**No microphone device selection.** `getUserMedia({ audio: true })` uses the default microphone. We don't offer device selection. Fine for v1.

**`@huggingface/transformers@4.2.0` ignores `device: 'wasm'`.** The option was valid in the v2 API and is silently ignored here. This means users without WebGPU support (older hardware, Firefox without the flag) will fall back to WASM automatically — that's fine, just slower. But it's an invisible behaviour worth tracking in case a future library update changes the default backend selection.

**Model caching is browser-managed.** The model weights are cached in the browser's Cache API. If the user clears site data, the ~40 MB download happens again on the next load. There's no way to warn the user in advance without a service worker, which is out of scope for v1.

**No tests for the rest of the pipeline.** `composePrompt.js` has 8 unit tests (run `npm test`). The transcription and LLM call layers are not unit-testable in isolation without mocking browser APIs — integration testing in the browser is the right approach for those.

---

## How the pipeline will look once complete

Each step in the brief adds one more stage to this flow:

```
Step 4 (done):   [click] → MediaRecorder → audioBlob
Step 5 (done):   audioBlob → Whisper (in browser) → rawTranscript (string)
Step 6 (done):   rawTranscript + intent + mode + tone → { system, user } (prompt composition)
Step 7 (next):   { system, user } → LLM API → refinedText (string)
Step 8+:         Mode selector, onboarding, settings, BYOK, prompt editor, deploy
```

Steps 4 and 5 are infrastructure. Step 6 is the argument: the composition module is what makes VoiceRefine different from a generic voice-to-text tool. Step 7 closes the loop — the first time a spoken phrase comes out the other end as polished prose.
