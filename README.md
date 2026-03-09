<h1 align="center">
  🐍 token-snake
</h1>

<p align="center">
  <strong>An LLM-themed Snake game for your terminal.</strong><br/>
  Eat tokens. Dodge hallucinations. Grow your context window.<br/>
  Play while your code compiles.
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

## 🤖 Play while you wait

token-snake was built to fill the dead time — waiting for builds, deploys, or LLM responses. Four ways to wire it up:

### 1. Just play

```bash
npx token-snake
```

Split pane, second tab, coffee break — works anywhere.

### 2. Claude Code hooks

```bash
npx token-snake --claude install
```

One command installs hooks into `~/.claude/settings.json`:

| Hook | What happens |
|------|-----------|
| `PreToolUse` | Shows bash commands in HUD |
| `PostToolUse` | Shows edited files in HUD |
| `Notification` | Bridges Claude notifications |
| `SessionStart` | Prints a "play token-snake" hint |
| `SessionEnd` | Notifies game that session is done |

Then split your terminal: `npx token-snake` in one pane, Claude Code in the other. Remove anytime with `npx token-snake --claude remove`.

### 3. Process watcher

```bash
npx token-snake --pid $(pgrep -f "npm install")
```

Monitors any PID. Notifies you when the process exits.

### 4. Library API

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

## 🏗️ How it was built

An AI built the game you play while waiting for AI.

**The stack is intentionally minimal:**
- Pure TypeScript 
- Zero runtime dependencies
- Renders directly via `fs.writeSync(1)` to bypass Node.js stream machinery
- Use alternative screen buffers and DEC Private Mode 2026 to eliminate any flickering


## 📄 License

MIT © [Vipul Gupta](https://mixster.dev)
