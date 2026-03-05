import { useState, useEffect, useRef, useCallback, memo } from 'react'

const ROWS = 10
const COLS = 17
const TARGET_SUM = 10
const GAME_DURATION = 120
const COMBO_TIMEOUT_MS = 2500

function initGrid() {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({
      value: Math.floor(Math.random() * 9) + 1,
      isCleared: false,
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

// ---------- Tile ----------
const Tile = memo(function Tile({ value, isCleared, isSelected, isValid }) {
  if (isCleared) {
    return <div style={styles.tileOuter} />
  }
  return (
    <div style={styles.tileOuter}>
      <div
        style={{
          ...styles.tileInner,
          background: isSelected
            ? (isValid ? 'linear-gradient(135deg, #ffb300 0%, #ff8c00 100%)' : 'linear-gradient(135deg, #ffe566 0%, #ffd000 100%)')
            : 'linear-gradient(135deg, #ffe566 0%, #ffc200 55%, #e8a800 100%)',
          boxShadow: isSelected
            ? (isValid ? '0 0 10px rgba(255,140,0,0.9), inset 0 1px 2px rgba(255,255,255,0.4)' : '0 0 8px rgba(255,220,0,0.7), inset 0 1px 2px rgba(255,255,255,0.3)')
            : '0 2px 5px rgba(0,0,0,0.45), inset 0 1px 3px rgba(255,255,255,0.45)',
          transform: isSelected ? 'scale(1.1)' : 'scale(1)',
          color: isSelected ? (isValid ? '#3d1400' : '#5a3800') : '#5a3000',
        }}
      >
        {value}
      </div>
    </div>
  )
})

// ---------- Main ----------
export default function LemonGame() {
  const [grid, setGrid] = useState(() => initGrid())
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
  const [gameStatus, setGameStatus] = useState('idle') // 'idle' | 'playing' | 'over'
  const [combo, setCombo] = useState(0)
  const [drag, setDrag] = useState(null)
  const [floats, setFloats] = useState([]) // [{ id, points, pct: {left,top} }]

  const gridRef = useRef(null)
  const timerRef = useRef(null)
  const comboTimerRef = useRef(null)
  const floatIdRef = useRef(0)
  const gridStateRef = useRef(grid)
  const comboRef = useRef(combo)

  // Keep refs in sync so pointer handlers always see fresh values
  useEffect(() => { gridStateRef.current = grid }, [grid])
  useEffect(() => { comboRef.current = combo }, [combo])

  // Timer
  useEffect(() => {
    if (gameStatus !== 'playing') return
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          setGameStatus('over')
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [gameStatus])

  const startGame = useCallback(() => {
    clearInterval(timerRef.current)
    clearTimeout(comboTimerRef.current)
    setGrid(initGrid())
    setScore(0)
    setTimeLeft(GAME_DURATION)
    setCombo(0)
    setDrag(null)
    setFloats([])
    setGameStatus('playing')
  }, [])

  // ---- Pointer helpers ----
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

    const currentGrid = gridStateRef.current
    let sum = 0
    const tiles = []
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        if (!currentGrid[r][c].isCleared) {
          sum += currentGrid[r][c].value
          tiles.push({ r, c })
        }
      }
    }

    if (sum === TARGET_SUM && tiles.length > 0) {
      // Clear tiles
      setGrid(prev => {
        const next = prev.map(row => row.map(cell => ({ ...cell })))
        tiles.forEach(({ r, c }) => { next[r][c].isCleared = true })
        return next
      })

      // Score + combo
      const newCombo = comboRef.current + 1
      const points = tiles.length * newCombo
      setScore(prev => prev + points)
      setCombo(newCombo)
      clearTimeout(comboTimerRef.current)
      comboTimerRef.current = setTimeout(() => setCombo(0), COMBO_TIMEOUT_MS)

      // Floating score
      const id = ++floatIdRef.current
      const leftPct = `${minCol / COLS * 100}%`
      const topPct = `${minRow / ROWS * 100}%`
      setFloats(prev => [...prev, { id, points, leftPct, topPct }])
      setTimeout(() => setFloats(prev => prev.filter(f => f.id !== id)), 900)
    }

    setDrag(null)
  }, [drag])

  // ---- Derived values for render ----
  const bounds = getBounds(drag)

  let selectionSum = 0
  if (bounds) {
    for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
      for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
        if (!grid[r][c].isCleared) selectionSum += grid[r][c].value
      }
    }
  }
  const isValid = selectionSum === TARGET_SUM

  const overlayStyle = bounds ? {
    left:   `${bounds.minCol / COLS * 100}%`,
    top:    `${bounds.minRow / ROWS * 100}%`,
    width:  `${(bounds.maxCol - bounds.minCol + 1) / COLS * 100}%`,
    height: `${(bounds.maxRow - bounds.minRow + 1) / ROWS * 100}%`,
  } : null

  // Timer color
  const timerColor = timeLeft <= 10 ? '#ff4444' : timeLeft <= 30 ? '#ffaa00' : '#7fff7f'
  const timerAnim = timeLeft <= 10 ? 'timerWarning 1s ease infinite' : 'none'
  const timeStr = `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`

  return (
    <div style={styles.root}>
      {/* ── Header ── */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={{ fontSize: 20 }}>🍋</span>
          <span style={styles.logoText}>LEMON</span>
        </div>

        <div style={styles.headerRight}>
          {combo >= 2 && (
            <div style={styles.comboTag}>
              {combo}x COMBO!
            </div>
          )}
          <div style={styles.statBox}>
            <span style={styles.statLabel}>SCORE</span>
            <span style={styles.statValue}>{score}</span>
          </div>
          <div style={styles.statBox}>
            <span style={styles.statLabel}>TIME</span>
            <span style={{ ...styles.statValue, color: timerColor, animation: timerAnim }}>
              {timeStr}
            </span>
          </div>
        </div>
      </header>

      {/* ── Grid area ── */}
      <div style={styles.gridWrapper}>
        <div
          ref={gridRef}
          style={styles.grid}
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
                />
              )
            })
          )}

          {/* Selection rectangle overlay */}
          {overlayStyle && (
            <div
              style={{
                ...styles.selectionOverlay,
                ...overlayStyle,
                borderColor: isValid ? '#ff8c00' : 'rgba(255,220,50,0.75)',
                background: isValid ? 'rgba(255,140,0,0.13)' : 'rgba(255,220,50,0.06)',
              }}
            >
              {/* Sum badge */}
              {selectionSum > 0 && (
                <div
                  style={{
                    ...styles.sumBadge,
                    background: isValid ? '#ff8c00' : 'rgba(30,30,30,0.85)',
                    color: isValid ? '#fff' : '#ccc',
                  }}
                >
                  {selectionSum}{isValid ? ' ✓' : ''}
                </div>
              )}
            </div>
          )}

          {/* Floating score labels */}
          {floats.map(f => (
            <div
              key={f.id}
              style={{
                ...styles.floatScore,
                left: f.leftPct,
                top:  f.topPct,
              }}
            >
              +{f.points}
            </div>
          ))}
        </div>
      </div>

      {/* ── Idle overlay ── */}
      {gameStatus === 'idle' && (
        <div style={styles.overlay}>
          <div style={{ ...styles.card, animation: 'popIn 0.35s ease' }}>
            <div style={{ fontSize: 52, marginBottom: 6 }}>🍋</div>
            <h1 style={styles.cardTitle}>레몬 게임</h1>
            <p style={styles.cardDesc}>
              드래그로 합이 <b style={{ color: '#ffe066' }}>10</b>이 되는<br />
              숫자들을 선택해 지워보세요!<br />
              <span style={{ fontSize: 11, color: '#888', marginTop: 4, display: 'block' }}>
                많이 지울수록 · 연속일수록 고득점
              </span>
            </p>
            <button onClick={startGame} style={styles.btn}>시작하기</button>
          </div>
        </div>
      )}

      {/* ── Game Over overlay ── */}
      {gameStatus === 'over' && (
        <div style={styles.overlay}>
          <div style={{ ...styles.card, animation: 'popIn 0.35s ease' }}>
            <div style={{ fontSize: 44, marginBottom: 6 }}>🍋</div>
            <h2 style={styles.cardTitle}>게임 종료!</h2>
            <p style={{ ...styles.cardDesc, marginBottom: 6 }}>최종 점수</p>
            <div style={styles.finalScore}>{score.toLocaleString()}</div>
            <button onClick={startGame} style={styles.btn}>다시하기</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---- Styles ----
const styles = {
  root: {
    width: '100dvw',
    height: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    background: 'linear-gradient(160deg, #0d1b2a 0%, #1a2838 100%)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 14px',
    height: 46,
    flexShrink: 0,
    background: 'rgba(0,0,0,0.45)',
    borderBottom: '1px solid rgba(255,220,50,0.18)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
  },
  logoText: {
    color: '#ffe066',
    fontWeight: 800,
    fontSize: 17,
    letterSpacing: '2px',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 18,
  },
  comboTag: {
    color: '#ff9900',
    fontWeight: 800,
    fontSize: 13,
    animation: 'pulse 0.5s ease infinite',
    textShadow: '0 0 8px rgba(255,153,0,0.7)',
  },
  statBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 1,
  },
  statLabel: {
    color: '#888',
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: '1px',
  },
  statValue: {
    color: '#fff',
    fontWeight: 800,
    fontSize: 19,
    lineHeight: 1,
  },
  gridWrapper: {
    flex: 1,
    padding: '4px 6px',
    minHeight: 0,
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
    padding: '1.5px',
  },
  tileInner: {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: 'clamp(9px, 1.55vw, 19px)',
    transition: 'transform 0.08s ease, background 0.08s ease, box-shadow 0.08s ease',
    userSelect: 'none',
  },
  selectionOverlay: {
    position: 'absolute',
    border: '2.5px solid',
    borderRadius: 5,
    pointerEvents: 'none',
    zIndex: 10,
    boxSizing: 'border-box',
    transition: 'border-color 0.1s, background 0.1s',
  },
  sumBadge: {
    position: 'absolute',
    top: -22,
    left: '50%',
    transform: 'translateX(-50%)',
    borderRadius: 5,
    padding: '2px 8px',
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
  },
  floatScore: {
    position: 'absolute',
    color: '#ffcc00',
    fontWeight: 900,
    fontSize: 22,
    pointerEvents: 'none',
    zIndex: 20,
    animation: 'floatUp 0.9s ease-out forwards',
    textShadow: '0 2px 6px rgba(0,0,0,0.9)',
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
    background: 'linear-gradient(135deg, #1a2a3a 0%, #0d1b2a 100%)',
    border: '1px solid rgba(255,220,50,0.28)',
    borderRadius: 18,
    padding: '24px 36px',
    textAlign: 'center',
    maxWidth: 320,
    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
  },
  cardTitle: {
    color: '#ffe066',
    fontSize: 26,
    fontWeight: 900,
    marginBottom: 10,
  },
  cardDesc: {
    color: '#aaa',
    fontSize: 13,
    lineHeight: 1.7,
    marginBottom: 20,
  },
  finalScore: {
    color: '#fff',
    fontSize: 46,
    fontWeight: 900,
    marginBottom: 20,
    textShadow: '0 2px 12px rgba(255,220,50,0.4)',
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
    transition: 'transform 0.1s ease',
  },
}
