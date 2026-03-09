<h1 align="center">
  🐍 token-snake
</h1>

<p align="center">
  <strong>An LLM-themed Snake game for your terminal.</strong><br/>
  Eat tokens, dodge hallucinations, grow your context window.<br/>
  Play while your AI agent thinks.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/token-snake"><img src="https://img.shields.io/npm/v/token-snake?color=brightgreen&label=npm" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/token-snake"><img src="https://img.shields.io/npm/dm/token-snake?color=blue" alt="npm downloads" /></a>
  <a href="https://github.com/vipulgupta2048/token-snake/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/token-snake?color=yellow" alt="license" /></a>
  <a href="https://github.com/vipulgupta2048/token-snake"><img src="https://img.shields.io/badge/node-%3E%3D18-green" alt="node version" /></a>
</p>

<br/>

```
Score: 90  Length: 12  Best: 90                    Juggling...
 $ 4K tokens  /c /compact                  WASD/HJKL:Move P:Pause Q:Quit
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│              ╔══                                             │
│              ║                                               │
│              ╚══        ()██▓▓░░··                           │
│                                                         $$   │
│         ?!                              <>                   │
│                    /c                                        │
│                                                          $   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
  Eat tokens to grow your context window — score increases with each bite
```

<br/>

## ⚡ Play it now

```bash
npx token-snake
```

Or install globally:

```bash
npm install -g token-snake
token-snake
```

## 🎮 Controls

| Key | Action |
|-----|--------|
| `W` `A` `S` `D` / Arrow keys | Move |
| `H` `J` `K` `L` (vi-style) | Move |
| `P` | Pause / Resume |
| `Q` | Quit |
| `Enter` | Restart (after game over) |

## 🍕 Food items

Eat tokens to increase your score. Avoid the dangerous ones.

### Good (green/cyan/yellow/blue)

| Icon | Name | Points | Effect |
|------|------|--------|--------|
| `$` | 4K tokens | +10 | Grow 1 |
| `$$` | 16K tokens | +25 | Grow 3 |
| `★` | 128K context | +50 | Grow 5 |
| `/c` | /compact | +15 | Shrink 3 |
| `f(` | tool_call | +20 | Grow 2 |
| `<>` | MCP server | +30 | Grow 2 |
| `K` | API key | +40 | Grow 1 |
| `>>` | turbo | +5 | Speed boost |

### Dangerous (red)

| Icon | Name | Points | Effect |
|------|------|--------|--------|
| `?!` | hallucination | -15 | +3 bloat |
| `!!` | rate limit | -10 | Nothing |

## 🧱 Obstacles

Bracket-shaped obstacles appear as you level up (every 100 points). Five predefined shapes — small bracket, tall bracket, I-beam, short I, and mirror bracket — placed in quadrants around the center of the play area.

| Level | Score | Obstacles |
|-------|-------|-----------|
| 1 | 100+ | 1 bracket (top-left quadrant) |
| 2 | 200+ | 2 brackets (opposite corners) |
| 3 | 300+ | 3 brackets |
| 4+ | 400+ | 4 brackets (all quadrants) |

Obstacles stay fixed for the entire level. They only regenerate when you reach the next level, never mid-play.

```
╔══          ╔══         ╔═          ╔═         ══╔═
║            ║           ║           ║             ║
╚══          ║           ║           ╚═         ══╚═
             ╚══         ╚═
small       tall        I-beam      short I     mirror
```

## 🤖 Play while your AI agent works

token-snake is designed to be the perfect distraction while LLM coding agents process your prompts. Six ways to activate it:

### 1. Standalone — just play

```bash
npx token-snake
```

Open in a split pane, second terminal tab, or whenever you need a break.

### 2. Agent-aware mode — live status in HUD

```bash
npx token-snake --agent
```

Watches `~/.token-snake/status` for real-time updates. Any tool can write to that file — the game shows the content in the top-right HUD. When the status says "done", the game notifies you.

### 3. Claude Code hooks — zero-config integration

```bash
npx token-snake hooks install
```

Installs hooks into `~/.claude/settings.json` that bridge Claude Code activity to the game:

| Hook | What shows in game HUD |
|------|----------------------|
| `PreToolUse` | Running bash commands |
| `PostToolUse` | Files being edited |
| `Notification` | Claude's notifications |
| `SessionStart` | Prints "play token-snake" hint |
| `SessionEnd` | "Agent done! Press Q to return" |

**Workflow:**
1. Run `npx token-snake hooks install` (one-time setup)
2. Open a split terminal pane
3. Run `npx token-snake --agent` in one pane
4. Use Claude Code in the other — game shows live status

Remove hooks anytime: `npx token-snake hooks remove`

### 4. Process watcher — monitor any PID

```bash
npx token-snake --pid $(pgrep -f "npm install")
npx token-snake --pid 12345
```

Monitors a running process. Shows "Watching PID..." in the HUD. When the process exits → "Process complete! Press Q to return."

### 5. Library API — embed in your CLI

```ts
import { startSnakeGame } from 'token-snake';

const game = startSnakeGame({
  statusFn: () => 'Processing files...',
  suppressStdout: () => { /* patch process.stdout.write */ },
  restoreStdout: () => { /* restore process.stdout.write */ },
  onExit: () => {
    console.log('Back to work!');
  },
});

// Forward keypresses from your input handler
yourInputHandler.on('key', (input, key) => {
  if (game.running) {
    game.handleKey(input, key);
    return;
  }
});

// When your background task finishes
onTaskComplete(() => game.notifyDone());

// Auto-pause when you need user input
onPermissionPrompt(() => game.pause());
onPermissionResolved(() => game.resume());
```

### 6. Shell alias — one keystroke away

Add to `~/.zshrc` or `~/.bashrc`:

```bash
alias snake='npx token-snake --agent'
```

Now type `snake` in any terminal while your agent works.

### Integration ideas

- **AI coding assistants** — offer the game while the agent works on a long task
- **CI/CD dashboards** — play while waiting for builds
- **Package managers** — `npm install` takes a while, why not play?
- **Any CLI with a loading spinner** — replace the spinner with a game

## 🔧 How it works

### Alternate screen buffer

Terminals have two screen buffers. Your normal terminal is buffer 1. When we send `\x1b[?1049h`, the terminal switches to buffer 2 — a completely blank canvas. Your original content isn't gone, it's just hidden. This is the same mechanism `vim`, `less`, and `htop` use.

The game renders entirely on buffer 2. When you quit, `\x1b[?1049l` brings buffer 1 back instantly — every line, every color, your scroll position, all preserved.

### Stealing stdout

If your CLI uses a framework like Ink (React for terminals), it constantly writes to `process.stdout`. Those writes would scribble over the game.

So we monkey-patch stdout before entering the game:

```js
const realWrite = process.stdout.write;
process.stdout.write = () => true;
process.stdout._write = () => true;
```

When the game exits, the originals are restored. The framework never knew anything happened.

### Bypassing Node.js streams

The game can't use `process.stdout.write` — we just patched it to a noop. Instead, we write directly to file descriptor 1:

```js
import { writeSync } from 'node:fs';
writeSync(1, frameString);
```

This bypasses Node's entire stream pipeline — no buffering, no encoding transforms, no event emission. Bytes go straight to the terminal.

### Synchronized output (no flicker)

We use **DEC mode 2026** — synchronized output:

```
\x1b[?2026h   ← "building a frame, don't paint yet"
...entire frame as one writeSync call...
\x1b[?2026l   ← "done, render it all at once"
```

The terminal buffers everything between those two sequences and paints it as a single atomic update. Zero flicker.

### The rendering model

Every tick (~90ms), the entire frame is built as one string array, joined, and written in a single `writeSync` call:

1. **HUD row 1** — score, length, best, agent status (top-right)
2. **HUD row 2** — food legend + controls
3. **Game border** — box-drawing characters (`┌─┐ │ └─┘`)
4. **Grid** — each cell is 2 terminal columns wide, built from lookup maps for snake/food/obstacles
5. **Overlays** — game over box or pause message rendered on top
6. **Footer** — cycling gameplay tips

### Input handling

The game never touches stdin. It exposes `handleKey()` and lets the host app route keypresses. This avoids stdin ownership conflicts with frameworks. A direction queue (up to 3 buffered inputs) ensures fast key sequences don't get dropped, and wall forgiveness tries queued turns before killing you.

### Speed curve

```js
speed = 90ms - (snakeLength / 6) * 2ms  // floor: 55ms
```

Starts comfortable. Gets faster as you grow. Turbo power-up multiplies by 0.6x temporarily. The floor is 55ms — low enough to feel fast, high enough that terminals don't drop frames.

### Death feedback

Death messages combine a thematic joke with the actual cause:

```
Segfault in attention layer — Hit the wall
SIGSNAKE received — Ate yourself
Token budget blown — Crashed into obstacle
```

## 🏆 High scores

Scores are saved to `~/.token-snake/scores.json`. Top 5 are shown on the game over screen with a `<<` marker on your current run. Scores save on both death and quit (pressing Q mid-game).

## 📦 Zero dependencies

token-snake has **zero runtime dependencies**. The entire game is ~700 lines of TypeScript compiled to ESM. It uses only Node.js built-ins: `fs.writeSync`, `os.homedir`, and `path.join`.

## 📄 License

MIT © [Vipul Gupta](https://mixster.dev)
