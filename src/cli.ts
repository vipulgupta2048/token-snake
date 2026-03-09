#!/usr/bin/env node

/**
 * token-snake CLI — play Token Snake directly from your terminal.
 *
 *   npx token-snake            # play standalone
 *   npx token-snake --agent    # play with live agent status in HUD
 *   npx token-snake --pid 123  # play while watching a process
 *   npx token-snake hooks install  # install Claude Code hooks
 *   npx token-snake --help     # show help
 *   npx token-snake --version  # show version
 */

import {startSnakeGame} from './index.js';
import {readFileSync, existsSync, writeFileSync, mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {homedir} from 'node:os';

const VERSION = '0.1.0';
const STATUS_DIR = join(homedir(), '.token-snake');
const STATUS_FILE = join(STATUS_DIR, 'status');

const args = process.argv.slice(2);

// ── --version ───────────────────────────────────────────────────────────────
if (args.includes('--version') || args.includes('-v')) {
	console.log(`token-snake v${VERSION}`);
	process.exit(0);
}

// ── --help ──────────────────────────────────────────────────────────────────
if (args.includes('--help') || args.includes('-h')) {
	console.log(`
  🐍 token-snake v${VERSION}
  An LLM-themed Snake game for your terminal.
  Eat tokens, dodge hallucinations, grow your context window.

  USAGE
    $ npx token-snake              Play standalone
    $ npx token-snake --music      Play with chiptune music
    $ npx token-snake --agent      Play with live agent status in HUD
    $ npx token-snake --pid <PID>  Play while watching a process
    $ npx token-snake hooks install Install Claude Code hooks
    $ npx token-snake hooks remove  Remove Claude Code hooks

  OPTIONS
    --music         Enable chiptune background music
    --agent         Watch ~/.token-snake/status for live agent updates
    --pid <PID>     Monitor a process — notifies you when it exits
    -h, --help      Show this help
    -v, --version   Show version

  CONTROLS
    W/A/S/D or Arrow keys    Move
    H/J/K/L (vi-style)      Move
    P                        Pause / Resume
    Q                        Quit

  EMBED IN YOUR CLI
    import { startSnakeGame } from 'token-snake';
    const game = startSnakeGame({ onExit: () => {} });

  MORE INFO
    https://github.com/vipulgupta2048/token-snake
`);
	process.exit(0);
}

// ── hooks install / remove ──────────────────────────────────────────────────
if (args[0] === 'hooks') {
	const sub = args[1];
	const claudeSettings = join(homedir(), '.claude', 'settings.json');

	const HOOK_MARKER = 'token-snake';
	const TOKEN_SNAKE_HOOKS = {
		PreToolUse: [
			{
				matcher: 'Bash',
				hooks: [
					{
						type: 'command',
						command: `mkdir -p ~/.token-snake && echo "Running: $(echo "$CLAUDE_BASH_COMMAND" | head -c 60)" > ~/.token-snake/status`,
					},
				],
			},
		],
		PostToolUse: [
			{
				matcher: 'Write|Edit',
				hooks: [
					{
						type: 'command',
						command: `mkdir -p ~/.token-snake && echo "Edited: $CLAUDE_FILE_PATH" > ~/.token-snake/status`,
					},
				],
			},
		],
		Notification: [
			{
				hooks: [
					{
						type: 'command',
						command: `mkdir -p ~/.token-snake && echo "$CLAUDE_NOTIFICATION" > ~/.token-snake/status`,
					},
				],
			},
		],
		SessionStart: [
			{
				hooks: [
					{
						type: 'command',
						command: `mkdir -p ~/.token-snake && echo "session-start" > ~/.token-snake/status && echo "\\x1b[90m🐍 token-snake: run \\x1b[0mnpx token-snake --agent\\x1b[90m in another pane to play while Claude works\\x1b[0m"`,
					},
				],
			},
		],
		SessionEnd: [
			{
				hooks: [
					{
						type: 'command',
						command: `echo "done" > ~/.token-snake/status 2>/dev/null || true`,
					},
				],
			},
		],
	};

	if (sub === 'install') {
		try {
			let settings: Record<string, unknown> = {};
			if (existsSync(claudeSettings)) {
				settings = JSON.parse(readFileSync(claudeSettings, 'utf-8'));
			} else {
				mkdirSync(join(homedir(), '.claude'), {recursive: true});
			}

			const hooks = (settings.hooks ?? {}) as Record<string, unknown[]>;

			// Merge token-snake hooks (avoid duplicates by checking for marker in command strings)
			for (const [hookName, hookEntries] of Object.entries(TOKEN_SNAKE_HOOKS)) {
				const existing = (hooks[hookName] ?? []) as Array<{hooks?: Array<{command?: string}>}>;
				const filtered = existing.filter(
					(e) => !e.hooks?.some((h) => h.command?.includes(HOOK_MARKER)),
				);
				hooks[hookName] = [...filtered, ...hookEntries];
			}

			settings.hooks = hooks;
			writeFileSync(claudeSettings, JSON.stringify(settings, null, '\t'));

			console.log(`
  ✅ Claude Code hooks installed!

  Hooks added to: ${claudeSettings}
    • PreToolUse   → Shows running bash commands in game HUD
    • PostToolUse  → Shows edited files in game HUD
    • Notification → Bridges Claude notifications to game
    • SessionStart → Prints a hint to play token-snake
    • SessionEnd   → Notifies game that session is done

  To play while Claude works:
    1. Open a split terminal pane
    2. Run: npx token-snake --agent
    3. Start using Claude Code in the other pane
`);
		} catch (err) {
			console.error(`  ❌ Failed to install hooks: ${(err as Error).message}`);
			process.exit(1);
		}
		process.exit(0);
	}

	if (sub === 'remove') {
		try {
			if (!existsSync(claudeSettings)) {
				console.log('  No Claude settings found. Nothing to remove.');
				process.exit(0);
			}

			const settings = JSON.parse(readFileSync(claudeSettings, 'utf-8'));
			const hooks = (settings.hooks ?? {}) as Record<string, unknown[]>;

			for (const hookName of Object.keys(TOKEN_SNAKE_HOOKS)) {
				const existing = (hooks[hookName] ?? []) as Array<{hooks?: Array<{command?: string}>}>;
				hooks[hookName] = existing.filter(
					(e) => !e.hooks?.some((h) => h.command?.includes(HOOK_MARKER)),
				);
				if ((hooks[hookName] as unknown[]).length === 0) {
					delete hooks[hookName];
				}
			}

			settings.hooks = hooks;
			writeFileSync(claudeSettings, JSON.stringify(settings, null, '\t'));
			console.log('  ✅ Claude Code hooks removed.');
		} catch (err) {
			console.error(`  ❌ Failed to remove hooks: ${(err as Error).message}`);
			process.exit(1);
		}
		process.exit(0);
	}

	console.log('  Usage: token-snake hooks install | token-snake hooks remove');
	process.exit(1);
}

// ── --pid <PID> ─────────────────────────────────────────────────────────────
const pidIdx = args.indexOf('--pid');
const watchPid = pidIdx >= 0 ? parseInt(args[pidIdx + 1] ?? '', 10) : null;

if (pidIdx >= 0 && (!watchPid || isNaN(watchPid))) {
	console.error('  Usage: token-snake --pid <PID>');
	process.exit(1);
}

// ── --agent mode ────────────────────────────────────────────────────────────
const agentMode = args.includes('--agent');
const musicMode = args.includes('--music');

function readStatusFile(): string {
	try {
		if (!existsSync(STATUS_FILE)) return '';
		return readFileSync(STATUS_FILE, 'utf-8').trim().slice(0, 80);
	} catch {
		return '';
	}
}

function isProcessAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

// ── Start game ──────────────────────────────────────────────────────────────

if (process.stdin.isTTY) {
	process.stdin.setRawMode(true);
}
process.stdin.resume();

let pidDone = false;

const game = startSnakeGame({
	music: musicMode,
	statusFn: () => {
		if (watchPid) {
			if (pidDone) return 'Process complete!';
			return `Watching PID ${watchPid}...`;
		}
		if (agentMode) {
			const status = readStatusFile();
			return status || 'Waiting for agent...';
		}
		return '';
	},
	onExit: () => {
		process.stdin.setRawMode?.(false);
		process.exit(0);
	},
});

// PID watcher — check every 2 seconds
if (watchPid) {
	const pidCheck = setInterval(() => {
		if (!isProcessAlive(watchPid)) {
			pidDone = true;
			game.notifyDone();
			clearInterval(pidCheck);
		}
	}, 2000);
}

// Agent mode — watch status file for "done" signals
if (agentMode) {
	const agentCheck = setInterval(() => {
		const status = readStatusFile().toLowerCase();
		if (status === 'done' || status.includes('session ended') || status.includes('complete')) {
			game.notifyDone();
			clearInterval(agentCheck);
		}
	}, 1000);
}

// Parse raw stdin into key objects that the game understands
process.stdin.on('data', (data: Buffer) => {
	const input = data.toString();

	// Ctrl+C — hard exit
	if (input === '\x03') {
		game.stop();
		return;
	}

	// Parse arrow keys from escape sequences
	const key: Record<string, boolean> = {};
	if (input === '\x1b[A') key.upArrow = true;
	else if (input === '\x1b[B') key.downArrow = true;
	else if (input === '\x1b[C') key.rightArrow = true;
	else if (input === '\x1b[D') key.leftArrow = true;
	else if (input === '\r' || input === '\n') (key as any).return = true;

	game.handleKey(input, key);
});
