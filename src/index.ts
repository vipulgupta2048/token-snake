/**
 * Token Snake — an LLM-themed Snake game for your terminal.
 *
 * Zero dependencies. Renders via fs.writeSync(fd=1) to bypass any
 * framework stdout patching. Each cell is 2 terminal characters wide.
 *
 * Standalone usage:
 *   import { startSnakeGame } from 'token-snake';
 *   startSnakeGame({ onExit: () => process.exit(0) });
 *
 * Embed in another TUI (e.g. Ink):
 *   const game = startSnakeGame({
 *     statusFn: () => 'Working on task...',
 *     suppressStdout: () => { ... },
 *     restoreStdout: () => { ... },
 *     onExit: () => { ... },
 *   });
 *   // Forward keys: game.handleKey(input, key)
 *   // Notify idle done: game.notifyDone()
 *   // Auto-pause: game.pause() / game.resume()
 */

import {writeSync, readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {homedir, tmpdir} from 'node:os';
import {spawn, type ChildProcess} from 'node:child_process';

// ─── ANSI ────────────────────────────────────────────────────────────────────
const E = '\x1b';
const ALT_ON = `${E}[?1049h`;
const ALT_OFF = `${E}[?1049l`;
const CUR_HIDE = `${E}[?25l`;
const CUR_SHOW = `${E}[?25h`;
const MV = (r: number, c: number) => `${E}[${r};${c}H`;
const EL = `${E}[2K`;
const RS = `${E}[0m`;
const BD = `${E}[1m`;
const DM = `${E}[2m`;
const RV = `${E}[7m`;
const FG = {
	green: `${E}[92m`, red: `${E}[91m`, yellow: `${E}[93m`,
	cyan: `${E}[96m`, gray: `${E}[90m`, magenta: `${E}[95m`,
	white: `${E}[97m`, blue: `${E}[94m`,
};
const BG = {
	red: `${E}[41m`, yellow: `${E}[43m`, cyan: `${E}[46m`,
	gray: `${E}[100m`, green: `${E}[42m`,
};
const SYNC_ON = `${E}[?2026h`;
const SYNC_OFF = `${E}[?2026l`;

// ─── Audio — chiptune music & SFX via raw PCM ───────────────────────────────

const SAMPLE_RATE = 22050;

function genTone(freq: number, dur: number, vol = 0.3, wave: 'square' | 'sine' | 'noise' = 'square'): Int16Array {
	const samples = Math.floor(SAMPLE_RATE * dur);
	const buf = new Int16Array(samples);
	for (let i = 0; i < samples; i++) {
		const t = i / SAMPLE_RATE;
		const decay = Math.max(0, 1 - t / dur * 0.5);
		let val: number;
		if (wave === 'noise') val = Math.random() * 2 - 1;
		else if (wave === 'sine') val = Math.sin(2 * Math.PI * freq * t);
		else val = Math.sin(2 * Math.PI * freq * t) > 0 ? 1 : -1;
		buf[i] = Math.floor(val * vol * decay * 32767);
	}
	return buf;
}

function makeWav(pcm: Int16Array): Buffer {
	const dataLen = pcm.length * 2;
	const buf = Buffer.alloc(44 + dataLen);
	buf.write('RIFF', 0);
	buf.writeUInt32LE(36 + dataLen, 4);
	buf.write('WAVE', 8);
	buf.write('fmt ', 12);
	buf.writeUInt32LE(16, 16);
	buf.writeUInt16LE(1, 20);
	buf.writeUInt16LE(1, 22);
	buf.writeUInt32LE(SAMPLE_RATE, 24);
	buf.writeUInt32LE(SAMPLE_RATE * 2, 28);
	buf.writeUInt16LE(2, 32);
	buf.writeUInt16LE(16, 34);
	buf.write('data', 36);
	buf.writeUInt32LE(dataLen, 40);
	for (let i = 0; i < pcm.length; i++) buf.writeInt16LE(pcm[i]!, 44 + i * 2);
	return buf;
}

function concatPcm(...parts: Int16Array[]): Int16Array {
	const total = parts.reduce((s, p) => s + p.length, 0);
	const out = new Int16Array(total);
	let off = 0;
	for (const p of parts) { out.set(p, off); off += p.length; }
	return out;
}

// Startup jingle — ascending C major pentatonic
function startupJingle(): Int16Array {
	const notes = [523, 587, 659, 784, 880, 1047];
	return concatPcm(...notes.map(f => genTone(f, 0.08, 0.25)));
}

// Background loop — repeats many times for continuous play
function bgLoop(): Int16Array {
	const pattern = [
		262, 0, 330, 0, 392, 0, 330, 0,
		294, 0, 349, 0, 440, 0, 349, 0,
		262, 0, 392, 0, 523, 0, 392, 0,
		349, 0, 440, 0, 523, 0, 440, 0,
	];
	const parts: Int16Array[] = [];
	for (const f of pattern) {
		parts.push(f === 0 ? new Int16Array(Math.floor(SAMPLE_RATE * 0.06)) : genTone(f, 0.12, 0.10, 'sine'));
	}
	const bar = concatPcm(...parts);
	// ~2 minutes of music so it rarely runs out
	return concatPcm(...Array(30).fill(bar));
}

// SFX: eat good food — bright chirp ascending
function sfxEatGood(): Int16Array {
	return concatPcm(genTone(880, 0.04, 0.2), genTone(1175, 0.04, 0.2), genTone(1318, 0.06, 0.15));
}

// SFX: eat bad food — dissonant buzz descending
function sfxEatBad(): Int16Array {
	return concatPcm(genTone(300, 0.06, 0.25), genTone(200, 0.08, 0.2, 'noise'), genTone(150, 0.1, 0.15));
}

// SFX: game over — dramatic descending + noise crash
function sfxGameOver(): Int16Array {
	return concatPcm(
		genTone(523, 0.1, 0.3), genTone(440, 0.1, 0.25),
		genTone(349, 0.1, 0.2), genTone(262, 0.15, 0.2),
		genTone(196, 0.2, 0.15), genTone(100, 0.3, 0.1, 'noise'),
	);
}

let musicProc: ChildProcess | null = null;
let musicEnabled = false;
const tempAudioFiles: string[] = [];

function playAudio(pcm: Int16Array): ChildProcess | null {
	const wav = makeWav(pcm);
	const platform = process.platform;
	try {
		if (platform === 'darwin') {
			const tmpFile = join(tmpdir(), `token-snake-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.wav`);
			writeFileSync(tmpFile, wav);
			tempAudioFiles.push(tmpFile);
			const child = spawn('afplay', [tmpFile], { stdio: ['ignore', 'ignore', 'ignore'] });
			child.on('error', () => {});
			child.on('close', () => { try { unlinkSync(tmpFile); } catch {} });
			return child;
		} else if (platform === 'linux') {
			const child = spawn('aplay', ['-q', '-f', 'S16_LE', '-r', String(SAMPLE_RATE), '-c', '1', '-'], { stdio: ['pipe', 'ignore', 'ignore'] });
			child.stdin?.write(wav);
			child.stdin?.end();
			child.on('error', () => {});
			return child;
		}
	} catch { /* ignore */ }
	return null;
}

// Fire-and-forget SFX — plays independently of background music
function playSfx(pcm: Int16Array) {
	if (!musicEnabled) return;
	playAudio(pcm);
}

function startBgMusic() {
	if (musicProc) { try { musicProc.kill(); } catch {} }
	musicProc = playAudio(bgLoop());
	if (!musicProc) return;
	// When the loop ends, restart it (infinite loop)
	musicProc.on('close', (code) => {
		if (musicEnabled && code !== null) {
			musicProc = null;
			startBgMusic();
		}
	});
}

function startMusic() {
	musicEnabled = true;
	stopMusic();
	// Play startup jingle, then start looping background music
	const jingle = playAudio(startupJingle());
	if (!jingle) return;
	jingle.on('close', () => {
		if (musicEnabled) startBgMusic();
	});
	musicProc = jingle;
}

function stopMusic() {
	musicEnabled = false;
	if (musicProc) {
		try { musicProc.kill(); } catch {}
		musicProc = null;
	}
	for (const f of tempAudioFiles) { try { unlinkSync(f); } catch {} }
	tempAudioFiles.length = 0;
}

// ─── High scores ─────────────────────────────────────────────────────────────

interface HighScore { score: number; length: number; id: string }

const SCORES_DIR = join(homedir(), '.token-snake');
const SCORES_FILE = join(SCORES_DIR, 'scores.json');
const MAX_SCORES = 5;

function loadScores(): HighScore[] {
	try {
		if (!existsSync(SCORES_FILE)) return [];
		const data = JSON.parse(readFileSync(SCORES_FILE, 'utf-8'));
		if (Array.isArray(data)) {
			return data.slice(0, MAX_SCORES).map((h: any) => ({
				score: h.score ?? 0,
				length: h.length ?? h.tokens ?? 0,
				id: h.id ?? '',
			}));
		}
	} catch { /* ignore */ }
	return [];
}

function saveScore(s: number, len: number): { scores: HighScore[]; myId: string } {
	if (s <= 0) return { scores: loadScores(), myId: '' };
	const scores = loadScores();
	const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
	scores.push({score: s, length: len, id});
	scores.sort((a, b) => b.score - a.score);
	const top = scores.slice(0, MAX_SCORES);
	try {
		if (!existsSync(SCORES_DIR)) mkdirSync(SCORES_DIR, {recursive: true});
		writeFileSync(SCORES_FILE, JSON.stringify(top, null, 2));
	} catch { /* ignore */ }
	return { scores: top, myId: id };
}

// ─── Food types ──────────────────────────────────────────────────────────────

interface FoodType {
	icon: string;
	label: string;
	color: string;
	bg?: string;
	points: number;
	growth: number;
	toast: string;
	speedBoost?: number;
	dangerous?: boolean;
}

const FOODS: FoodType[] = [
	{icon: ' $', label: '4K tokens',     color: FG.green,   points: 10,  growth: 1,  toast: '+4K tokens consumed'},
	{icon: '$$', label: '16K tokens',    color: FG.cyan,    points: 25,  growth: 3,  toast: '+16K context loaded!'},
	{icon: '★ ', label: '128K context',  color: FG.yellow,  bg: BG.yellow, points: 50, growth: 5, toast: 'MAX CONTEXT!'},
	{icon: '/c', label: '/compact',      color: FG.white,   bg: BG.cyan, points: 15,  growth: -3, toast: '/compact — tokens trimmed!'},
	{icon: 'f(', label: 'tool_call',     color: FG.blue,    points: 20,  growth: 2,  toast: 'Tool call executed'},
	{icon: '<>', label: 'MCP server',    color: FG.green,   points: 30,  growth: 2,  toast: 'MCP server connected'},
	{icon: ' K', label: 'API key',       color: FG.yellow,  points: 40, growth: 1, toast: 'API key rotated'},
	{icon: '>>', label: 'turbo',         color: FG.cyan,    points: 5,   growth: 0,  toast: 'TURBO MODE!', speedBoost: 0.5},
	{icon: '?!', label: 'hallucination', color: FG.white,   bg: BG.red,  points: -15, growth: 3, toast: 'Hallucination! +3 bloat -15pts', dangerous: true},
	{icon: '!!', label: 'rate limit',    color: FG.red,     points: -10, growth: 0, toast: 'Rate limited! -10pts', dangerous: true},
];
const FOOD_W = [25, 18, 4, 14, 14, 7, 3, 12, 5, 4];

function pickFood(): FoodType {
	const total = FOOD_W.reduce((a, b) => a + b, 0);
	let r = Math.random() * total;
	for (let i = 0; i < FOOD_W.length; i++) {
		r -= FOOD_W[i]!;
		if (r <= 0) return FOODS[i]!;
	}
	return FOODS[0]!;
}

// ─── Death messages ──────────────────────────────────────────────────────────

const DEATHS = [
	'Context window exceeded', 'Rate limited', 'Segfault in attention layer',
	'Token budget blown', 'You hit the guardrails', 'Out-of-bounds hallucination',
	'Connection reset by peer', 'Max recursion depth exceeded', 'SIGSNAKE received',
	'Prompt injection detected', '500 Internal Server Error', 'Model overloaded',
];

// ─── Types ───────────────────────────────────────────────────────────────────

type Dir = 'up' | 'down' | 'left' | 'right';
interface Pt { x: number; y: number }
interface FoodItem { pos: Pt; type: FoodType }
interface Obstacle { cells: Pt[] }
const OPP: Record<Dir, Dir> = {up: 'down', down: 'up', left: 'right', right: 'left'};

// Predefined obstacle shapes (relative dx,dy from anchor point)
// Each shape has a vertical spine for bracket rendering
const OBSTACLE_SHAPES: Pt[][] = [
	// Tall bracket: ╔══ / ║  / ║  / ║  / ║  / ╚══  (6 tall)
	[{x:0,y:0},{x:0,y:1},{x:0,y:2},{x:0,y:3},{x:0,y:4},{x:0,y:5},{x:1,y:0},{x:1,y:5}],
	// Tower: ╔═ / ║  / ║  / ║  / ║  / ╚═  (6 tall)
	[{x:0,y:0},{x:0,y:1},{x:0,y:2},{x:0,y:3},{x:0,y:4},{x:0,y:5}],
	// Wide bracket: ╔══ / ║  / ║  / ║  / ╚══  (5 tall)
	[{x:0,y:0},{x:0,y:1},{x:0,y:2},{x:0,y:3},{x:0,y:4},{x:1,y:0},{x:1,y:4}],
	// Pillar: ╔═ / ║  / ║  / ║  / ║  / ║  / ╚═  (7 tall)
	[{x:0,y:0},{x:0,y:1},{x:0,y:2},{x:0,y:3},{x:0,y:4},{x:0,y:5},{x:0,y:6}],
	// Mirror wide bracket: ══╔═ /   ║  /   ║  /   ║  / ══╚═  (5 tall)
	[{x:1,y:0},{x:1,y:1},{x:1,y:2},{x:1,y:3},{x:1,y:4},{x:0,y:0},{x:0,y:4}],
];

/** Handle returned by startSnakeGame for controlling the game externally. */
export interface SnakeGame {
	/** Forward a keypress to the game. Call from your input handler. */
	handleKey(input: string, key: {
		leftArrow?: boolean; rightArrow?: boolean;
		upArrow?: boolean; downArrow?: boolean;
	}): void;
	/** Stop the game and restore the terminal. */
	stop(): void;
	/** Tell the game the background task is done. Shows "Press Q to return" in HUD. */
	notifyDone(): void;
	/** Pause the game (e.g. when a permission prompt appears). */
	pause(): void;
	/** Resume after pause. */
	resume(): void;
	/** Whether the game loop is running. */
	readonly running: boolean;
	/** Whether the game is currently paused. */
	readonly paused: boolean;
}

/** Options for starting a snake game. */
export interface SnakeGameOptions {
	/** AbortSignal to stop the game externally. */
	signal?: AbortSignal;
	/** Returns a status string shown in the top-right HUD (e.g. agent status). */
	statusFn?: () => string;
	/** Called when the game exits (Q pressed or stopped). */
	onExit: () => void;
	/** Enable chiptune background music. Disabled by default. */
	music?: boolean;
	/**
	 * Called before entering alt screen. Use to suppress your framework's
	 * stdout writes (e.g. patch process.stdout.write with a noop).
	 * If not provided, a default suppressor is used.
	 */
	suppressStdout?: () => void;
	/**
	 * Called after leaving alt screen. Restore your framework's stdout.
	 * Must be paired with suppressStdout.
	 */
	restoreStdout?: () => void;
}

// ─── Stdout suppression ─────────────────────────────────────────────────────

function createSuppressor() {
	const saved = {
		sw: process.stdout.write, su: (process.stdout as any)._write,
		ew: process.stderr.write, eu: (process.stderr as any)._write,
	};
	let on = false;
	const noop: any = (...a: any[]) => {
		const cb = typeof a[1] === 'function' ? a[1] : a[2];
		if (typeof cb === 'function') cb();
		return true;
	};
	return {
		suppress() {
			if (on) return; on = true;
			process.stdout.write = noop; (process.stdout as any)._write = noop;
			process.stderr.write = noop; (process.stderr as any)._write = noop;
		},
		restore() {
			if (!on) return; on = false;
			process.stdout.write = saved.sw; (process.stdout as any)._write = saved.su;
			process.stderr.write = saved.ew; (process.stderr as any)._write = saved.eu;
		},
	};
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function vis(s: string): number {
	return s.replace(/\x1b\[[0-9;]*m/g, '').length;
}

function center(s: string, w: number): string {
	const v = vis(s);
	if (v >= w) return s;
	const l = Math.floor((w - v) / 2);
	return ' '.repeat(l) + s + ' '.repeat(w - v - l);
}

// ─── Game ────────────────────────────────────────────────────────────────────

/**
 * Start a new Token Snake game.
 *
 * The game renders on an alternate screen buffer so it doesn't disturb
 * your main terminal output. All rendering goes through fs.writeSync(1)
 * to bypass Node.js stream machinery.
 */
export function startSnakeGame(opts: SnakeGameOptions): SnakeGame {
	const {signal, statusFn, onExit} = opts;
	const defSup = (!opts.suppressStdout || !opts.restoreStdout) ? createSuppressor() : null;
	const suppress = opts.suppressStdout ?? defSup!.suppress;
	const restore = opts.restoreStdout ?? defSup!.restore;

	let running = true;
	let paused = false;
	let agentDone = false;
	let gameOver = false;
	let waitForEnter = false;
	let deathMsg = '';
	let score = 0;
	let best = 0;
	let dir: Dir = 'right';
	let dirQueue: Dir[] = [];
	let snake: Pt[] = [];
	let foods: FoodItem[] = [];
	let obstacleSet: Set<string> = new Set();
	let obstacleList: Obstacle[] = [];
	let toast = '';
	let toastTicks = 0;
	let toastColor = FG.magenta;
	let tick_iv: NodeJS.Timeout | null = null;
	let blink = true;
	let ticks = 0;
	let speedBoostTicks = 0;
	let currentLevel = 0;
	let goScores: HighScore[] = [];
	let goMyId = '';

	let GW = 0, GH = 0, ox = 0, oy = 0;

	function raw(s: string) { writeSync(1, s); }

	function calcArea() {
		const c = process.stdout.columns || 80;
		const r = process.stdout.rows || 24;
		GW = Math.max(8, Math.floor((c - 4) / 2));
		GH = Math.max(5, r - 8);
		const totalW = GW * 2 + 2;
		ox = Math.max(1, Math.floor((c - totalW) / 2) + 1);
		oy = 4;
	}

	function getSpeed(): number {
		const lenBonus = Math.floor(snake.length / 6) * 2;
		let ms = 90 - lenBonus;
		if (speedBoostTicks > 0) ms *= 0.6;
		return Math.max(55, ms);
	}

	function isBlocked(x: number, y: number): boolean {
		return obstacleSet.has(`${x},${y}`);
	}

	function foodCount(): number {
		return Math.min(4, Math.max(1, Math.floor(GW / 12)));
	}

	// Place predefined bracket obstacles in quadrants around center
	function placeObstacles() {
		obstacleSet.clear();
		obstacleList = [];
		if (currentLevel <= 0) return;
		const count = Math.min(currentLevel, 4);
		const occ = new Set(snake.map(p => `${p.x},${p.y}`));
		for (const f of foods) occ.add(`${f.pos.x},${f.pos.y}`);

		// Anchor positions in 4 quadrants around center — well-spaced
		const cx = Math.floor(GW / 2), cy = Math.floor(GH / 2);
		const qx = Math.max(3, Math.floor(GW * 0.22));
		const qy = Math.max(2, Math.floor(GH * 0.25));
		const anchors = [
			{x: cx - qx, y: cy - qy},  // top-left
			{x: cx + qx, y: cy + qy},  // bottom-right
			{x: cx + qx, y: cy - qy},  // top-right
			{x: cx - qx, y: cy + qy},  // bottom-left
		];

		for (let i = 0; i < count; i++) {
			const anchor = anchors[i]!;
			const shape = OBSTACLE_SHAPES[i % OBSTACLE_SHAPES.length]!;

			let placed = false;
			for (let attempt = 0; attempt < 20 && !placed; attempt++) {
				const jx = attempt === 0 ? 0 : Math.floor(Math.random() * 5) - 2;
				const jy = attempt === 0 ? 0 : Math.floor(Math.random() * 3) - 1;
				const ax = anchor.x + jx, ay = anchor.y + jy;

				let valid = true;
				const cells: Pt[] = [];
				for (const s of shape) {
					const px = ax + s.x, py = ay + s.y;
					if (px < 1 || px >= GW - 1 || py < 1 || py >= GH - 1) { valid = false; break; }
					const k = `${px},${py}`;
					if (occ.has(k) || obstacleSet.has(k)) { valid = false; break; }
					cells.push({x: px, y: py});
				}

				if (valid && cells.length === shape.length) {
					for (const c of cells) {
						obstacleSet.add(`${c.x},${c.y}`);
						occ.add(`${c.x},${c.y}`);
					}
					obstacleList.push({cells});
					placed = true;
				}
			}
		}
	}

	function spawnFoods() {
		const occ = new Set(snake.map(p => `${p.x},${p.y}`));
		for (const f of foods) occ.add(`${f.pos.x},${f.pos.y}`);
		for (const o of obstacleSet) occ.add(o);
		const target = foodCount();
		while (foods.length < target) {
			let tries = 0;
			let pos: Pt;
			do {
				pos = {x: Math.floor(Math.random() * GW), y: Math.floor(Math.random() * GH)};
				tries++;
			} while (occ.has(`${pos.x},${pos.y}`) && tries < 300);
			const type = pickFood();
			foods.push({pos, type});
			occ.add(`${pos.x},${pos.y}`);
		}
	}

	function resetGame() {
		gameOver = false;
		waitForEnter = false;
		deathMsg = '';
		score = 0;
		dir = 'right';
		dirQueue = [];
		calcArea();
		const mx = Math.floor(GW / 2), my = Math.floor(GH / 2);
		snake = [{x: mx, y: my}, {x: mx - 1, y: my}, {x: mx - 2, y: my}];
		foods = [];
		obstacleSet.clear();
		obstacleList = [];
		currentLevel = 0;
		spawnFoods();
		toast = '';
		toastTicks = 0;
		speedBoostTicks = 0;
		goScores = [];
		goMyId = '';
	}

	function tick() {
		if (!running || paused) return;
		if (signal?.aborted) { stop(); return; }
		ticks++;

		if (gameOver) { blink = !blink; render(); return; }
		if (speedBoostTicks > 0) speedBoostTicks--;
		if (toastTicks > 0) toastTicks--;
		if (toastTicks === 0 && toast) toast = '';

		calcArea();

		if (dirQueue.length > 0) {
			const next = dirQueue.shift()!;
			if (next !== OPP[dir]) dir = next;
		}

		const hd = snake[0]!;
		let nx = hd.x, ny = hd.y;
		if (dir === 'up') ny--; else if (dir === 'down') ny++;
		else if (dir === 'left') nx--; else nx++;

		if ((nx < 0 || nx >= GW || ny < 0 || ny >= GH) && dirQueue.length > 0) {
			const alt = dirQueue.shift()!;
			if (alt !== OPP[dir]) {
				dir = alt;
				nx = hd.x; ny = hd.y;
				if (dir === 'up') ny--; else if (dir === 'down') ny++;
				else if (dir === 'left') nx--; else nx++;
			}
		}

		if (nx < 0 || nx >= GW || ny < 0 || ny >= GH) { die('Hit the wall'); return; }
		if (isBlocked(nx, ny)) { die('Crashed into obstacle'); return; }
		for (const s of snake) if (s.x === nx && s.y === ny) { die('Ate yourself'); return; }

		snake.unshift({x: nx, y: ny});

		const fi = foods.findIndex(f => f.pos.x === nx && f.pos.y === ny);
		if (fi >= 0) {
			const eaten = foods[fi]!;
			foods.splice(fi, 1);
			score += eaten.type.points;
			if (score < 0) score = 0;
			if (score > best) best = score;
			toast = eaten.type.toast;
			toastColor = eaten.type.color;
			toastTicks = 25;
			if (eaten.type.speedBoost) speedBoostTicks = 25;
			playSfx(eaten.type.dangerous ? sfxEatBad() : sfxEatGood());
			const g = eaten.type.growth;
			if (g < 0) {
				const rem = Math.min(Math.abs(g), snake.length - 3);
				for (let i = 0; i < rem; i++) snake.pop();
			} else if (g > 0) {
				const tail = snake[snake.length - 1]!;
				for (let i = 0; i < g - 1; i++) snake.push({x: tail.x, y: tail.y});
			}
			spawnFoods();
			const newLevel = Math.floor(score / 100);
			if (newLevel > currentLevel) {
				currentLevel = newLevel;
				placeObstacles();
			}
		} else {
			snake.pop();
		}

		render();
		if (tick_iv) { clearInterval(tick_iv); tick_iv = setInterval(tick, getSpeed()); }
	}

	function die(cause?: string) {
		gameOver = true;
		waitForEnter = true;
		const joke = DEATHS[Math.floor(Math.random() * DEATHS.length)]!;
		deathMsg = cause ? `${joke} — ${cause}` : joke;
		playSfx(sfxGameOver());
		const result = saveScore(score, snake.length);
		goScores = result.scores;
		goMyId = result.myId;
		render();
	}

	// ── Render ───────────────────────────────────────────────────────────────

	function render() {
		const rows = process.stdout.rows || 24;
		const cols = process.stdout.columns || 80;
		const b: string[] = [SYNC_ON];

		b.push(MV(1, 1) + EL);
		let left1 = ` ${FG.white}${BD}Score: ${FG.cyan}${score}${RS}`;
		left1 += `${FG.gray}  Length: ${FG.white}${snake.length}${RS}`;
		left1 += `${FG.gray}  Best: ${FG.yellow}${best}${RS}`;
		if (speedBoostTicks > 0) left1 += `  ${FG.yellow}${BD}TURBO${RS}`;
		b.push(left1);

		const status = statusFn ? statusFn() : '';
		let r1 = '';
		if (agentDone) {
			r1 = blink ? `${FG.green}${BD}Agent done! Press Q to return` : `${DM}${FG.green}Agent done! Press Q to return`;
		} else if (paused) {
			r1 = `${FG.yellow}${BD}PAUSED`;
		} else if (status) {
			r1 = `${FG.yellow}${status.slice(0, Math.max(0, cols - 55))}`;
		}
		if (r1) {
			const rc = Math.max(vis(left1) + 3, cols - vis(r1) - 2);
			b.push(MV(1, rc) + r1 + RS);
		}

		b.push(MV(2, 1) + EL);
		if (toast) {
			b.push(` ${toastColor}${BD}> ${toast}${RS}`);
		} else {
			// Clean legend: icon + label, no backgrounds
			const seen = new Set<string>();
			let legend = ' ';
			const sorted = [...foods].sort((a, _b) => a.type.dangerous ? 1 : -1);
			for (const f of sorted) {
				if (seen.has(f.type.label)) continue;
				seen.add(f.type.label);
				const clr = f.type.dangerous ? FG.red : f.type.color;
				legend += `${clr}${f.type.icon}${RS} ${FG.gray}${f.type.label}${RS}  `;
			}
			b.push(legend);
		}
		const ctrl = `${FG.white}WASD/HJKL${FG.gray}:Move ${FG.white}P${FG.gray}:Pause ${FG.white}Q${FG.gray}:Quit`;
		b.push(MV(2, Math.max(1, cols - vis(ctrl) - 1)) + ctrl + RS);

		b.push(MV(3, 1) + EL);

		const innerW = GW * 2;
		const topB = '┌' + '─'.repeat(innerW) + '┐';
		const botB = '└' + '─'.repeat(innerW) + '┘';
		b.push(MV(oy, ox) + `${FG.gray}${topB}${RS}`);

		const sMap = new Map<string, number>();
		for (let i = 0; i < snake.length; i++) sMap.set(`${snake[i]!.x},${snake[i]!.y}`, i);
		const fMap = new Map<string, FoodItem>();
		for (const f of foods) fMap.set(`${f.pos.x},${f.pos.y}`, f);
		const pulse = ticks % 6 < 3;

		const obsRender = new Map<string, string>();
		for (const obs of obstacleList) {
			if (obs.cells.length < 3) continue;
			const xCounts = new Map<number, Pt[]>();
			for (const c of obs.cells) {
				const arr = xCounts.get(c.x) ?? [];
				arr.push(c);
				xCounts.set(c.x, arr);
			}
			let spineX = obs.cells[0]!.x;
			let maxCount = 0;
			for (const [x, pts] of xCounts) {
				if (pts.length > maxCount) { maxCount = pts.length; spineX = x; }
			}
			const spine = (xCounts.get(spineX) ?? []).sort((a, b) => a.y - b.y);
			const topY = spine[0]?.y ?? 0;
			const botY = spine[spine.length - 1]?.y ?? 0;

			for (const c of obs.cells) {
				const k = `${c.x},${c.y}`;
				if (c.x === spineX) {
					if (c.y === topY) obsRender.set(k, '╔═');
					else if (c.y === botY) obsRender.set(k, '╚═');
					else obsRender.set(k, '║ ');
				} else {
					obsRender.set(k, '══');
				}
			}
		}

		for (let y = 0; y < GH; y++) {
			const row = oy + 1 + y;
			b.push(MV(row, 1) + EL + MV(row, ox));
			b.push(`${FG.gray}│${RS}`);

			for (let x = 0; x < GW; x++) {
				const key = `${x},${y}`;
				const si = sMap.get(key);

				if (si !== undefined) {
					if (si === 0) {
						b.push(`${BG.green}${FG.white}${BD}()${RS}`);
					} else {
						const pct = si / snake.length;
						if (pct < 0.35) b.push(`${FG.green}${BD}██${RS}`);
						else if (pct < 0.65) b.push(`${FG.green}▓▓${RS}`);
						else if (pct < 0.85) b.push(`${DM}${FG.green}░░${RS}`);
						else b.push(`${DM}${FG.gray}··${RS}`);
					}
				} else if (fMap.has(key)) {
					const f = fMap.get(key)!;
					const bg = f.type.bg ?? '';
					b.push(`${bg}${f.type.color}${pulse ? BD : ''}${f.type.icon}${RS}`);
				} else if (obsRender.has(key)) {
					b.push(`${FG.yellow}${BD}${obsRender.get(key)}${RS}`);
				} else if (obstacleSet.has(key)) {
					b.push(`${FG.yellow}${BD}[]${RS}`);
				} else {
					b.push('  ');
				}
			}
			b.push(`${FG.gray}│${RS}`);
		}

		b.push(MV(oy + 1 + GH, ox) + `${FG.gray}${botB}${RS}`);

		if (gameOver) {
			const boxW = Math.min(GW * 2 - 4, 40);
			const bx = ox + 1 + Math.floor((GW * 2 - boxW) / 2);

			const lines: string[] = [];
			lines.push('');
			// Wrap death message if it overflows the box
			const rawMsg = deathMsg;
			if (vis(rawMsg) > boxW - 2) {
				const sep = rawMsg.indexOf(' — ');
				if (sep >= 0) {
					lines.push(`${FG.red}${BD}${rawMsg.slice(0, sep)}${RS}`);
					lines.push(`${FG.red}${BD}${rawMsg.slice(sep + 3)}${RS}`);
				} else {
					// Hard wrap at boxW - 2
					lines.push(`${FG.red}${BD}${rawMsg.slice(0, boxW - 2)}${RS}`);
					lines.push(`${FG.red}${BD}${rawMsg.slice(boxW - 2)}${RS}`);
				}
			} else {
				lines.push(`${FG.red}${BD}${rawMsg}${RS}`);
			}
			lines.push('');
			lines.push(`${FG.white}${BD}Score ${FG.cyan}${score}${RS}  ${FG.gray}Length ${FG.white}${snake.length}${RS}`);

			if (goScores.length > 0) {
				lines.push('');
				lines.push(`${FG.yellow}${BD}  #   Score  Length${RS}`);
				for (let i = 0; i < goScores.length; i++) {
					const h = goScores[i]!;
					const rank = i === 0 ? `${FG.yellow}${BD}` : i === 1 ? `${FG.gray}` : i === 2 ? `${FG.red}` : `${FG.gray}${DM}`;
					const me = h.id === goMyId ? ` ${FG.green}${BD}<<` : '';
					lines.push(`${rank} #${i + 1}${RS}  ${FG.white}${BD}${String(h.score).padStart(5)}${RS}  ${FG.gray}${String(h.length).padStart(5)}${RS}${me}${RS}`);
				}
			}
			lines.push('');
			lines.push(`${FG.white}${BD}Press Enter to play again${RS}`);
			lines.push('');

			const totalH = lines.length + 2;
			const cy = oy + 1 + Math.max(0, Math.floor((GH - totalH) / 2));

			b.push(MV(cy, bx) + `${FG.gray}╭${'─'.repeat(boxW)}╮${RS}`);
			for (let i = 0; i < lines.length; i++) {
				b.push(MV(cy + 1 + i, bx) + `${FG.gray}│${RS}${center(lines[i]!, boxW)}${FG.gray}│${RS}`);
			}
			b.push(MV(cy + 1 + lines.length, bx) + `${FG.gray}╰${'─'.repeat(boxW)}╯${RS}`);
		}

		if (paused && !gameOver) {
			const cy = oy + 1 + Math.floor(GH / 2);
			const msg = '  PAUSED — Press P to resume  ';
			const cx = ox + Math.floor((GW * 2 + 2 - msg.length) / 2);
			b.push(MV(cy, Math.max(1, cx)) + `${RV}${FG.cyan}${BD}${msg}${RS}`);
		}

		const footerY = oy + GH + 3;
		if (footerY <= rows) {
			const tips = [
				'Eat tokens to grow your context window — score increases with each bite',
				'/compact shrinks the snake — just like compacting your prompts',
				'Red items are dangerous — hallucinations and rate limits cost points!',
				'MCP servers are worth 30pts — connect them all',
				'Speed increases as you grow — just like API costs',
				'Bracket obstacles appear as your score grows — navigate carefully!',
				'Multiple items spawn — choose wisely, avoid the red ones!',
			];
			const tip = tips[Math.floor(ticks / 150) % tips.length]!;
			b.push(MV(footerY, 1) + EL + MV(footerY, Math.max(1, Math.floor((cols - tip.length) / 2))));
			b.push(`${FG.white}${BD}${tip}${RS}`);
		}

		for (let r = footerY + 1; r <= rows; r++) b.push(MV(r, 1) + EL);
		b.push(SYNC_OFF);
		raw(b.join(''));
	}

	// ── Controls ─────────────────────────────────────────────────────────────

	function stop() {
		if (!running) return;
		running = false;
		stopMusic();
		if (tick_iv) { clearInterval(tick_iv); tick_iv = null; }
		if (!gameOver && score > 0) {
			saveScore(score, snake.length);
		}
		restore();
		raw(CUR_SHOW + ALT_OFF);
		onExit();
	}

	function handleKey(input: string, key: {
		leftArrow?: boolean; rightArrow?: boolean;
		upArrow?: boolean; downArrow?: boolean;
	}) {
		if (!running) return;
		const lo = input.toLowerCase();

		if (lo === 'q') { stop(); return; }

		if (waitForEnter && ((key as any).return || input === '\r' || input === '\n')) {
			resetGame();
			render();
			return;
		}

		if (lo === 'p' && !gameOver) {
			paused = !paused;
			render();
			return;
		}
		if (paused || gameOver) return;

		let nd: Dir | null = null;
		if (lo === 'w' || lo === 'k' || key.upArrow) nd = 'up';
		else if (lo === 's' || lo === 'j' || key.downArrow) nd = 'down';
		else if (lo === 'a' || lo === 'h' || key.leftArrow) nd = 'left';
		else if (lo === 'd' || lo === 'l' || key.rightArrow) nd = 'right';

		if (nd && dirQueue.length < 3) {
			const last = dirQueue.length > 0 ? dirQueue[dirQueue.length - 1]! : dir;
			if (nd !== OPP[last] && nd !== last) dirQueue.push(nd);
		}
	}

	function notifyDone() { agentDone = true; }
	function gamePause() { if (!paused && running) { paused = true; render(); } }
	function gameResume() { if (paused && running) { paused = false; render(); } }

	// ── Init ─────────────────────────────────────────────────────────────────
	best = loadScores()[0]?.score ?? 0;
	suppress();
	raw(ALT_ON + CUR_HIDE + `${E}[2J`);
	calcArea();
	resetGame();
	render();
	if (opts.music) startMusic();
	tick_iv = setInterval(tick, 90);

	if (signal) signal.addEventListener('abort', () => stop(), {once: true});

	return {
		handleKey, stop, notifyDone,
		pause: gamePause, resume: gameResume,
		get running() { return running; },
		get paused() { return paused; },
	};
}
