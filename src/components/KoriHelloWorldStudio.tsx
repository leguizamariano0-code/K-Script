import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Mic, 
  MicOff, 
  Download, 
  Upload, 
  Play, 
  Pause, 
  RotateCcw, 
  ShieldCheck, 
  Sliders, 
  Code, 
  Copy, 
  Check, 
  Volume2, 
  Layers, 
  Activity,
  Cpu,
  Share2
} from 'lucide-react';
import { simular_estado_sensorial } from '../lib/lyapunov';
import {
  serializeKokoV2Canonical,
  importKokoV2Canonical,
  buildManifestFromState,
  type State8D,
} from '../lib/kokoV2Canonical';

const DEFAULT_STATE: State8D = {
  conceptual: 0.40,
  temporal: 0.15,
  espacial: 0.50,
  causal: 0.20,
  etica: 0.95,
  energetica: 0.10,
  resonancia: 0.528,
  incertidumbre: 0.08
};

const SOLFEGGIO_FREQS = [
  { hz: 174, norm: 0.174, name: '174 Hz — Base & Estabilidad' },
  { hz: 285, norm: 0.285, name: '285 Hz — Regeneración Tisular' },
  { hz: 396, norm: 0.396, name: '396 Hz — Liberación' },
  { hz: 417, norm: 0.417, name: '417 Hz — Transmutación' },
  { hz: 432, norm: 0.432, name: '432 Hz — Afinación Universal' },
  { hz: 528, norm: 0.528, name: '528 Hz — Reparación & Milagro' },
  { hz: 639, norm: 0.639, name: '639 Hz — Conexión & Unidad' },
  { hz: 741, norm: 0.741, name: '741 Hz — Despertar Intuitivo' },
  { hz: 852, norm: 0.852, name: '852 Hz — Orden Espiritual' },
  { hz: 963, norm: 0.963, name: '963 Hz — Conciencia Cósmica' },
];

export default function KoriHelloWorldStudio() {
  const [state8D, setState8D] = useState<State8D>(DEFAULT_STATE);
  const [isListeningMic, setIsListeningMic] = useState(false);
  const [detectedHz, setDetectedHz] = useState<number | null>(null);
  const [closestSolfeggio, setClosestSolfeggio] = useState<string>('528 Hz — Reparación');
  const [isAnimating, setIsAnimating] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [kokoCode, setKokoCode] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [lyapunovData, setLyapunovData] = useState<{
    estable: boolean;
    traza: number;
    spectrum: number[];
    norma: number;
  }>({
    estable: true,
    traza: -0.92,
    spectrum: [-0.096, -0.120, -0.110, -0.130, -0.100, -0.150, -0.100, -0.123],
    norma: 0.98
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timeRef = useRef<number>(0);

  // Recompute stability & Lyapunov whenever state changes
  useEffect(() => {
    try {
      const resJson = simular_estado_sensorial(
        state8D.conceptual,
        state8D.temporal,
        state8D.espacial,
        state8D.causal,
        state8D.etica,
        state8D.energetica,
        state8D.resonancia,
        state8D.incertidumbre,
        100,
        0.01
      );
      const res = JSON.parse(resJson);
      setLyapunovData({
        estable: res.estable,
        traza: res.traza_jacobiano ?? -0.9,
        spectrum: res.espectro_lyapunov ?? [-0.09, -0.12, -0.11, -0.13, -0.10, -0.15, -0.10, -0.12],
        norma: res.norma_final ?? 0.98
      });
    } catch {
      // Fallback safe simulation
    }
  }, [state8D]);

  // Fase 7: serialización canónica v2.0 (round-trip verificable con kScriptV2)
  useEffect(() => {
    const manifest = buildManifestFromState(state8D);
    setKokoCode(serializeKokoV2Canonical(manifest));
  }, [state8D]);

  // Audio Microphone Pitch Detection
  const toggleMicrophone = async () => {
    if (isListeningMic) {
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(t => t.stop());
        micStreamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      setIsListeningMic(false);
      setDetectedHz(null);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        micStreamRef.current = stream;
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioCtx;
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        analyserRef.current = analyser;
        setIsListeningMic(true);
      } catch (err) {
        console.error('Error al acceder al micrófono:', err);
      }
    }
  };

  // Mic Pitch Detection Loop
  useEffect(() => {
    let animId: number;
    const buffer = new Float32Array(2048);

    const detectPitch = () => {
      if (isListeningMic && analyserRef.current && audioContextRef.current) {
        analyserRef.current.getFloatTimeDomainData(buffer);
        
        // Auto-correlation algorithm for fundamental frequency
        let bestOffset = -1;
        let bestCorrelation = 0;
        let rms = 0;
        for (let i = 0; i < buffer.length; i++) {
          const val = buffer[i];
          rms += val * val;
        }
        rms = Math.sqrt(rms / buffer.length);

        if (rms > 0.015) { // Sound threshold
          for (let offset = 20; offset < 1000; offset++) {
            let correlation = 0;
            for (let i = 0; i < buffer.length - offset; i++) {
              correlation += buffer[i] * buffer[i + offset];
            }
            if (correlation > bestCorrelation) {
              bestCorrelation = correlation;
              bestOffset = offset;
            }
          }

          if (bestOffset > 0 && audioContextRef.current) {
            const freq = audioContextRef.current.sampleRate / bestOffset;
            if (freq >= 80 && freq <= 1200) {
              setDetectedHz(Math.round(freq));
              const normResonance = Math.min(0.99, Math.max(0.1, freq / 1000));
              setState8D(prev => ({ ...prev, resonancia: parseFloat(normResonance.toFixed(3)) }));

              // Find closest Solfeggio
              let minDiff = Infinity;
              let closest = SOLFEGGIO_FREQS[0];
              for (const sf of SOLFEGGIO_FREQS) {
                const diff = Math.abs(sf.hz - freq);
                if (diff < minDiff) {
                  minDiff = diff;
                  closest = sf;
                }
              }
              setClosestSolfeggio(closest.name);
            }
          }
        }
      }
      animId = requestAnimationFrame(detectPitch);
    };

    if (isListeningMic) {
      animId = requestAnimationFrame(detectPitch);
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [isListeningMic]);

  // Barnsley & Biotic IFS Fractal Rendering Engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;

    const render = () => {
      frame++;
      timeRef.current += 0.01 * (0.2 + state8D.temporal * 1.5);
      const t = timeRef.current;

      const w = canvas.width;
      const h = canvas.height;

      // Dark Pro Tool Background with subtle glow
      ctx.fillStyle = 'rgba(29, 29, 27, 0.35)'; // High-contrast pro dark
      ctx.fillRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h * 0.82;

      // Parameters mapped from 8D state
      const depth = Math.floor(6 + state8D.conceptual * 6);
      const branchAngle = 0.35 + state8D.causal * 0.45 + Math.sin(t * 0.5) * 0.05;
      const lengthScale = 0.68 + state8D.espacial * 0.12;
      const initialLength = (h * 0.28) * (0.8 + state8D.espacial * 0.3);
      const resonanceGlow = state8D.resonancia * 1000;
      const jitter = state8D.incertidumbre * 0.08;
      const ethicsAura = state8D.etica; // >= 0.85

      // Recursive Fractal Biotic Tree / Barnsley IFS
      const drawBranch = (
        x: number,
        y: number,
        length: number,
        angle: number,
        currentDepth: number,
        branchIndex: number
      ) => {
        if (currentDepth <= 0 || length < 2) return;

        const xEnd = x + Math.sin(angle) * length;
        const yEnd = y - Math.cos(angle) * length;

        // Color based on Solfeggio resonance + depth + ethical aura (#af9aca / #e94e5a / amber #f59e0b)
        const hueRatio = (currentDepth / depth + state8D.resonancia + Math.sin(t + branchIndex) * 0.1) % 1;
        
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(xEnd, yEnd);

        ctx.lineWidth = Math.max(1, currentDepth * 0.9 * (1 + state8D.energetica * 0.8));

        if (ethicsAura >= 0.90) {
          // Pure Koko Lila (#af9aca) and Rosa (#e94e5a) with Solfeggio Amber
          if (currentDepth % 2 === 0) {
            ctx.strokeStyle = `rgba(175, 154, 202, ${0.4 + (currentDepth / depth) * 0.6})`;
          } else {
            ctx.strokeStyle = `rgba(233, 78, 90, ${0.35 + (currentDepth / depth) * 0.55})`;
          }
        } else {
          ctx.strokeStyle = `rgba(245, 158, 11, ${0.4 + (currentDepth / depth) * 0.5})`;
        }

        ctx.shadowBlur = 8 * ethicsAura;
        ctx.shadowColor = '#af9aca';
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Leaf / Biotic spore particles at endpoints
        if (currentDepth <= 2) {
          ctx.beginPath();
          const sporeRadius = 2 + state8D.energetica * 4 + Math.sin(t * 3 + branchIndex) * 1.5;
          ctx.arc(xEnd, yEnd, Math.max(1, sporeRadius), 0, Math.PI * 2);
          ctx.fillStyle = ethicsAura >= 0.90 ? 'rgba(233, 78, 90, 0.8)' : 'rgba(245, 158, 11, 0.8)';
          ctx.fill();
        }

        // Left and right recursive branches with harmonic asymmetry
        const angleJitter = (Math.sin(t * 2 + currentDepth) * jitter);
        const leftAngle = angle - branchAngle * (1 + state8D.causal * 0.3) + angleJitter;
        const rightAngle = angle + branchAngle * (1 - state8D.causal * 0.2) + angleJitter;
        const harmonicShrink = lengthScale * (0.95 + Math.sin(resonanceGlow * 0.01 + currentDepth) * 0.05);

        drawBranch(xEnd, yEnd, length * harmonicShrink, leftAngle, currentDepth - 1, branchIndex * 2);
        drawBranch(xEnd, yEnd, length * harmonicShrink, rightAngle, currentDepth - 1, branchIndex * 2 + 1);

        // Third center branch if high complexity (conceptual >= 0.5)
        if (state8D.conceptual >= 0.5 && currentDepth % 2 === 0) {
          const centerAngle = angle + Math.sin(t + currentDepth) * 0.1;
          drawBranch(xEnd, yEnd, length * harmonicShrink * 0.8, centerAngle, currentDepth - 1, branchIndex * 3);
        }
      };

      drawBranch(cx, cy, initialLength, 0, depth, 1);

      if (isAnimating) {
        animFrameRef.current = requestAnimationFrame(render);
      }
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [state8D, isAnimating]);

  const handleSliderChange = (dim: keyof State8D, val: number) => {
    setState8D(prev => {
      const next = { ...prev, [dim]: val };
      // Enforce constitutional invariant
      if (dim === 'etica') {
        next.etica = Math.max(0.85, Math.min(0.99, val));
      }
      return next;
    });
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(kokoCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadKoko = () => {
    const blob = new Blob([kokoCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'hello_world_v2.koko';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Fase 7: importación canónica v2.0 (kScriptV2.parse + evaluate)
  const handleImportKoko = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputEl = e.target;
    const file = inputEl.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      const result = importKokoV2Canonical(content);
      if (!result) {
        setImportError('Archivo .koko no válido o no parseable por el motor v2.0');
        return;
      }
      setImportError(null);
      setState8D(result.manifest.state8D);
    } catch (err) {
      console.error('Error al importar .koko:', err);
      setImportError('No se pudo leer el archivo .koko seleccionado');
    } finally {
      inputEl.value = '';
    }
  };

  const resetToCanonical = () => {
    setImportError(null);
    setState8D(DEFAULT_STATE);
  };

  return (
    <div className="min-h-screen bg-[#E3E0D2] text-[#1D1D1B] font-['Nunito',sans-serif] p-4 md:p-8 select-none">
      {/* Top Pro Header */}
      <div className="max-w-7xl mx-auto mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-[#af9aca]/30 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#af9aca] text-white flex items-center justify-center shadow-md font-black text-xl">
              K
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#1D1D1B] flex items-center gap-2">
                Kori Hello World <span className="text-xs uppercase px-2.5 py-0.5 rounded-full bg-[#af9aca]/20 text-[#1D1D1B] border border-[#af9aca]/40 font-semibold tracking-wider">.koko v2.0</span>
              </h1>
              <p className="text-xs text-[#1D1D1B]/70 font-medium">
                Visualizador Fractal Reactivo Biótico — Ontología Holográfica de 5 Capas sin Llaves
              </p>
            </div>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={toggleMicrophone}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
              isListeningMic 
                ? 'bg-[#e94e5a] text-white animate-pulse shadow-[#e94e5a]/30' 
                : 'bg-white/80 hover:bg-white text-[#1D1D1B] border border-[#af9aca]/40'
            }`}
          >
            {isListeningMic ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            {isListeningMic ? `Escuchando: ${detectedHz ? `${detectedHz} Hz` : 'Detectando...'}` : 'Activar Micrófono'}
          </button>

          <button
            onClick={() => setIsAnimating(!isAnimating)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-white/80 hover:bg-white text-[#1D1D1B] border border-[#af9aca]/40 shadow-sm transition-all"
          >
            {isAnimating ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isAnimating ? 'Pausar' : 'Reanudar'}
          </button>

          <button
            onClick={resetToCanonical}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-white/80 hover:bg-white text-[#1D1D1B] border border-[#af9aca]/40 shadow-sm transition-all"
            title="Restablecer al Hello World Canónico"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>

          <button
            onClick={() => setShowCodeModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#af9aca] text-white hover:bg-[#9e88ba] shadow-sm transition-all"
          >
            <Code className="w-4 h-4" />
            Ver Código .koko
          </button>

          <button
            onClick={handleDownloadKoko}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#1D1D1B] text-white hover:bg-black shadow-md transition-all"
          >
            <Download className="w-4 h-4" />
            Exportar .koko v2.0
          </button>

          <label className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-white/80 hover:bg-white text-[#1D1D1B] border border-[#af9aca]/40 shadow-sm cursor-pointer transition-all">
            <Upload className="w-4 h-4" />
            Importar
            <input type="file" accept=".koko,.txt" onChange={handleImportKoko} className="hidden" />
          </label>
        </div>
      </div>

      {importError && (
        <div className="max-w-7xl mx-auto mb-4 bg-[#e94e5a]/10 border border-[#e94e5a]/40 text-[#1D1D1B] rounded-2xl px-4 py-3 flex items-center justify-between gap-3 text-xs font-semibold shadow-sm">
          <span className="text-[#e94e5a] font-bold">{importError}</span>
          <button
            onClick={() => setImportError(null)}
            className="px-2.5 py-1 rounded-lg bg-white/80 hover:bg-white text-[#1D1D1B] border border-[#e94e5a]/30 transition-all"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Main Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Visualizador Fractal 8D (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="relative rounded-2xl overflow-hidden bg-[#1D1D1B] border border-[#af9aca]/30 shadow-xl aspect-square md:aspect-[4/3] flex items-center justify-center">
            <canvas 
              ref={canvasRef} 
              width={800} 
              height={600} 
              className="w-full h-full object-contain"
            />

            {/* Top Overlay Badge */}
            <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-white text-xs">
              <Sparkles className="w-3.5 h-3.5 text-[#af9aca]" />
              <span className="font-semibold">Fractal Biótico Barnsley IFS</span>
              <span className="text-[#af9aca]">•</span>
              <span className="text-white/70">8D Resonante</span>
            </div>

            {/* Live Audio Frequency Indicator */}
            {isListeningMic && (
              <div className="absolute bottom-4 left-4 right-4 bg-black/70 backdrop-blur-md p-3 rounded-xl border border-[#e94e5a]/40 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-[#e94e5a] animate-ping" />
                  <div>
                    <div className="text-xs font-bold text-[#e94e5a]">Micrófono Activo</div>
                    <div className="text-xs text-white/90">{closestSolfeggio}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-mono font-bold text-white">{detectedHz ?? 528} Hz</div>
                  <div className="text-[10px] text-white/60">Modulando Resonancia (ω)</div>
                </div>
              </div>
            )}
          </div>

          {/* Constitutional Invariant Banner */}
          <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 border border-[#af9aca]/40 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-[#1D1D1B]">Invariante Ética Constitucional</div>
                <div className="text-xs text-[#1D1D1B]/70">
                  η = <span className="font-mono font-bold text-emerald-600">{state8D.etica.toFixed(3)}</span> (Límite Canónico: [0.85, 0.99])
                </div>
              </div>
            </div>

            <div className="text-right">
              {(() => {
                const isHealthy = lyapunovData.estable && lyapunovData.traza < 0;
                return (
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                      isHealthy
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-[#e94e5a]/15 text-[#e94e5a]'
                    }`}
                  >
                    {isHealthy ? '✅ Inmune & Estable' : '⚠️ Inestable'}
                  </span>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Right Column: 8D Sliders & Lyapunov Status (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-white/80 backdrop-blur-md rounded-2xl p-5 border border-[#af9aca]/40 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#af9aca]/20 pb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#1D1D1B] flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#af9aca]" />
                Espacio Semántico 8D
              </h2>
              <span
                className={`text-xs font-mono font-bold ${
                  lyapunovData.norma < 0.999 ? 'text-[#af9aca]' : 'text-[#e94e5a]'
                }`}
              >
                ‖x‖ = {lyapunovData.norma.toFixed(4)} {lyapunovData.norma < 0.999 ? '< 1.0' : '≥ 1.0'}
              </span>
            </div>

            {/* 8 Sliders */}
            <div className="space-y-3.5">
              {/* 1. Conceptual */}
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-[#1D1D1B]">1. Conceptual (Recursión / Ramas)</span>
                  <span className="font-mono text-[#af9aca]">{state8D.conceptual.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="0.95"
                  step="0.01"
                  value={state8D.conceptual}
                  onChange={e => handleSliderChange('conceptual', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-[#E3E0D2] rounded-lg appearance-none cursor-pointer accent-[#af9aca]"
                />
              </div>

              {/* 2. Temporal */}
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-[#1D1D1B]">2. Temporal (Ritmo / Velocidad)</span>
                  <span className="font-mono text-[#af9aca]">{state8D.temporal.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="0.95"
                  step="0.01"
                  value={state8D.temporal}
                  onChange={e => handleSliderChange('temporal', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-[#E3E0D2] rounded-lg appearance-none cursor-pointer accent-[#af9aca]"
                />
              </div>

              {/* 3. Espacial */}
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-[#1D1D1B]">3. Espacial (Escala Poincaré)</span>
                  <span className="font-mono text-[#af9aca]">{state8D.espacial.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="0.95"
                  step="0.01"
                  value={state8D.espacial}
                  onChange={e => handleSliderChange('espacial', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-[#E3E0D2] rounded-lg appearance-none cursor-pointer accent-[#af9aca]"
                />
              </div>

              {/* 4. Causal */}
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-[#1D1D1B]">4. Causal (Asimetría Direccional)</span>
                  <span className="font-mono text-[#af9aca]">{state8D.causal.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="0.90"
                  step="0.01"
                  value={state8D.causal}
                  onChange={e => handleSliderChange('causal', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-[#E3E0D2] rounded-lg appearance-none cursor-pointer accent-[#af9aca]"
                />
              </div>

              {/* 5. Ética */}
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-[#1D1D1B] flex items-center gap-1.5">
                    5. Ética (Luminiscencia Coherente) 
                    <span className="text-[10px] text-emerald-600 font-semibold">≥ 0.85</span>
                  </span>
                  <span className="font-mono text-emerald-600 font-bold">{state8D.etica.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.85"
                  max="0.99"
                  step="0.01"
                  value={state8D.etica}
                  onChange={e => handleSliderChange('etica', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-emerald-100 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                />
              </div>

              {/* 6. Energética */}
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-[#1D1D1B]">6. Energética (Densidad Esporas)</span>
                  <span className="font-mono text-[#af9aca]">{state8D.energetica.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.01"
                  max="0.90"
                  step="0.01"
                  value={state8D.energetica}
                  onChange={e => handleSliderChange('energetica', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-[#E3E0D2] rounded-lg appearance-none cursor-pointer accent-[#af9aca]"
                />
              </div>

              {/* 7. Resonancia */}
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-[#1D1D1B]">7. Resonancia (ω Solfeggio)</span>
                  <span className="font-mono text-[#e94e5a] font-bold">{(state8D.resonancia * 1000).toFixed(0)} Hz ({state8D.resonancia.toFixed(3)})</span>
                </div>
                <input
                  type="range"
                  min="0.174"
                  max="0.963"
                  step="0.001"
                  value={state8D.resonancia}
                  onChange={e => handleSliderChange('resonancia', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-rose-100 rounded-lg appearance-none cursor-pointer accent-[#e94e5a]"
                />
              </div>

              {/* 8. Incertidumbre */}
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-[#1D1D1B]">8. Incertidumbre (Dispersión)</span>
                  <span className="font-mono text-[#af9aca]">{state8D.incertidumbre.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="0.45"
                  step="0.01"
                  value={state8D.incertidumbre}
                  onChange={e => handleSliderChange('incertidumbre', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-[#E3E0D2] rounded-lg appearance-none cursor-pointer accent-[#af9aca]"
                />
              </div>
            </div>
          </div>

          {/* Lyapunov Spectrum Box */}
          <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 border border-[#af9aca]/40 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#1D1D1B] flex items-center gap-1.5">
                <Activity className={`w-3.5 h-3.5 ${lyapunovData.traza < 0 ? 'text-emerald-600' : 'text-[#e94e5a]'}`} />
                Espectro de Lyapunov (Benettin QR)
              </span>
              <span className={`text-xs font-mono font-bold ${lyapunovData.traza < 0 ? 'text-emerald-600' : 'text-[#e94e5a]'}`}>
                Tr(J) = {lyapunovData.traza.toFixed(3)} {lyapunovData.traza < 0 ? '< 0' : '≥ 0'}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5 font-mono text-[10px] text-center">
              {lyapunovData.spectrum.map((val, idx) => (
                <div key={idx} className="bg-[#E3E0D2] p-1.5 rounded-lg border border-[#af9aca]/20">
                  <div className="text-[9px] text-[#1D1D1B]/60">λ_{idx + 1}</div>
                  <div className={`font-bold ${val < 0 ? 'text-emerald-700' : 'text-[#e94e5a]'}`}>{val.toFixed(3)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Code Modal */}
      <AnimatePresence>
        {showCodeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-2xl w-full border border-[#af9aca]/40 shadow-2xl flex flex-col max-h-[85vh]"
            >
              <div className="flex items-center justify-between pb-4 border-b border-[#af9aca]/20">
                <div className="flex items-center gap-2">
                  <Code className="w-5 h-5 text-[#af9aca]" />
                  <h3 className="font-bold text-lg text-[#1D1D1B]">Código .koko v2.0 (Sintaxis Plana sin Llaves)</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#af9aca] text-white hover:bg-[#9e88ba] transition-all"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copiado' : 'Copiar'}
                  </button>
                  <button
                    onClick={() => setShowCodeModal(false)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#E3E0D2] hover:bg-[#d6d3c4] text-[#1D1D1B] transition-all"
                  >
                    Cerrar
                  </button>
                </div>
              </div>

              <div className="mt-4 flex-1 overflow-auto bg-[#1D1D1B] text-emerald-400 font-mono text-xs p-4 rounded-2xl border border-white/10 leading-relaxed select-text">
                <pre>{kokoCode}</pre>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs text-[#1D1D1B]/70">
                <span>Totalmente compatible con KoriVM y EBNF v2.0</span>
                <button
                  onClick={handleDownloadKoko}
                  className="text-xs font-bold text-[#1D1D1B] underline hover:text-[#af9aca]"
                >
                  Descargar como hello_world_v2.koko
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
