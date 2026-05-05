# VoiceRefine — Build Notes

A living document explaining what has been built, how the pieces connect, and why certain decisions were made. Written for someone comfortable with software and AI but new to frontend development.

---

## Current status (after Step 4)

We have a working scaffold: a React web app with a functional record button. You can open it in a browser, click the mic, speak, click again, and get back an audio blob. The two panels (raw transcript, refined output) are placeholder shells. Nothing touches Whisper or an LLM yet.

The next step is wiring in Whisper transcription (Step 5), which turns that audio blob into text.

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
        └── components/
            └── RecordButton.jsx       ← the record button UI
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

### @xenova/transformers

This is the package that will run Whisper in the browser. It is installed but not used yet (Step 5). Under the hood it uses ONNX Runtime Web, which is a JavaScript runtime for running machine learning models. When a user first loads the app, it downloads the Whisper model weights from Hugging Face's CDN and caches them in the browser. All inference happens locally — no audio is sent to any server.

Note: this package has a known vulnerability in one of its transitive dependencies (`protobufjs` via `onnxruntime-web`). It is low-risk for a zero-backend client-side app (the vulnerability path is not reachable from browser audio inference), but we will address it properly in v1.5 by migrating to `@huggingface/transformers`, the maintained successor.

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

The root of our component tree. It owns state that needs to be shared across multiple components — right now that's `audioBlob` (the raw recording). When `RecordButton` finishes a recording, it calls `onAudioReady` which is just `setAudioBlob` passed down as a prop. Then in Step 5 we pass `audioBlob` to the Whisper hook.

```
App
├── <header> — title, intent switcher (placeholder), settings button (placeholder)
├── <RecordButton onAudioReady={setAudioBlob} />
├── debug line showing blob size
└── two-panel layout
    ├── Raw Transcript panel (placeholder textarea)
    └── Refined Output panel (placeholder div)
```

**Why App owns the blob:** the audio blob needs to be accessible to both the recording UI (to reset it) and the transcription logic (to process it). Keeping shared state in the nearest common ancestor is a standard React pattern called "lifting state up".

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

---

## Things to revisit later

**`@xenova/transformers` vulnerability.** Four critical vulnerabilities in `protobufjs` via `onnxruntime-web`. Not exploitable in our zero-backend client-side context, but in v1.5 we will migrate to `@huggingface/transformers` (the maintained successor package with the same API).

**No cleanup on unmount.** `useAudioRecorder` does not stop the stream or clear the timer if the component unmounts mid-recording. Fine for a single-page app where this never happens, but worth adding a `useEffect` cleanup if the component is ever rendered conditionally.

**`audio/webm` Safari compatibility.** Safari's `MediaRecorder` does not support `audio/webm` — it produces `audio/mp4` instead. We hardcode `'audio/webm'` as the MIME type in the Blob constructor. In v1.5 we should detect the supported format and use that instead.

**No microphone device selection.** `getUserMedia({ audio: true })` uses the default microphone. We don't offer device selection. Fine for v1.

---

## How the pipeline will look once complete

Each step in the brief adds one more stage to this flow:

```
Step 4 (done):   [click] → MediaRecorder → audioBlob
Step 5 (next):   audioBlob → Whisper (in browser) → rawTranscript (string)
Step 6 (after):  rawTranscript + intent + mode + tone → { system, user } (prompt composition)
Step 7 (after):  { system, user } → LLM API → refinedText (string)
Step 8+:         UI wiring, onboarding, settings, BYOK
```

The interesting part of this project starts at Step 6 — the prompt composition module is what makes VoiceRefine different from a generic voice-to-text tool. Steps 4 and 5 are infrastructure. Step 6 is the argument.
