# Launchpad (Browser Clip Launcher)

A browser-based “Launchpad” style clip launcher inspired by Novation’s Launchpad Arcade demo.

## Run

- Dev server: `npm run dev`
- Build: `npm run build`

## How it works

- Pads are laid out in an 8×8 grid (configurable via JSON).
- Columns act as “tracks”: only **one loop** per column can play at a time.
- Starts are **quantized** using `Tone.Transport` (default: 1 bar).
- Loop stop/replacement always waits until the **end of the current bar** so audio finishes cleanly.
- One-shots/FX play “over the top” and do not replace the loop.
- A per-column **Stop** pad (type `stop`) schedules the column’s loop to stop at the next quantization boundary.

## Controls

- **Play/Stop**: starts/stops the global transport.
- **Tempo**: fixed presets (90/100/160) in the top-right corner.
- **Quantize**: changes the boundary used for scheduling (`1m`, `2n`, `4n`, `8n`, or `none`).

This build uses a single built-in project file which you edit directly.

## Project JSON format

The demo project lives at [src/projects/demoProject.json](src/projects/demoProject.json).

Shape (high-level):

- `global`
	- `bpm`: number
	- `timeSignature`: `[numerator, denominator]` (denominator is stored but Tone.Transport uses numerator)
	- `quantization`: string (`"1m"`, `"2n"`, `"4n"`, `"8n"`, `"none"`)
- `grid`: `{ columns, rows }` (main grid)
- `tracks`: array of columns
	- `column`: 0-based index
	- `name`: string
	- `color`: hex string used for column accent
	- `clips`: array
		- `id`: unique string
		- `name`: label shown on pad
		- `row`: 0-based row index
		- `type`: `"loop" | "oneShot" | "stop"`
		- `source` (required for `loop` and `oneShot`)
			- `kind`: `"generated" | "url"`
			- if `generated`: `{ generator: string, bars?: number }`
			- if `url`: `{ url: string }` (e.g. `/sounds/myLoop.wav`)
- `customGrid`: `{ columns, rows, label }` (bottom strip)
- `customClips`: array of clips for the bottom 8×2 section
	- `column`: 0–7
	- `row`: 0–1
	- `type`: `"loop" | "oneShot"`

## Adding your own samples (Splice, etc.)

### 1) Put files in the right folder

Drop your audio files in:

- `public/sounds/`

Example:

- `public/sounds/drums_loop.wav`
- `public/sounds/bass_loop.wav`
- `public/sounds/fx_hit.wav`

Vite serves everything under `public/` at the site root, so that file becomes:

- URL: `/sounds/drums_loop.wav`

### 2) Wire them into the project JSON

Edit [src/projects/demoProject.json](src/projects/demoProject.json) and change clip `source` to use `kind: "url"`:

```json
{ "kind": "url", "url": "/sounds/myLoop.wav" }
```

Examples:

- Loop:

```json
{ "kind": "url", "url": "/sounds/drums_loop.wav" }
```

- One-shot:

```json
{ "kind": "url", "url": "/sounds/fx_hit.wav" }
```

Notes:

- For best results, loops should be trimmed to an exact bar length at the project BPM.
- Quantized scheduling keeps columns aligned even if you launch mid-bar.
test
### 3) Match tempo (important)

Because Splice loops come in different BPMs, you must match the **Tempo preset** to the loop’s BPM (90/100/160). If a loop is 128 BPM, it will still play, but it won’t align musically with the bar grid.

## Code organization

- [src/engine/AudioEngine.js](src/engine/AudioEngine.js): transport, quantization, scheduling, loop exclusivity, one-shots
- [src/engine/ProjectLoader.js](src/engine/ProjectLoader.js): load/normalize project JSON
- [src/ui/LaunchpadGrid.jsx](src/ui/LaunchpadGrid.jsx): grid rendering and pad visuals
- [src/audio/generatedClips.js](src/audio/generatedClips.js): self-contained demo clip generators

## Extension ideas

- MIDI input (Launchpad controller)
- Scenes/rows launch
- Per-track volume/mute/solo
- File picker UI for custom strip
