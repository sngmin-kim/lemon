import { useState, useEffect, useRef, useCallback, memo } from 'react'

const ROWS = 10
const COLS = 17
const TARGET_SUM = 10
const GAME_DURATION = 120
const COMBO_TIMEOUT_MS = 2500
const GOLDEN_CHANCE = 0.10

// Bonus points for clearing many tiles at once
function getSizeBonus(count) {
  if (count >= 7) return 40
  if (count >= 6) return 25
  if (count >= 5) return 15
  if (count >= 4) return 8
  if (count >= 3) return 3
  return 0
}
function getSizeLabel(count) {
  if (count >= 7) return '🔥 AMAZING'
  if (count >= 6) return '🔥 AWESOME'
  if (count >= 5) return '✨ GREAT'
  if (count >= 4) return '👍 NICE'
  if (count >= 3) return '💫 GOOD'
  return null
}

// Find all rectangular areas in the grid where non-cleared tile sum = 10
// Uses 2D prefix sums — O(ROWS² × COLS²), ~29k iters ≈ instant
function findClearableAreas(grid) {
  const val = Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: COLS }, (_, c) => (grid[r][c].isCleared ? 0 : grid[r][c].value))
  )
  // Build prefix sum for value and count of non-cleared tiles
  const PV = Array.from({ length: ROWS + 1 }, () => new Array(COLS + 1).fill(0))
  const PC = Array.from({ length: ROWS + 1 }, () => new Array(COLS + 1).fill(0))
  for (let r = 1; r <= ROWS; r++) {
    for (let c = 1; c <= COLS; c++) {
      const v = val[r - 1][c - 1]
      PV[r][c] = v + PV[r - 1][c] + PV[r][c - 1] - PV[r - 1][c - 1]
      PC[r][c] = (v > 0 ? 1 : 0) + PC[r - 1][c] + PC[r][c - 1] - PC[r - 1][c - 1]
    }
  }
  const q = (r1, c1, r2, c2, P) => P[r2 + 1][c2 + 1] - P[r1][c2 + 1] - P[r2 + 1][c1] + P[r1][c1]

  const areas = []
  for (let r1 = 0; r1 < ROWS; r1++)
    for (let c1 = 0; c1 < COLS; c1++)
      for (let r2 = r1; r2 < ROWS; r2++)
        for (let c2 = c1; c2 < COLS; c2++)
          if (q(r1, c1, r2, c2, PV) === TARGET_SUM) {
            const count = q(r1, c1, r2, c2, PC)
            if (count > 0) areas.push({ minRow: r1, maxRow: r2, minCol: c1, maxCol: c2, count })
          }

  areas.sort((a, b) => b.count - a.count)
  return areas.slice(0, 50) // keep top 50 by tile count
}

function initGrid() {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({
      value: Math.floor(Math.random() * 9) + 1,
      isCleared: false,
      isGolden: Math.random() < GOLDEN_CHANCE,
    }))
  )
}

function getBounds(drag) {
  if (!drag) return null
  return {
    minRow: Math.min(drag.startRow, drag.endRow),
    maxRow: Math.max(drag.startRow, drag.endRow),
    minCol: Math.min(drag.startCol, drag.endCol),
    maxCol: Math.max(drag.startCol, drag.endCol),
  }
}

// Radial sparkle burst for golden clears: 8 particles rotating outward
function GoldenBurst({ leftPct, topPct }) {
  return (
    <>
      {[0, 45, 90, 135, 180, 225, 270, 315].map(angle => (
        <div
          key={angle}
          style={{
            position: 'absolute',
            left: leftPct,
            top: topPct,
            width: 0,
            height: 0,
            transform: `rotate(${angle}deg)`,
            transformOrigin: '0 0',
            pointerEvents: 'none',
            zIndex: 30,
          }}
        >
          <div style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'radial-gradient(circle, #fff 0%, #ffd700 55%, #ff9500 100%)',
            boxShadow: '0 0 5px #ffd700',
            animation: 'goldenSparkle 0.65s ease-out forwards',
          }} />
        </div>
      ))}
    </>
  )
}

// ── Tile ──────────────────────────────────────────────────────────────────────
const Tile = memo(function Tile({ value, isCleared, isSelected, isValid, isGolden }) {
  let bg, shadow, textColor

  if (isGolden) {
    bg = isSelected
      ? (isValid
        ? 'linear-gradient(145deg, #fff59d 0%, #ffb300 100%)'
        : 'linear-gradient(145deg, #ffe082 0%, #ffa000 100%)')
      : 'linear-gradient(145deg, #ffd54f 0%, #e65100 100%)'
    shadow = isSelected
      ? `0 0 14px rgba(255,180,0,${isValid ? 1 : 0.6})`
      : '0 2px 6px rgba(0,0,0,0.55), inset 0 1px 2px rgba(255,255,255,0.35)'
    textColor = '#3d1400'
  } else {
    bg = isSelected
      ? (isValid
        ? 'linear-gradient(145deg, #7986cb 0%, #3949ab 100%)'
        : 'linear-gradient(145deg, #757575 0%, #424242 100%)')
      : 'linear-gradient(145deg, #62626e 0%, #3a3a46 100%)'
    shadow = isSelected
      ? (isValid
        ? '0 0 14px rgba(100,120,255,0.85)'
        : '0 0 8px rgba(160,160,160,0.5)')
      : '0 2px 5px rgba(0,0,0,0.55), inset 0 1px 2px rgba(255,255,255,0.07)'
    textColor = '#e8e8f2'
  }

  return (
    <div style={S.tileOuter}>
      <div
        style={{
          ...S.tileInner,
          background: isCleared ? 'transparent' : bg,
          boxShadow: isCleared ? 'none' : shadow,
          color: isCleared ? 'transparent' : textColor,
          transform: isCleared ? 'scale(0)' : (isSelected ? 'scale(1.1)' : 'scale(1)'),
          opacity: isCleared ? 0 : 1,
        }}
      >
        {!isCleared && value}
        {isGolden && !isCleared && <span style={S.goldenStar}>★</span>}
      </div>
    </div>
  )
}, (p, n) =>
  p.value === n.value &&
  p.isCleared === n.isCleared &&
  p.isSelected === n.isSelected &&
  p.isValid === n.isValid &&
  p.isGolden === n.isGolden
)

// ── Main component ────────────────────────────────────────────────────────────
export default function LemonGame() {
  const [grid, setGrid] = useState(() => initGrid())
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
  const [gameStatus, setGameStatus] = useState('idle') // 'idle' | 'playing' | 'over'
  const [combo, setCombo] = useState(0)
  const [drag, setDrag] = useState(null)
  const [floats, setFloats] = useState([])       // { id, lines:[{text,color,size}], leftPct, topPct }
  const [bursts, setBursts] = useState([])       // { id, leftPct, topPct }
  const [gridFlash, setGridFlash] = useState(null)
  const [clearableAreas, setClearableAreas] = useState([])

  const gridRef = useRef(null)
  const timerRef = useRef(null)
  const comboTimerRef = useRef(null)
  const effectIdRef = useRef(0)
  const gridStateRef = useRef(grid)
  const comboRef = useRef(combo)

  useEffect(() => { gridStateRef.current = grid }, [grid])
  useEffect(() => { comboRef.current = combo }, [combo])

  // ── Timer ──
  useEffect(() => {
    if (gameStatus !== 'playing') return
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); setGameStatus('over'); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [gameStatus])

  // ── Compute clearable areas when game ends ──
  useEffect(() => {
    if (gameStatus === 'over') {
      setClearableAreas(findClearableAreas(gridStateRef.current))
    }
  }, [gameStatus])

  const startGame = useCallback(() => {
    clearInterval(timerRef.current)
    clearTimeout(comboTimerRef.current)
    setGrid(initGrid())
    setScore(0); setTimeLeft(GAME_DURATION); setCombo(0)
    setDrag(null); setFloats([]); setBursts([]); setGridFlash(null); setClearableAreas([])
    setGameStatus('playing')
  }, [])

  // ── Pointer helpers ──
  const getCellFromPointer = useCallback((clientX, clientY) => {
    const el = gridRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const col = Math.floor((clientX - rect.left) / (rect.width / COLS))
    const row = Math.floor((clientY - rect.top) / (rect.height / ROWS))
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return null
    return { row, col }
  }, [])

  const handlePointerDown = useCallback((e) => {
    if (gameStatus !== 'playing') return
    e.preventDefault()
    const cell = getCellFromPointer(e.clientX, e.clientY)
    if (!cell) return
    setDrag({ startRow: cell.row, startCol: cell.col, endRow: cell.row, endCol: cell.col })
    gridRef.current?.setPointerCapture(e.pointerId)
  }, [gameStatus, getCellFromPointer])

  const handlePointerMove = useCallback((e) => {
    if (!drag) return
    e.preventDefault()
    const cell = getCellFromPointer(e.clientX, e.clientY)
    if (!cell) return
    setDrag(prev => prev ? { ...prev, endRow: cell.row, endCol: cell.col } : null)
  }, [drag, getCellFromPointer])

  const handlePointerUp = useCallback((e) => {
    if (!drag) return
    e.preventDefault()

    const bounds = getBounds(drag)
    if (!bounds) { setDrag(null); return }
    const { minRow, maxRow, minCol, maxCol } = bounds

    const g = gridStateRef.current
    let sum = 0, goldenCount = 0
    const tiles = []
    for (let r = minRow; r <= maxRow; r++)
      for (let c = minCol; c <= maxCol; c++)
        if (!g[r][c].isCleared) {
          sum += g[r][c].value
          tiles.push({ r, c })
          if (g[r][c].isGolden) goldenCount++
        }

    if (sum === TARGET_SUM && tiles.length > 0) {
      // Clear tiles
      setGrid(prev => {
        const next = prev.map(row => row.map(cell => ({ ...cell })))
        tiles.forEach(({ r, c }) => { next[r][c].isCleared = true })
        return next
      })

      // Score
      const newCombo = comboRef.current + 1
      const sizeBonus = getSizeBonus(tiles.length)
      const goldenBonus = goldenCount * 30
      const basePoints = tiles.length * newCombo
      setScore(prev => prev + basePoints + sizeBonus + goldenBonus)
      setCombo(newCombo)
      clearTimeout(comboTimerRef.current)
      comboTimerRef.current = setTimeout(() => setCombo(0), COMBO_TIMEOUT_MS)

      // ── Float label(s) ──
      const leftPct = `${minCol / COLS * 100}%`
      const topPct = `${minRow / ROWS * 100}%`
      const id = ++effectIdRef.current

      const lines = [{ text: `+${basePoints}`, color: '#ffe566', size: 22 }]
      const sizeLabel = getSizeLabel(tiles.length)
      if (sizeLabel && sizeBonus > 0)
        lines.push({ text: `${sizeLabel}  +${sizeBonus}`, color: '#ff9900', size: 13 })
      if (goldenBonus > 0)
        lines.push({ text: `⭐ GOLDEN  +${goldenBonus}`, color: '#ffd700', size: 13 })

      setFloats(prev => [...prev, { id, lines, leftPct, topPct }])
      setTimeout(() => setFloats(prev => prev.filter(f => f.id !== id)), 1100)

      // ── Flash ──
      if (goldenBonus > 0) {
        setGridFlash('rgba(255,215,0,0.22)')
        setTimeout(() => setGridFlash(null), 380)
        const bid = ++effectIdRef.current
        setBursts(prev => [...prev, { id: bid, leftPct, topPct }])
        setTimeout(() => setBursts(prev => prev.filter(b => b.id !== bid)), 700)
      } else if (tiles.length >= 5) {
        setGridFlash('rgba(100,110,255,0.18)')
        setTimeout(() => setGridFlash(null), 320)
      } else if (tiles.length >= 3) {
        setGridFlash('rgba(255,140,0,0.12)')
        setTimeout(() => setGridFlash(null), 250)
      }
    }

    setDrag(null)
  }, [drag])

  // ── Derived ──
  const bounds = getBounds(drag)
  let selectionSum = 0
  if (bounds) {
    for (let r = bounds.minRow; r <= bounds.maxRow; r++)
      for (let c = bounds.minCol; c <= bounds.maxCol; c++)
        if (!grid[r][c].isCleared) selectionSum += grid[r][c].value
  }
  const isValid = selectionSum === TARGET_SUM

  const timerColor = timeLeft <= 10 ? '#ff4444' : timeLeft <= 30 ? '#ffaa00' : '#7fff7f'
  const timerAnim = timeLeft <= 10 ? 'timerWarning 1s ease infinite' : 'none'
  const timeStr = `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`

  return (
    <div style={S.root}>

      {/* ── Header ── */}
      <header style={S.header}>
        <div style={S.headerLeft}>
          <span style={{ fontSize: 20 }}>🍋</span>
          <span style={S.logoText}>LEMON</span>
        </div>
        <div style={S.headerRight}>
          {combo >= 2 && <div style={S.comboTag}>{combo}x COMBO!</div>}
          <div style={S.statBox}>
            <span style={S.statLabel}>SCORE</span>
            <span style={S.statValue}>{score.toLocaleString()}</span>
          </div>
          <div style={S.statBox}>
            <span style={S.statLabel}>TIME</span>
            <span style={{ ...S.statValue, color: timerColor, animation: timerAnim }}>{timeStr}</span>
          </div>
        </div>
      </header>

      {/* ── Grid ── */}
      <div style={S.gridWrapper}>
        {gridFlash && (
          <div style={{ position: 'absolute', inset: 0, background: gridFlash, pointerEvents: 'none', zIndex: 25, borderRadius: 4 }} />
        )}

        <div
          ref={gridRef}
          style={S.grid}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {/* Tiles */}
          {grid.map((row, r) =>
            row.map((cell, c) => {
              const isSelected = !!(bounds &&
                r >= bounds.minRow && r <= bounds.maxRow &&
                c >= bounds.minCol && c <= bounds.maxCol &&
                !cell.isCleared)
              return (
                <Tile
                  key={`${r}-${c}`}
                  value={cell.value}
                  isCleared={cell.isCleared}
                  isSelected={isSelected}
                  isValid={isValid}
                  isGolden={cell.isGolden}
                />
              )
            })
          )}

          {/* Clearable area hints (game over only) */}
          {gameStatus === 'over' && clearableAreas.map((area, i) => {
            const big = area.count >= 5
            const mid = area.count >= 3
            const hue = big ? 142 : mid ? 210 : 0
            const alpha = big ? 0.55 : mid ? 0.42 : 0.30
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left:   `${area.minCol / COLS * 100}%`,
                  top:    `${area.minRow / ROWS * 100}%`,
                  width:  `${(area.maxCol - area.minCol + 1) / COLS * 100}%`,
                  height: `${(area.maxRow - area.minRow + 1) / ROWS * 100}%`,
                  border: `2px solid hsla(${hue}, 75%, 65%, ${alpha + 0.3})`,
                  background: `hsla(${hue}, 60%, 50%, ${alpha * 0.28})`,
                  borderRadius: 3,
                  boxSizing: 'border-box',
                  pointerEvents: 'none',
                  zIndex: 5,
                }}
              />
            )
          })}

          {/* Selection overlay */}
          {bounds && (
            <div style={{
              position: 'absolute',
              left:   `${bounds.minCol / COLS * 100}%`,
              top:    `${bounds.minRow / ROWS * 100}%`,
              width:  `${(bounds.maxCol - bounds.minCol + 1) / COLS * 100}%`,
              height: `${(bounds.maxRow - bounds.minRow + 1) / ROWS * 100}%`,
              border: `2.5px solid ${isValid ? '#7986cb' : 'rgba(180,180,200,0.65)'}`,
              background: isValid ? 'rgba(80,90,210,0.13)' : 'rgba(180,180,200,0.05)',
              borderRadius: 4,
              boxSizing: 'border-box',
              pointerEvents: 'none',
              zIndex: 10,
              transition: 'border-color 0.1s, background 0.1s',
            }}>
              {selectionSum > 0 && (
                <div style={{
                  position: 'absolute',
                  top: -22,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: isValid ? '#5c6bc0' : 'rgba(30,30,40,0.9)',
                  color: '#fff',
                  borderRadius: 5,
                  padding: '2px 8px',
                  fontSize: 12,
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                }}>
                  {selectionSum}{isValid ? ' ✓' : ''}
                </div>
              )}
            </div>
          )}

          {/* Floating score labels */}
          {floats.map(f => (
            <div key={f.id} style={{
              position: 'absolute',
              left: f.leftPct,
              top: f.topPct,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 1,
              pointerEvents: 'none',
              zIndex: 20,
              animation: 'floatUp 1.1s ease-out forwards',
              textShadow: '0 2px 6px rgba(0,0,0,0.9)',
              whiteSpace: 'nowrap',
            }}>
              {f.lines.map((ln, i) => (
                <span key={i} style={{ color: ln.color, fontWeight: 900, fontSize: ln.size }}>{ln.text}</span>
              ))}
            </div>
          ))}

          {/* Golden sparkle bursts */}
          {bursts.map(b => (
            <GoldenBurst key={b.id} leftPct={b.leftPct} topPct={b.topPct} />
          ))}
        </div>
      </div>

      {/* ── Idle overlay ── */}
      {gameStatus === 'idle' && (
        <div style={S.overlay}>
          <div style={{ ...S.card, animation: 'popIn 0.35s ease' }}>
            <div style={{ fontSize: 52, marginBottom: 8 }}>🍋</div>
            <h1 style={S.cardTitle}>레몬 게임</h1>
            <p style={S.cardDesc}>
              드래그로 합이 <b style={{ color: '#ffe066' }}>10</b>이 되는<br />
              숫자들을 선택해 지워보세요!
            </p>
            <div style={S.ruleList}>
              <div>많이 지울수록 보너스 ✨</div>
              <div>연속 클리어 콤보 🔥</div>
              <div>황금 레몬을 찾아라 ⭐</div>
            </div>
            <button onClick={startGame} style={S.btn}>시작하기</button>
          </div>
        </div>
      )}

      {/* ── Game Over overlay ── */}
      {gameStatus === 'over' && (
        <div style={{ ...S.overlay, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}>
          <div style={{ ...S.card, animation: 'popIn 0.35s ease' }}>
            <div style={{ fontSize: 44, marginBottom: 4 }}>🍋</div>
            <h2 style={S.cardTitle}>게임 종료!</h2>
            <p style={{ ...S.cardDesc, marginBottom: 4 }}>최종 점수</p>
            <div style={S.finalScore}>{score.toLocaleString()}</div>
            <div style={S.hintBox}>
              <span style={{ color: '#4fc3a1', fontWeight: 700 }}>
                {clearableAreas.length}
              </span>
              개의 영역을 더 지울 수 있었어요
              <div style={{ marginTop: 4, fontSize: 10, color: '#666' }}>
                🟩 5개+ &nbsp;&nbsp; 🟦 3–4개 &nbsp;&nbsp; ⬜ 1–2개
              </div>
            </div>
            <button onClick={startGame} style={S.btn}>다시하기</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes goldenSparkle {
          0%   { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-38px) scale(0.3); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  root: {
    width: '100dvw',
    height: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    background: 'linear-gradient(160deg, #0d1117 0%, #1c1c28 100%)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 14px',
    height: 46,
    flexShrink: 0,
    background: 'rgba(0,0,0,0.5)',
    borderBottom: '1px solid rgba(255,220,50,0.13)',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 7 },
  logoText: { color: '#ffe066', fontWeight: 800, fontSize: 17, letterSpacing: '2px' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 16 },
  comboTag: {
    color: '#ff9900', fontWeight: 800, fontSize: 13,
    animation: 'pulse 0.5s ease infinite',
    textShadow: '0 0 8px rgba(255,153,0,0.7)',
  },
  statBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 },
  statLabel: { color: '#666', fontSize: 9, fontWeight: 600, letterSpacing: '1px' },
  statValue: { color: '#fff', fontWeight: 800, fontSize: 19, lineHeight: 1 },
  gridWrapper: {
    flex: 1,
    padding: '4px 6px',
    minHeight: 0,
    position: 'relative',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: `repeat(${COLS}, 1fr)`,
    gridTemplateRows: `repeat(${ROWS}, 1fr)`,
    width: '100%',
    height: '100%',
    position: 'relative',
    touchAction: 'none',
    cursor: 'crosshair',
  },
  tileOuter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2px',
  },
  tileInner: {
    width: '100%',
    height: '100%',
    borderRadius: '20%',          // rounded square ★
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 900,
    fontSize: 'clamp(11px, 2vw, 24px)',   // bigger & bolder ★
    position: 'relative',
    userSelect: 'none',
    transition: 'transform 0.15s ease, opacity 0.15s ease, background 0.08s, box-shadow 0.08s',
  },
  goldenStar: {
    position: 'absolute',
    top: 2,
    right: 3,
    fontSize: '0.4em',
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 1,
    pointerEvents: 'none',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.72)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    backdropFilter: 'blur(5px)',
  },
  card: {
    background: 'linear-gradient(135deg, #1a1f30 0%, #0d1117 100%)',
    border: '1px solid rgba(255,220,50,0.22)',
    borderRadius: 18,
    padding: '22px 30px',
    textAlign: 'center',
    maxWidth: 300,
    boxShadow: '0 8px 32px rgba(0,0,0,0.65)',
  },
  cardTitle: { color: '#ffe066', fontSize: 26, fontWeight: 900, marginBottom: 10 },
  cardDesc: { color: '#aaa', fontSize: 13, lineHeight: 1.7, marginBottom: 14 },
  ruleList: { color: '#777', fontSize: 12, lineHeight: 2.1, marginBottom: 18 },
  hintBox: {
    color: '#888',
    fontSize: 12,
    lineHeight: 1.6,
    marginBottom: 18,
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    padding: '8px 12px',
  },
  finalScore: {
    color: '#fff',
    fontSize: 46,
    fontWeight: 900,
    marginBottom: 12,
    textShadow: '0 2px 12px rgba(255,220,50,0.35)',
  },
  btn: {
    background: 'linear-gradient(135deg, #ffe066 0%, #ffc200 100%)',
    border: 'none',
    borderRadius: 10,
    padding: '11px 36px',
    fontSize: 16,
    fontWeight: 800,
    color: '#3d1800',
    cursor: 'pointer',
    boxShadow: '0 3px 10px rgba(255,194,0,0.4)',
  },
}
