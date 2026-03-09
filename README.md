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

## 🤖 Claude Code integration

```bash
npx token-snake --claude
```

One command installs hooks into `~/.claude/settings.json`. Split your terminal — play in one pane while Claude works in the other.

Remove anytime with `npx token-snake --claude remove`.


## 🏗️ How it was built

An AI built the game you play while waiting for AI.

**The stack is intentionally minimal:**
- Pure TypeScript 
- Zero runtime dependencies
- Renders directly via `fs.writeSync(1)` to bypass Node.js stream machinery
- Use alternative screen buffers and DEC Private Mode 2026 to eliminate any flickering


## 📄 License

MIT © [Vipul Gupta](https://mixster.dev)
