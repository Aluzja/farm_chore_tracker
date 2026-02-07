<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		onfinish?: () => void;
	}

	const { onfinish }: Props = $props();

	let canvas: HTMLCanvasElement;

	const PALETTES = [
		['#ff1744', '#ff5252', '#ff0040', '#ffffff'],
		['#ffea00', '#ffd600', '#ffab00', '#ffffff'],
		['#00e676', '#00ff88', '#76ff03', '#ffffff'],
		['#00b0ff', '#00e5ff', '#18ffff', '#ffffff'],
		['#d500f9', '#e040fb', '#ff00ff', '#ffffff'],
		['#ff6d00', '#ff9100', '#ffab00', '#ffea00'],
		['#00ffcc', '#1de9b6', '#00e676', '#ffffff'],
		['#ff0055', '#ff4081', '#ff1744', '#ffffff']
	];

	function rand(min: number, max: number) {
		return Math.random() * (max - min) + min;
	}

	function pick<T>(arr: T[]): T {
		return arr[Math.floor(Math.random() * arr.length)];
	}

	function easeOut(t: number) {
		return 1 - Math.pow(1 - t, 3);
	}

	interface Spark {
		x: number;
		y: number;
		vx: number;
		vy: number;
		color: string;
		size: number;
		life: number;
		maxLife: number;
		gravity: number;
		friction: number;
	}

	interface Rocket {
		x: number;
		y: number;
		targetY: number;
		speed: number;
		color: string;
		palette: string[];
		trail: { x: number; y: number; alpha: number }[];
		exploded: boolean;
		sparkCount: number;
	}

	onMount(() => {
		const ctx = canvas.getContext('2d')!;
		const dpr = window.devicePixelRatio || 1;
		const W = window.innerWidth;
		const H = window.innerHeight;
		canvas.width = W * dpr;
		canvas.height = H * dpr;
		canvas.style.width = W + 'px';
		canvas.style.height = H + 'px';
		ctx.scale(dpr, dpr);

		const sparks: Spark[] = [];
		const rockets: Rocket[] = [];
		let pendingRockets = 0;
		let frame: number;

		function scheduleRocket(
			delay: number,
			targetYRange: [number, number],
			speedRange: [number, number]
		) {
			pendingRockets++;
			setTimeout(() => {
				const palette = pick(PALETTES);
				rockets.push({
					x: rand(W * 0.08, W * 0.92),
					y: H + 10,
					targetY: rand(targetYRange[0], targetYRange[1]),
					speed: rand(speedRange[0], speedRange[1]),
					color: palette[0],
					palette,
					trail: [],
					exploded: false,
					sparkCount: Math.floor(rand(90, 150))
				});
				pendingRockets--;
			}, delay);
		}

		// Wave 1: fast opening volley (0-400ms)
		for (let i = 0; i < 4; i++) {
			scheduleRocket(rand(0, 400), [H * 0.1, H * 0.35], [10, 16]);
		}

		// Wave 2: building (600-1400ms)
		for (let i = 0; i < 4; i++) {
			scheduleRocket(rand(600, 1400), [H * 0.08, H * 0.4], [9, 14]);
		}

		// Wave 3: sustained (1600-2600ms)
		for (let i = 0; i < 5; i++) {
			scheduleRocket(rand(1600, 2600), [H * 0.1, H * 0.45], [10, 15]);
		}

		// Wave 4: crescendo (2800-3600ms)
		for (let i = 0; i < 5; i++) {
			scheduleRocket(rand(2800, 3600), [H * 0.08, H * 0.4], [10, 16]);
		}

		// Wave 5: grand finale (3800-4200ms) — dense cluster
		for (let i = 0; i < 6; i++) {
			scheduleRocket(rand(3800, 4200), [H * 0.1, H * 0.5], [11, 16]);
		}

		function explodeRocket(r: Rocket) {
			const count = r.sparkCount;
			for (let i = 0; i < count; i++) {
				const angle = (i / count) * Math.PI * 2 + rand(-0.15, 0.15);
				const speed = rand(2, 14);
				sparks.push({
					x: r.x,
					y: r.y,
					vx: Math.cos(angle) * speed,
					vy: Math.sin(angle) * speed,
					color: pick(r.palette),
					size: rand(2, 5),
					life: 0,
					maxLife: rand(30, 55),
					gravity: 0.08,
					friction: 0.982
				});
			}
			// White-hot core sparks
			for (let i = 0; i < 25; i++) {
				const angle = rand(0, Math.PI * 2);
				const speed = rand(1, 8);
				sparks.push({
					x: r.x,
					y: r.y,
					vx: Math.cos(angle) * speed,
					vy: Math.sin(angle) * speed,
					color: '#ffffff',
					size: rand(3, 8),
					life: 0,
					maxLife: rand(15, 35),
					gravity: 0.05,
					friction: 0.975
				});
			}
		}

		function loop() {
			ctx.clearRect(0, 0, W, H);

			// Update & draw rockets
			for (const r of rockets) {
				if (r.exploded) continue;

				r.y -= r.speed;

				// Trail
				r.trail.push({ x: r.x + rand(-1, 1), y: r.y, alpha: 1 });
				if (r.trail.length > 10) r.trail.shift();

				for (const t of r.trail) {
					t.alpha *= 0.82;
					ctx.beginPath();
					ctx.arc(t.x, t.y, 2, 0, Math.PI * 2);
					ctx.fillStyle =
						r.color +
						Math.floor(t.alpha * 255)
							.toString(16)
							.padStart(2, '0');
					ctx.fill();
				}

				// Rocket head
				ctx.beginPath();
				ctx.arc(r.x, r.y, 3, 0, Math.PI * 2);
				ctx.fillStyle = '#ffffff';
				ctx.shadowColor = r.color;
				ctx.shadowBlur = 15;
				ctx.fill();
				ctx.shadowBlur = 0;

				if (r.y <= r.targetY) {
					r.exploded = true;
					explodeRocket(r);
				}
			}

			// Update & draw sparks
			for (let i = sparks.length - 1; i >= 0; i--) {
				const s = sparks[i];
				s.life++;
				if (s.life >= s.maxLife) {
					sparks.splice(i, 1);
					continue;
				}

				s.vy += s.gravity;
				s.vx *= s.friction;
				s.vy *= s.friction;
				s.x += s.vx;
				s.y += s.vy;

				const lifeRatio = s.life / s.maxLife;
				const alpha = 1 - easeOut(lifeRatio);
				const size = s.size * (1 - lifeRatio * 0.5);

				// Outer glow
				ctx.beginPath();
				ctx.arc(s.x, s.y, size * 4, 0, Math.PI * 2);
				ctx.fillStyle =
					s.color +
					Math.floor(alpha * 0.25 * 255)
						.toString(16)
						.padStart(2, '0');
				ctx.fill();

				// Inner glow
				ctx.beginPath();
				ctx.arc(s.x, s.y, size * 2, 0, Math.PI * 2);
				ctx.fillStyle =
					s.color +
					Math.floor(alpha * 0.5 * 255)
						.toString(16)
						.padStart(2, '0');
				ctx.fill();

				// Bright core
				ctx.beginPath();
				ctx.arc(s.x, s.y, size, 0, Math.PI * 2);
				ctx.fillStyle =
					s.color +
					Math.floor(alpha * 255)
						.toString(16)
						.padStart(2, '0');
				ctx.fill();
			}

			// Done when all rockets scheduled, all exploded, and all sparks gone
			const allExploded = rockets.length > 0 && rockets.every((r) => r.exploded);
			if (pendingRockets === 0 && allExploded && sparks.length === 0) {
				onfinish?.();
				return;
			}

			frame = requestAnimationFrame(loop);
		}

		frame = requestAnimationFrame(loop);

		return () => {
			cancelAnimationFrame(frame);
		};
	});
</script>

<canvas bind:this={canvas} class="fireworks-canvas" aria-hidden="true"></canvas>

<style>
	.fireworks-canvas {
		position: fixed;
		inset: 0;
		z-index: 200;
		pointer-events: none;
		background: rgba(0, 0, 0, 0.4);
	}
</style>
