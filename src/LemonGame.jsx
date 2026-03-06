import { useState, useEffect, useRef, useCallback, memo } from 'react'

const ROWS = 10
const COLS = 17
const TARGET_SUM = 10
const GAME_DURATION = 120
const COMBO_TIMEOUT_MS = 2500
const GOLDEN_CHANCE = 0.10

function getSizeBonus(count) {
  if (count >= 7) return 40
  if (count >= 6) return 25
  if (count >= 5) return 15
  if (count >= 4) return 8
  if (count >= 3) return 3
  return 0
}
function getSizeLabel(count) {
  if (count >= 7) return 'AMAZING'
  if (count >= 6) return 'AWESOME'
  if (count >= 5) return 'GREAT'
  if (count >= 4) return 'NICE'
  if (count >= 3) return 'GOOD'
  return null
}

function findClearableAreas(grid) {
  const val = Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: COLS }, (_, c) => (grid[r][c].isCleared ? 0 : grid[r][c].value))
  )
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

  const selected = []
  for (const area of areas) {
    const overlaps = selected.some(s =>
      !(area.maxRow < s.minRow || area.minRow > s.maxRow ||
        area.maxCol < s.minCol || area.minCol > s.maxCol)
    )
    if (!overlaps) {
      selected.push(area)
      if (selected.length >= 20) break
    }
  }
  return selected
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

// Golden sparkle burst
function GoldenBurst({ leftPct, topPct }) {
  return (
    <>
      {[0, 45, 90, 135, 180, 225, 270, 315].map(angle => (
        <div key={angle} style={{
          position: 'absolute', left: leftPct, top: topPct,
          width: 0, height: 0,
          transform: `rotate(${angle}deg)`, transformOrigin: '0 0',
          pointerEvents: 'none', zIndex: 30,
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: 'radial-gradient(circle, #fff 0%, #ffd700 55%, #ff9500 100%)',
            animation: 'goldenSparkle 0.65s ease-out forwards',
          }} />
        </div>
      ))}
    </>
  )
}

// ── Tile ──────────────────────────────────────────────────────────────────────
const Tile = memo(function Tile({ value, isCleared, isSelected, isValid, isGolden }) {
  let bg, shadow, textColor, border

  if (isGolden) {
    bg = isSelected
      ? (isValid
        ? 'linear-gradient(145deg, #ffe76b 0%, #ffa820 100%)'
        : 'linear-gradient(145deg, #f0c050 0%, #d08010 100%)')
      : 'linear-gradient(145deg, #ffd24a 0%, #f07820 100%)'
    shadow = '0 1px 3px rgba(0,0,0,0.14), 0 1px 2px rgba(0,0,0,0.08)'
    textColor = '#3d1400'
    border = '1px solid rgba(160,70,0,0.18)'
  } else {
    bg = isSelected
      ? (isValid
        ? 'linear-gradient(145deg, #6494f7 0%, #2d62ef 100%)'
        : 'linear-gradient(145deg, #b8b8cc 0%, #9898ae 100%)')
      : 'linear-gradient(145deg, #eaebf2 0%, #d8dae8 100%)'
    shadow = '0 1px 3px rgba(0,0,0,0.10), 0 1px 2px rgba(0,0,0,0.06)'
    textColor = isSelected && isValid ? '#fff' : '#2c2c3e'
    border = '1px solid rgba(0,0,0,0.08)'
  }

  return (
    <div style={S.tileOuter}>
      <div style={{
        ...S.tileInner,
        background: isCleared ? 'transparent' : bg,
        boxShadow: isCleared ? 'none' : shadow,
        border: isCleared ? 'none' : border,
        color: isCleared ? 'transparent' : textColor,
        transform: isCleared ? 'scale(0)' : (isSelected ? 'scale(1.08)' : 'scale(1)'),
        opacity: isCleared ? 0 : 1,
      }}>
        {!isCleared && value}
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
  const [displayScore, setDisplayScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
  const [gameStatus, setGameStatus] = useState('idle')
  const [combo, setCombo] = useState(0)
  const [drag, setDrag] = useState(null)
  const [floats, setFloats] = useState([])
  const [bursts, setBursts] = useState([])
  const [clearEffects, setClearEffects] = useState([])
  const [clearableAreas, setClearableAreas] = useState([])

  const gridRef = useRef(null)
  const timerRef = useRef(null)
  const comboTimerRef = useRef(null)
  const effectIdRef = useRef(0)
  const gridStateRef = useRef(grid)
  const comboRef = useRef(combo)
  const rafRef = useRef(null)
  const displayScoreRef = useRef(0)

  useEffect(() => { gridStateRef.current = grid }, [grid])
  useEffect(() => { comboRef.current = combo }, [combo])

  // ── Score count-up animation — fixed 650ms to match scorePop CSS ──
  useEffect(() => {
    const startVal = displayScoreRef.current
    const endVal = score
    if (startVal === endVal) return
    const startTime = performance.now()
    const tick = (now) => {
      const t = Math.min((now - startTime) / 650, 1)
      const eased = 1 - (1 - t) * (1 - t) // ease-out quad
      const val = Math.round(startVal + (endVal - startVal) * eased)
      displayScoreRef.current = val
      setDisplayScore(val)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [score])

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
    cancelAnimationFrame(rafRef.current)
    setGrid(initGrid())
    setScore(0); setDisplayScore(0); setTimeLeft(GAME_DURATION); setCombo(0)
    setDrag(null); setFloats([]); setBursts([]); setClearEffects([]); setClearableAreas([])
    setGameStatus('playing')
  }, [])

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
          tiles.push({ r, c, isGolden: g[r][c].isGolden })
          if (g[r][c].isGolden) goldenCount++
        }

    if (sum === TARGET_SUM && tiles.length > 0) {
      setGrid(prev => {
        const next = prev.map(row => row.map(cell => ({ ...cell })))
        tiles.forEach(({ r, c }) => { next[r][c].isCleared = true })
        return next
      })

      const newCombo = comboRef.current + 1
      const sizeBonus = getSizeBonus(tiles.length)
      const goldenBonus = goldenCount * 30
      const basePoints = tiles.length * newCombo
      setScore(prev => prev + basePoints + sizeBonus + goldenBonus)
      setCombo(newCombo)
      clearTimeout(comboTimerRef.current)
      comboTimerRef.current = setTimeout(() => setCombo(0), COMBO_TIMEOUT_MS)

      // ── Per-tile clear pop effects ──
      const eid = ++effectIdRef.current
      const tileEffects = tiles.map(({ r, c, isGolden }) => ({
        id: `${eid}-${r}-${c}`,
        leftPct: `${c / COLS * 100}%`,
        topPct: `${r / ROWS * 100}%`,
        isGolden,
      }))
      setClearEffects(prev => [...prev, ...tileEffects])
      setTimeout(() => {
        const ids = new Set(tileEffects.map(t => t.id))
        setClearEffects(prev => prev.filter(e => !ids.has(e.id)))
      }, 450)

      // ── Float labels ──
      const leftPct = `${minCol / COLS * 100}%`
      const topPct = `${minRow / ROWS * 100}%`
      const id = ++effectIdRef.current
      const lines = [{ text: `+${basePoints}`, color: '#1d4ed8', size: 22 }]
      const sizeLabel = getSizeLabel(tiles.length)
      if (sizeLabel && sizeBonus > 0)
        lines.push({ text: `${sizeLabel}  +${sizeBonus}`, color: '#c2410c', size: 13 })
      if (goldenBonus > 0)
        lines.push({ text: `GOLDEN  +${goldenBonus}`, color: '#92400e', size: 13 })

      setFloats(prev => [...prev, { id, lines, leftPct, topPct }])
      setTimeout(() => setFloats(prev => prev.filter(f => f.id !== id)), 1100)

      if (goldenBonus > 0) {
        const bid = ++effectIdRef.current
        setBursts(prev => [...prev, { id: bid, leftPct, topPct }])
        setTimeout(() => setBursts(prev => prev.filter(b => b.id !== bid)), 700)
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

  const timerPct = timeLeft / GAME_DURATION * 100
  const timerColor = timeLeft <= 10 ? '#ef4444' : timeLeft <= 30 ? '#f59e0b' : '#22c55e'

  // Tile border-radius in vw to match tile's 20% of (100vw/17) = ~1.18vw
  const HINT_RADIUS = '1.2vw'

  return (
    <div style={S.root}>

      {/* ── Header ── */}
      <header style={S.header}>
        {/* Timer progress bar */}
        <div style={{
          position: 'absolute',
          bottom: 0, left: 0,
          height: 4,
          width: gameStatus === 'playing' ? `${timerPct}%` : (gameStatus === 'idle' ? '100%' : '0%'),
          background: timerColor,
          transition: 'width 1s linear, background 0.5s',
          borderRadius: '0 2px 0 0',
        }} />

        {/* Score — centered, with pop animation */}
        <div style={S.headerCenter}>
          {combo >= 2 && <div style={S.comboTag}>{combo}x COMBO!</div>}
          <div
            key={score}
            style={{ ...S.scoreValue, animation: score > 0 ? 'scorePop 650ms ease-out' : 'none' }}
          >
            {displayScore.toLocaleString()}
          </div>
        </div>

        {/* Restart button */}
        {gameStatus === 'over' && (
          <button onClick={startGame} style={S.restartBtn}>다시하기</button>
        )}
      </header>

      {/* ── Grid ── */}
      <div style={S.gridWrapper}>
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

          {/* Per-tile clear pop effects */}
          {clearEffects.map(e => (
            <div key={e.id} style={{
              position: 'absolute',
              left: e.leftPct,
              top: e.topPct,
              width: `${100 / COLS}%`,
              height: `${100 / ROWS}%`,
              boxSizing: 'border-box',
              border: `2.5px solid ${e.isGolden ? '#f59e0b' : '#6494f7'}`,
              borderRadius: HINT_RADIUS,
              animation: 'clearPop 0.4s ease-out forwards',
              pointerEvents: 'none',
              zIndex: 15,
            }} />
          ))}

          {/* Clearable area hints (game over) */}
          {gameStatus === 'over' && clearableAreas.map((area, i) => {
            const big = area.count >= 5
            const mid = area.count >= 3
            const hue = big ? 142 : mid ? 217 : 25
            return (
              <div key={i} style={{
                position: 'absolute',
                left:   `${area.minCol / COLS * 100}%`,
                top:    `${area.minRow / ROWS * 100}%`,
                width:  `${(area.maxCol - area.minCol + 1) / COLS * 100}%`,
                height: `${(area.maxRow - area.minRow + 1) / ROWS * 100}%`,
                border: `2px solid hsla(${hue}, 72%, 48%, 0.75)`,
                background: `hsla(${hue}, 65%, 55%, 0.12)`,
                borderRadius: HINT_RADIUS,
                boxSizing: 'border-box',
                pointerEvents: 'none',
                zIndex: 5,
              }} />
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
              border: `2.5px solid ${isValid ? '#3b82f6' : 'rgba(100,100,140,0.45)'}`,
              background: isValid ? 'rgba(59,130,246,0.10)' : 'rgba(100,100,140,0.04)',
              borderRadius: HINT_RADIUS,
              boxSizing: 'border-box',
              pointerEvents: 'none',
              zIndex: 10,
              transition: 'border-color 0.1s, background 0.1s',
            }}>
              {selectionSum > 0 && (
                <div style={{
                  position: 'absolute',
                  top: -34,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: isValid ? '#3b82f6' : 'rgba(40,40,60,0.88)',
                  color: '#fff',
                  borderRadius: 6,
                  padding: '4px 10px',
                  fontSize: 13,
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  fontFamily: "'Pretendard', system-ui, sans-serif",
                }}>
                  {selectionSum}{isValid ? ' ✓' : ''}
                  <div style={{
                    position: 'absolute',
                    bottom: -7, left: '50%',
                    transform: 'translateX(-50%)',
                    width: 0, height: 0,
                    borderLeft: '7px solid transparent',
                    borderRight: '7px solid transparent',
                    borderTop: `7px solid ${isValid ? '#3b82f6' : 'rgba(40,40,60,0.88)'}`,
                  }} />
                </div>
              )}
            </div>
          )}

          {/* Floating score labels */}
          {floats.map(f => (
            <div key={f.id} style={{
              position: 'absolute',
              left: f.leftPct, top: f.topPct,
              display: 'flex', flexDirection: 'column',
              alignItems: 'flex-start', gap: 1,
              pointerEvents: 'none', zIndex: 20,
              animation: 'floatUp 1.1s ease-out forwards',
              whiteSpace: 'nowrap',
              fontFamily: "'Pretendard', system-ui, sans-serif",
            }}>
              {f.lines.map((ln, i) => (
                <span key={i} style={{
                  color: ln.color, fontWeight: 900, fontSize: ln.size,
                  textShadow: '0 1px 3px rgba(255,255,255,0.9)',
                }}>{ln.text}</span>
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
              드래그로 합이 <b style={{ color: '#ea580c' }}>10</b>이 되는<br />
              숫자들을 선택해 지워보세요!
            </p>
            <div style={S.ruleList}>
              <div>많이 지울수록 보너스</div>
              <div>연속 클리어 콤보</div>
              <div>황금 레몬을 찾아라</div>
            </div>
            <button onClick={startGame} style={S.btn}>시작하기</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const FONT = "'Pretendard', system-ui, -apple-system, sans-serif"

const S = {
  root: {
    width: '100dvw',
    height: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    background: '#f2f2f7',
    overflow: 'hidden',
    fontFamily: FONT,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: '0 14px',
    height: 46,
    flexShrink: 0,
    background: '#ffffff',
    borderBottom: '1px solid rgba(0,0,0,0.08)',
    position: 'relative',
  },
  headerCenter: {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 0,
    lineHeight: 1,
  },
  comboTag: {
    color: '#ea580c',
    fontWeight: 800,
    fontSize: 11,
    animation: 'pulse 0.5s ease infinite',
    fontFamily: FONT,
  },
  scoreValue: {
    color: '#1c1c1e',
    fontWeight: 800,
    fontSize: 20,
    lineHeight: 1,
    fontFamily: FONT,
    display: 'inline-block',
    transformOrigin: 'center',
  },
  restartBtn: {
    background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
    border: 'none',
    borderRadius: 8,
    padding: '6px 16px',
    fontSize: 13,
    fontWeight: 800,
    color: '#3d1800',
    cursor: 'pointer',
    flexShrink: 0,
    fontFamily: FONT,
  },
  gridWrapper: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: `repeat(${COLS}, 1fr)`,
    gridTemplateRows: `repeat(${ROWS}, 1fr)`,
    aspectRatio: `${COLS} / ${ROWS}`,
    width: `min(100%, calc((100dvh - 46px) * ${(COLS / ROWS).toFixed(4)}))`,
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
    aspectRatio: '1',
    borderRadius: '20%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 900,
    fontSize: 'clamp(10px, 1.8vw, 22px)',
    fontFamily: FONT,
    position: 'relative',
    userSelect: 'none',
    transition: 'transform 0.12s ease, opacity 0.12s ease, background 0.08s, box-shadow 0.08s',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.30)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    backdropFilter: 'blur(6px)',
  },
  card: {
    background: '#ffffff',
    border: '1px solid rgba(0,0,0,0.09)',
    borderRadius: 20,
    padding: '24px 32px',
    textAlign: 'center',
    maxWidth: 300,
    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
    fontFamily: FONT,
  },
  cardTitle: { color: '#ea580c', fontSize: 26, fontWeight: 900, marginBottom: 10 },
  cardDesc: { color: '#6b7280', fontSize: 13, lineHeight: 1.7, marginBottom: 14 },
  ruleList: { color: '#9ca3af', fontSize: 12, lineHeight: 2.2, marginBottom: 18 },
  btn: {
    background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
    border: 'none',
    borderRadius: 10,
    padding: '11px 36px',
    fontSize: 16,
    fontWeight: 800,
    color: '#3d1800',
    cursor: 'pointer',
    fontFamily: FONT,
  },
}
