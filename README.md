<h1 align="center">
  🐍 token-snake
</h1>

<p align="center">
  <strong>An LLM-themed Snake game for your terminal.</strong><br/>
  Eat tokens. Dodge hallucinations. Grow your context window.<br/>
  Play while your AI agent thinks.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/token-snake"><img src="https://img.shields.io/npm/v/token-snake?color=brightgreen&label=npm" alt="npm version" /></a>
  <a href="https://github.com/vipulgupta2048/token-snake/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/token-snake?color=yellow" alt="license" /></a>
  <a href="https://github.com/vipulgupta2048/token-snake"><img src="https://img.shields.io/badge/node-%3E%3D18-green" alt="node version" /></a>
  <a href="https://github.com/vipulgupta2048/token-snake"><img src="https://img.shields.io/badge/dependencies-0-blue" alt="zero deps" /></a>
</p>

<br/>

## ⚡ Play now

```bash
npx token-snake
```

https://github.com/user-attachments/assets/e95635be-8c14-45e2-83fd-a703e0fbe5a2

Want music? Add `--music` for chiptune beats.

```bash
npx token-snake --music
```

Or install globally so it's always one keystroke away:

```bash
npm i -g token-snake
token-snake
```

## 🎮 How to play

Move the snake. Eat the good tokens. Avoid the bad ones. Don't hit the walls, obstacles, or yourself.

| Key | Action |
|-----|--------|
| `W` `A` `S` `D` / Arrow keys | Move |
| `H` `J` `K` `L` (vi-style) | Move |
| `P` | Pause / Resume |
| `Q` | Quit |
| `Enter` | Restart (after game over) |

### 🍕 Food — eat the good, dodge the bad

| Icon | Name | Pts | What happens |
|------|------|-----|-------------|
| `$` | 4K tokens | +10 | Grow 1 |
| `$$` | 16K tokens | +25 | Grow 3 |
| `★` | 128K context | +50 | Grow 5 — the jackpot |
| `/c` | /compact | +15 | Shrink 3 — life saver when you're too long |
| `f(` | tool_call | +20 | Grow 2 |
| `<>` | MCP server | +30 | Grow 2 |
| `K` | API key | +40 | Grow 1 |
| `>>` | turbo | +5 | Temporary speed boost 🔥 |
| `?!` | hallucination | **-15** | +3 bloat — the snake grows with no benefit |
| `!!` | rate limit | **-10** | Score penalty |

### 🧱 Obstacles — tall brackets that punish

Bracket-shaped obstacles spawn as you level up (every 100 points). They're tall — 5 to 7 cells high — and placed in quadrants around the center. Hit one and you're dead.

| Score | What appears |
|-------|-------------|
| 100+ | 1 tall bracket |
| 200+ | 2 brackets (opposite corners) |
| 300+ | 3 brackets |
| 400+ | 4 brackets — all quadrants blocked |

```
╔══        ╔═        ╔══        ╔═        ══╔═
║          ║         ║          ║            ║
║          ║         ║          ║            ║
║          ║         ║          ║            ║
║          ║         ║          ║            ║
╚══        ╚═        ╚══        ╚═        ══╚═
                                ║
tall       tower     wide       pillar     mirror
bracket               bracket
```

Obstacles stay fixed for the entire level. They regenerate only when you hit the next 100-point threshold.

### 🏆 High scores

Top 5 scores saved to `~/.token-snake/scores.json`. Your current run is marked with `<<` on the game over screen.

### 💀 Death messages

Death messages are LLM-themed jokes paired with the actual cause:

```
Segfault in attention layer — Hit the wall
SIGSNAKE received — Ate yourself
Token budget blown — Crashed into obstacle
```

## 🤖 Play while your AI agent works

token-snake was built to fill the dead time while LLM coding agents process prompts. Six ways to wire it up:

### 1. Just play

```bash
npx token-snake
```

Split pane, second tab, coffee break — works anywhere.

### 2. Agent-aware mode

```bash
npx token-snake --agent
```

Watches `~/.token-snake/status` for real-time updates. Any tool can write to that file — the content shows in the top-right HUD. When the status says "done", the game notifies you.

### 3. Claude Code hooks

```bash
npx token-snake --claude install
```

One command installs hooks into `~/.claude/settings.json`:

| Hook | HUD shows |
|------|-----------|
| `PreToolUse` | Bash commands running |
| `PostToolUse` | Files being edited |
| `Notification` | Claude's notifications |
| `SessionStart` | "play token-snake" hint |
| `SessionEnd` | "Agent done!" |

Then split your terminal: `npx token-snake --agent` in one pane, Claude Code in the other. Remove anytime with `npx token-snake --claude remove`.

### 4. Process watcher

```bash
npx token-snake --pid $(pgrep -f "npm install")
```

Monitors any PID. Notifies you when the process exits.

### 5. Library API

```ts
import { startSnakeGame } from 'token-snake';

const game = startSnakeGame({
  music: true,
  statusFn: () => 'Processing files...',
  onExit: () => console.log('Back to work!'),
});

// Forward keys, notify when done, pause for prompts
game.handleKey(input, key);
game.notifyDone();
game.pause(); game.resume();
```

### 6. Shell alias

```bash
# Add to ~/.zshrc or ~/.bashrc
alias snake='npx token-snake --agent'
```

## 🏗️ How it was built

token-snake was built entirely with AI coding agents — specifically [Claude Code](https://docs.anthropic.com/en/docs/claude-code) and GitHub Copilot. The irony isn't lost on us: an AI built the game you play while waiting for AI.

**The stack is intentionally minimal:**
- ~1,200 lines of TypeScript across two files (`index.ts` game engine, `cli.ts` CLI)
- **Zero runtime dependencies** — only Node.js built-ins (`fs`, `os`, `path`, `child_process`)
- Compiled to ESM with [tsup](https://github.com/egoist/tsup)
- Renders directly via `fs.writeSync(1)` to bypass Node.js stream machinery

**Key technical decisions the AI made:**
- **Alternate screen buffer** (`\x1b[?1049h`) — same trick `vim` and `htop` use. Your terminal content is untouched
- **DEC mode 2026** for synchronized output — the terminal buffers the entire frame and paints it atomically. Zero flicker
- **Stdout monkey-patching** — if embedded in an Ink/React CLI, the game patches `process.stdout.write` to a noop so framework writes don't scribble over the game
- **Direction queue** with wall forgiveness — buffers up to 3 keypresses so fast inputs don't get dropped, and tries queued turns before killing you on walls
- **Chiptune audio** — generates PCM WAV in-memory (square wave synthesis), pipes to `afplay`/`aplay`. No audio files, no audio libraries
- **Speed curve** — `90ms - (length / 6) × 2ms` with a 55ms floor. Feels comfortable at start, frantic by endgame

**The development process:** one prompt → plan → implement → test → ship. The initial v0.1.0 (game engine, 6 agent activation methods, Claude Code hooks, professional repo setup, README, npm publish) was done in a single session. Bug fixes and features (death message overflow, taller obstacles, music) were iterated live from screenshots.

## 📄 License

MIT © [Vipul Gupta](https://mixster.dev)
