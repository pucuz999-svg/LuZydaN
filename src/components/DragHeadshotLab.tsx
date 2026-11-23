import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Crosshair, RotateCcw, Target } from 'lucide-react';
import { SensitivityValues } from '../types';

interface DragHeadshotLabProps {
  sensitivity: SensitivityValues;
  fireButtonSize: number;
}

type WeaponId = 'm1887' | 'deagle' | 'mp40' | 'woodpecker' | 'scar';
type TargetMode = 'stationary' | 'strafing' | 'crouch';
type RangeMode = 'close' | 'mid' | 'long';

interface DragAttempt {
  outcome: 'HEADSHOT' | 'BODY LOCK' | 'OVERSHOOT' | 'MISS';
  velocityPxPerSec: number;
  angleDeg: number;
  liftPx: number;
  advice: string;
}

interface WeaponSpec {
  id: WeaponId;
  name: string;
  category: string;
  idealSpeedMin: number;
  idealSpeedMax: number;
  idealLiftMin: number;
  idealLiftMax: number;
  technique: string;
}

const WEAPONS: WeaponSpec[] = [
  {
    id: 'm1887',
    name: 'M1887',
    category: 'Shotgun · One-Tap',
    idealSpeedMin: 650,
    idealSpeedMax: 1550,
    idealLiftMin: 75,
    idealLiftMax: 175,
    technique: 'Fast J-Drag or straight upward flick, then quick weapon switch.',
  },
  {
    id: 'deagle',
    name: 'Desert Eagle',
    category: 'Pistol · One-Tap',
    idealSpeedMin: 580,
    idealSpeedMax: 1350,
    idealLiftMin: 70,
    idealLiftMax: 160,
    technique: 'Start crosshair slightly below chest, flick straight up at ~90°.',
  },
  {
    id: 'mp40',
    name: 'MP40',
    category: 'SMG · Continuous Drag',
    idealSpeedMin: 420,
    idealSpeedMax: 1050,
    idealLiftMin: 85,
    idealLiftMax: 185,
    technique: 'Steady continuous upward pull over 180-250ms to ride spread into head.',
  },
  {
    id: 'woodpecker',
    name: 'Woodpecker',
    category: 'Marksman · Snap',
    idealSpeedMin: 500,
    idealSpeedMax: 1200,
    idealLiftMin: 60,
    idealLiftMax: 145,
    technique: 'Controlled medium drag; avoid over-flicking past the crown.',
  },
  {
    id: 'scar',
    name: 'SCAR',
    category: 'AR · Mid Drag',
    idealSpeedMin: 380,
    idealSpeedMax: 980,
    idealLiftMin: 75,
    idealLiftMax: 165,
    technique: 'Short 3-4 round burst while holding steady upward drag pressure.',
  },
];

export const DragHeadshotLab: React.FC<DragHeadshotLabProps> = ({
  sensitivity,
  fireButtonSize,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [weaponId, setWeaponId] = useState<WeaponId>('m1887');
  const [targetMode, setTargetMode] = useState<TargetMode>('stationary');
  const [rangeMode, setRangeMode] = useState<RangeMode>('mid');
  const [lastAttempt, setLastAttempt] = useState<DragAttempt | null>(null);
  const [stats, setStats] = useState({
    headshots: 0,
    bodyLocks: 0,
    overshoots: 0,
    misses: 0,
  });
  const [imgFallbackRange, setImgFallbackRange] = useState(false);
  const [imgFallbackGrip, setImgFallbackGrip] = useState(false);

  const dragStateRef = useRef<{
    active: boolean;
    points: { x: number; y: number; t: number }[];
    targetX: number;
    targetDir: number;
    crouchOffset: number;
    impactPoint: { x: number; y: number; color: string; ttl: number } | null;
  }>({
    active: false,
    points: [],
    targetX: 280,
    targetDir: 1,
    crouchOffset: 0,
    impactPoint: null,
  });

  const activeWeapon = WEAPONS.find((w) => w.id === weaponId) ?? WEAPONS[0];

  const getGeometry = useCallback(
    (width: number, height: number) => {
      const scale = rangeMode === 'close' ? 1.18 : rangeMode === 'mid' ? 0.92 : 0.7;
      const baseY = height * 0.56;
      const targetX = dragStateRef.current.targetX;
      const crouchY = targetMode === 'crouch' ? dragStateRef.current.crouchOffset : 0;

      const headRadius = 17 * scale;
      const headY = baseY - 68 * scale + crouchY;
      const chestY = baseY - 25 * scale + crouchY;
      const chestWidth = 42 * scale;
      const chestHeight = 56 * scale;

      const fireBtnRadius = Math.max(24, Math.min(44, fireButtonSize * 0.65));
      const fireBtnX = width - 78;
      const fireBtnY = height - 72;

      return {
        scale,
        targetX,
        headY,
        headRadius,
        chestY,
        chestWidth,
        chestHeight,
        fireBtnX,
        fireBtnY,
        fireBtnRadius,
      };
    },
    [fireButtonSize, rangeMode, targetMode]
  );

  // Animation loop for live target movement & drag trail rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let lastTime = performance.now();

    const render = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const width = canvas.width;
      const height = canvas.height;
      const state = dragStateRef.current;

      // Update target movement
      if (targetMode === 'strafing') {
        state.targetX += state.targetDir * 115 * dt;
        if (state.targetX > width * 0.62) {
          state.targetX = width * 0.62;
          state.targetDir = -1;
        } else if (state.targetX < width * 0.24) {
          state.targetX = width * 0.24;
          state.targetDir = 1;
        }
      } else {
        state.targetX = width * 0.42;
      }

      if (targetMode === 'crouch') {
        state.crouchOffset = Math.sin(now / 360) > 0.15 ? 24 : 0;
      } else {
        state.crouchOffset = 0;
      }

      // Clear background
      ctx.fillStyle = '#090C12';
      ctx.fillRect(0, 0, width, height);

      // Subtle range grid
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
      ctx.lineWidth = 1;
      for (let gx = 40; gx < width; gx += 48) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, height);
        ctx.stroke();
      }
      for (let gy = 40; gy < height; gy += 48) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(width, gy);
        ctx.stroke();
      }

      // Horizon line
      ctx.strokeStyle = 'rgba(249, 115, 22, 0.22)';
      ctx.beginPath();
      ctx.moveTo(0, height * 0.64);
      ctx.lineTo(width, height * 0.64);
      ctx.stroke();

      const g = getGeometry(width, height);

      // Draw Target Silhouette (Chest + Head)
      ctx.fillStyle = 'rgba(51, 65, 85, 0.75)';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(
        g.targetX - g.chestWidth / 2,
        g.chestY,
        g.chestWidth,
        g.chestHeight,
        6
      );
      ctx.fill();
      ctx.stroke();

      // Head Hitbox
      ctx.fillStyle = 'rgba(249, 115, 22, 0.22)';
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(g.targetX, g.headY, g.headRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Crosshair resting at chest level
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 1.5;
      const crossY = g.chestY + g.chestHeight * 0.35;
      ctx.beginPath();
      ctx.arc(g.targetX, crossY, 9, 0, Math.PI * 2);
      ctx.stroke();

      // Fire Button Zone
      ctx.fillStyle = state.active
        ? 'rgba(249, 115, 22, 0.32)'
        : 'rgba(249, 115, 22, 0.14)';
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(g.fireBtnX, g.fireBtnY, g.fireBtnRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fdba74';
      ctx.font = '600 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('DRAG UP', g.fireBtnX, g.fireBtnY + 3);

      // Render active/recent drag trail
      if (state.points.length > 1) {
        ctx.strokeStyle = '#fb923c';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(state.points[0].x, state.points[0].y);
        for (let i = 1; i < state.points.length; i++) {
          ctx.lineTo(state.points[i].x, state.points[i].y);
        }
        ctx.stroke();
      }

      // Render simulated impact marker
      if (state.impactPoint && state.impactPoint.ttl > 0) {
        state.impactPoint.ttl -= dt;
        ctx.fillStyle = state.impactPoint.color;
        ctx.beginPath();
        ctx.arc(state.impactPoint.x, state.impactPoint.y, 6, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [getGeometry, targetMode]);

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = getCanvasCoords(e);
    dragStateRef.current.active = true;
    dragStateRef.current.points = [{ x: pt.x, y: pt.y, t: performance.now() }];
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragStateRef.current.active) return;
    const pt = getCanvasCoords(e);
    dragStateRef.current.points.push({ x: pt.x, y: pt.y, t: performance.now() });
  };

  const evaluateDrag = () => {
    const state = dragStateRef.current;
    if (!state.active) return;
    state.active = false;

    const pts = state.points;
    const canvas = canvasRef.current;
    if (!canvas || pts.length < 2) {
      setLastAttempt({
        outcome: 'MISS',
        velocityPxPerSec: 0,
        angleDeg: 0,
        liftPx: 0,
        advice: 'Tap-and-drag upward in one smooth motion instead of tapping statically.',
      });
      setStats((s) => ({ ...s, misses: s.misses + 1 }));
      return;
    }

    const start = pts[0];
    const end = pts[pts.length - 1];
    const dx = end.x - start.x;
    const dy = start.y - end.y; // Positive when dragging upward
    const durationSec = Math.max(0.03, (end.t - start.t) / 1000);
    const distance = Math.hypot(dx, dy);
    const velocity = Math.round(distance / durationSec);
    const angleDeg = Math.round((Math.atan2(dy, Math.abs(dx) + 0.001) * 180) / Math.PI);

    // Sensitivity scales virtual crosshair travel
    const sensFactor = 0.65 + (sensitivity.general / 200) * 0.6;
    const effectiveLift = Math.round(dy * sensFactor);
    const g = getGeometry(canvas.width, canvas.height);

    let outcome: DragAttempt['outcome'] = 'MISS';
    let advice = '';
    let impactColor = '#94a3b8';
    let impactY = g.chestY;

    if (dy < 22 || angleDeg < 38) {
      outcome = 'MISS';
      impactColor = '#94a3b8';
      impactY = g.chestY + 20;
      advice =
        'Drag direction was too horizontal or short. Pull cleanly upward toward the top edge of your screen.';
      setStats((s) => ({ ...s, misses: s.misses + 1 }));
    } else if (
      effectiveLift < activeWeapon.idealLiftMin ||
      velocity < activeWeapon.idealSpeedMin
    ) {
      outcome = 'BODY LOCK';
      impactColor = '#f59e0b';
      impactY = g.chestY + 8;
      advice = `Swipe speed (${velocity} px/s) was slightly slow for ${activeWeapon.name}. Flick upward faster or raise General sensitivity by +8.`;
      setStats((s) => ({ ...s, bodyLocks: s.bodyLocks + 1 }));
    } else if (
      effectiveLift > activeWeapon.idealLiftMax ||
      velocity > activeWeapon.idealSpeedMax
    ) {
      outcome = 'OVERSHOOT';
      impactColor = '#ef4444';
      impactY = g.headY - g.headRadius - 14;
      advice = `Flick (${velocity} px/s) passed above the head hitbox. Shorten your upward swipe or reduce Red Dot by -6.`;
      setStats((s) => ({ ...s, overshoots: s.overshoots + 1 }));
    } else {
      outcome = 'HEADSHOT';
      impactColor = '#10b981';
      impactY = g.headY;
      advice = `Clean head lock at ${angleDeg}° and ${velocity} px/s. Repeat this exact muscle memory rhythm.`;
      setStats((s) => ({ ...s, headshots: s.headshots + 1 }));
    }

    state.impactPoint = {
      x: g.targetX + dx * 0.15,
      y: impactY,
      color: impactColor,
      ttl: 1.6,
    };

    setLastAttempt({
      outcome,
      velocityPxPerSec: velocity,
      angleDeg: Math.max(0, angleDeg),
      liftPx: Math.round(dy),
      advice,
    });
  };

  const totalAttempts =
    stats.headshots + stats.bodyLocks + stats.overshoots + stats.misses;
  const hsRate =
    totalAttempts > 0 ? Math.round((stats.headshots / totalAttempts) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* Range Banner Header */}
      <section className="relative overflow-hidden rounded-xl border border-slate-800/90 bg-[#111622]">
        {!imgFallbackRange ? (
          <img
            src="/src/assets/images/range_target_backdrop_1795262014934.jpg"
            alt="Tactical indoor firing range calibration bay"
            referrerPolicy="no-referrer"
            onError={() => setImgFallbackRange(true)}
            className="absolute inset-0 h-full w-full object-cover opacity-35"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-[#111622] to-orange-950/20" />
        )}
        <div className="relative bg-gradient-to-r from-[#0B0E14]/95 via-[#0B0E14]/80 to-[#0B0E14]/65 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-orange-400">
                Interactive Drag Calibration
              </p>
              <h2 className="mt-1 text-2xl font-bold text-white">
                Drag Headshot Practice Lab
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-300">
                Practice your upward thumb/mouse flick directly on the simulator using your active General ({sensitivity.general}) and Fire Button ({fireButtonSize}%) calibration.
              </p>
            </div>
            <div className="flex items-center gap-6 font-mono">
              <div>
                <p className="text-[11px] text-slate-400">Headshot Rate</p>
                <p className="text-2xl font-bold text-emerald-400">{hsRate}%</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-400">Total Drills</p>
                <p className="text-2xl font-bold text-white">{totalAttempts}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Simulator Split */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12 items-start">
        {/* Left: Interactive Canvas (7 cols) */}
        <div className="xl:col-span-7 rounded-xl border border-slate-800/90 bg-[#111622] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
            <div className="flex flex-wrap gap-1 rounded-lg bg-[#0B0E14] p-1 border border-slate-800">
              {WEAPONS.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setWeaponId(w.id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    weaponId === w.id
                      ? 'bg-orange-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {w.name}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setStats({ headshots: 0, bodyLocks: 0, overshoots: 0, misses: 0 });
                setLastAttempt(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors whitespace-nowrap"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Drills
            </button>
          </div>

          <div className="relative overflow-hidden rounded-lg border border-slate-800 bg-[#090C12]">
            <canvas
              ref={canvasRef}
              width={640}
              height={380}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={evaluateDrag}
              onPointerCancel={evaluateDrag}
              className="w-full h-auto touch-none cursor-crosshair block"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-200">Target Motion:</span>
              {(['stationary', 'strafing', 'crouch'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setTargetMode(m)}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    targetMode === m
                      ? 'bg-slate-700 text-white'
                      : 'bg-[#0B0E14] text-slate-400 hover:text-white'
                  }`}
                >
                  {m === 'stationary'
                    ? 'Standing'
                    : m === 'strafing'
                      ? 'Strafing'
                      : 'Crouch-Peek'}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-200">Distance:</span>
              {(['close', 'mid', 'long'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRangeMode(r)}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    rangeMode === r
                      ? 'bg-slate-700 text-white'
                      : 'bg-[#0B0E14] text-slate-400 hover:text-white'
                  }`}
                >
                  {r === 'close' ? '8m' : r === 'mid' ? '22m' : '40m'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Live Shot Diagnostics & Technique Guide (5 cols) */}
        <div className="xl:col-span-5 space-y-6">
          <div className="rounded-xl border border-slate-800/90 bg-[#111622] p-5">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div>
                <h3 className="text-base font-semibold text-white">
                  {activeWeapon.name} Drag Diagnostics
                </h3>
                <p className="text-xs text-slate-400">{activeWeapon.category}</p>
              </div>
              <Crosshair className="h-5 w-5 text-orange-400" />
            </div>

            {lastAttempt ? (
              <div className="mt-4 space-y-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-slate-400">Shot Outcome</span>
                  <span
                    className={`font-mono text-lg font-bold ${
                      lastAttempt.outcome === 'HEADSHOT'
                        ? 'text-emerald-400'
                        : lastAttempt.outcome === 'BODY LOCK'
                          ? 'text-amber-400'
                          : lastAttempt.outcome === 'OVERSHOOT'
                            ? 'text-rose-400'
                            : 'text-slate-400'
                    }`}
                  >
                    {lastAttempt.outcome}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 rounded-lg border border-slate-800 bg-[#0B0E14] p-3">
                  <div>
                    <p className="text-[11px] text-slate-400">Velocity</p>
                    <p className="mt-0.5 font-mono text-sm font-bold text-white">
                      {lastAttempt.velocityPxPerSec} px/s
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400">Drag Angle</p>
                    <p className="mt-0.5 font-mono text-sm font-bold text-white">
                      {lastAttempt.angleDeg}°
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400">Upward Lift</p>
                    <p className="mt-0.5 font-mono text-sm font-bold text-white">
                      {lastAttempt.liftPx} px
                    </p>
                  </div>
                </div>

                <p className="text-xs leading-relaxed text-slate-300">
                  {lastAttempt.advice}
                </p>
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-slate-800 bg-[#0B0E14] p-4">
                <p className="text-xs leading-relaxed text-slate-300">
                  Place your finger or cursor on the <strong className="text-orange-400">DRAG UP</strong> button inside the range canvas and swipe swiftly upward to analyze your {activeWeapon.name} drag curve.
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  Target rhythm: {activeWeapon.technique}
                </p>
              </div>
            )}

            {/* Session Tally */}
            <div className="mt-5 grid grid-cols-4 gap-2 border-t border-slate-800/80 pt-4 text-center font-mono">
              <div>
                <p className="text-[11px] text-slate-400">Head</p>
                <p className="mt-0.5 text-base font-bold text-emerald-400">
                  {stats.headshots}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-400">Body</p>
                <p className="mt-0.5 text-base font-bold text-amber-400">
                  {stats.bodyLocks}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-400">Over</p>
                <p className="mt-0.5 text-base font-bold text-rose-400">
                  {stats.overshoots}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-400">Miss</p>
                <p className="mt-0.5 text-base font-bold text-slate-300">
                  {stats.misses}
                </p>
              </div>
            </div>
          </div>

          {/* Hardware Ergonomics & Drag Patterns */}
          <div className="rounded-xl border border-slate-800/90 bg-[#111622] overflow-hidden">
            <div className="aspect-[4/3] w-full bg-[#0B0E14] relative overflow-hidden">
              {!imgFallbackGrip ? (
                <img
                  src="/src/assets/images/tactical_grip_ergonomics_1795262015650.jpg"
                  alt="Matte black gaming smartphone hardware setup for claw grip drag control"
                  referrerPolicy="no-referrer"
                  onError={() => setImgFallbackGrip(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-900 to-[#0B0E14]">
                  <Target className="h-10 w-10 text-orange-500/60" />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#111622] via-[#111622]/60 to-transparent p-4">
                <p className="text-xs font-semibold text-white">
                  Three Proven Drag Headshot Patterns
                </p>
              </div>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div className="border-b border-slate-800/70 pb-2.5">
                <p className="font-semibold text-white">1. Straight Up Drag (15m–35m)</p>
                <p className="mt-0.5 text-slate-400">
                  Rest crosshair on the chest before firing, then pull straight toward 12 o&apos;clock. Best for SCAR, Woodpecker, and stationary targets.
                </p>
              </div>
              <div className="border-b border-slate-800/70 pb-2.5">
                <p className="font-semibold text-white">2. J-Curve Drag (Strafing Targets)</p>
                <p className="mt-0.5 text-slate-400">
                  Flick slightly down-left or down-right toward the enemy&apos;s foot direction, then curve sharply upward into the head.
                </p>
              </div>
              <div>
                <p className="font-semibold text-white">3. Rotation Drag (&lt;8m Close Shotgun)</p>
                <p className="mt-0.5 text-slate-400">
                  Sweep the fire button in a quick C-arc around the target side to break close-range chest aim-assist lock with M1887.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
