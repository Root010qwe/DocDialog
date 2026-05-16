import { useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import './LandingPage.css'

export default function LandingPage() {
  const token = useAuthStore(s => s.accessToken)
  const navigate = useNavigate()
  const navigatePhaseRef = useRef<((delta: number) => void) | null>(null)

  useEffect(() => {
    if (token) navigate('/collections', { replace: true })
  }, [token, navigate])

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    const resolvers: Array<() => void> = []
    let cancelled = false
    let tokenLoopRunning = false
    let pendingJump: number | null = null
    let currentPhaseIdx = 0

    const abortSleeps = () => {
      timers.forEach(clearTimeout)
      timers.length = 0
      const rs = resolvers.splice(0)
      rs.forEach(r => r())
    }

    const sleep = (ms: number) =>
      new Promise<void>(resolve => {
        if (cancelled || pendingJump !== null) { resolve(); return }
        const id = setTimeout(() => {
          const idx = resolvers.indexOf(resolve)
          if (idx >= 0) resolvers.splice(idx, 1)
          resolve()
        }, ms)
        timers.push(id)
        resolvers.push(resolve)
      })

    const reveals = document.querySelectorAll<Element>(
      '.landing-page [data-reveal], .landing-page [data-reveal-x]'
    )
    const revealIO = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('is-visible'); revealIO.unobserve(e.target) }
      })
    }, { threshold: 0.15 })
    reveals.forEach(el => revealIO.observe(el))

    const counters = document.querySelectorAll<HTMLElement>('.landing-page [data-count]')
    const counterIO = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return
        const el = e.target as HTMLElement
        const target = parseInt(el.dataset.count ?? '0', 10)
        const suffix = el.dataset.suffix ?? ''
        const duration = 900
        const start = performance.now()
        const ease = (t: number) => 1 - Math.pow(1 - t, 3)
        const step = (now: number) => {
          const p = Math.min(1, (now - start) / duration)
          el.textContent = Math.round(target * ease(p)) + suffix
          if (p < 1) requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
        counterIO.unobserve(el)
      })
    }, { threshold: 0.4 })
    counters.forEach(el => counterIO.observe(el))

    const streamTarget = document.getElementById('ld-stream-target')
    const streamDots   = document.getElementById('ld-stream-dots')
    const fullText = 'Согласно пункту 3.2 договора, срок поставки составляет 30 рабочих дней с момента подписания…'
    let streamIdx = 0
    let streamDir = 1

    const streamTick = () => {
      if (cancelled || !streamTarget) return
      if (streamDir === 1) {
        streamTarget.textContent = fullText.slice(0, streamIdx++)
        if (streamIdx > fullText.length) {
          if (streamDots) streamDots.style.opacity = '0'
          timers.push(setTimeout(() => { streamDir = -1; streamTick() }, 1800))
          return
        }
        timers.push(setTimeout(streamTick, 38 + Math.random() * 50))
      } else {
        if (streamDots) streamDots.style.opacity = '1'
        streamIdx = 0
        streamTarget.textContent = ''
        streamDir = 1
        timers.push(setTimeout(streamTick, 400))
      }
    }
    streamTick()

    const SVG_NS = 'http://www.w3.org/2000/svg'

    const heatRamp = [
      '#1e3a8a','#1e40af','#2f4ac4','#3b5bdb','#4f46e5',
      '#6366f1','#7c3aed','#8b5cf6','#a78bfa','#c4b5fd',
      '#ddd6fe','#e0e7ff','#eef2ff',
    ]
    const valColor = (v: number) =>
      heatRamp[heatRamp.length - 1 - Math.min(heatRamp.length - 1, Math.max(0, Math.floor(v * heatRamp.length)))]
    const pseudoRand = (seed: number) => { const x = Math.sin(seed) * 10000; return x - Math.floor(x) }

    const buildVectorStrip = (stripEl: Element, seed: number) => {
      const g = stripEl.querySelector('.vec-cells')
      if (!g) return
      g.innerHTML = ''
      for (let i = 0; i < 16; i++) {
        const r = document.createElementNS(SVG_NS, 'rect')
        r.setAttribute('x', String(i * 6)); r.setAttribute('y', '0')
        r.setAttribute('width', '6'); r.setAttribute('height', '22')
        r.setAttribute('rx', '0.5'); r.setAttribute('fill', valColor(pseudoRand(seed + i * 17.31)))
        r.setAttribute('class', 'vec-cell')
        g.appendChild(r)
      }
    }
    const vec1 = document.getElementById('ld-vec-1')
    const vec2 = document.getElementById('ld-vec-2')
    const vec3 = document.getElementById('ld-vec-3')
    if (vec1) buildVectorStrip(vec1, 1)
    if (vec2) buildVectorStrip(vec2, 73)
    if (vec3) buildVectorStrip(vec3, 211)

    const p1Chunks = [1,2,3].map(i => document.getElementById(`ld-p1-chunk-${i}`))
    const runPhase1 = async () => {
      p1Chunks.forEach(c => c?.classList.remove('shown'))
      await sleep(700)
      for (const c of p1Chunks) { if (cancelled) return; c?.classList.add('shown'); await sleep(220) }
      await sleep(1400)
    }

    const p2ResetCells = () =>
      document.querySelectorAll('#ld-phase-2 .vec-cell').forEach(c => c.classList.remove('shown'))
    const runPhase2 = async () => {
      p2ResetCells(); await sleep(500)
      for (let i = 0; i < 16; i++) {
        if (cancelled) return
        ;['ld-vec-1','ld-vec-2','ld-vec-3'].forEach(id => {
          const cell = document.querySelectorAll(`#${id} .vec-cell`)[i]
          cell?.classList.add('shown')
        })
        await sleep(55)
      }
      await sleep(1400)
    }

    const p3Query = document.getElementById('ld-p3-query')
    const p3Ring  = document.getElementById('ld-p3-ring')
    const p3Links = [1,2,3].map(i => document.getElementById(`ld-p3-link-${i}`))
    const p3Hits  = [1,2,3].map(i => document.getElementById(`ld-p3-hit-${i}`))

    const animateAttr = (el: Element, attr: string, from: number, to: number, duration: number) =>
      new Promise<void>(resolve => {
        const start = performance.now()
        const frame = (now: number) => {
          const t = Math.min(1, (now - start) / duration)
          const e = 1 - Math.pow(1 - t, 3)
          el.setAttribute(attr, String(from + (to - from) * e))
          if (t < 1) requestAnimationFrame(frame); else resolve()
        }
        requestAnimationFrame(frame)
      })

    const runPhase3 = async () => {
      p3Query?.setAttribute('opacity', '0'); p3Ring?.setAttribute('opacity', '0')
      p3Ring?.setAttribute('r', '0')
      p3Links.forEach(l => l?.setAttribute('opacity', '0'))
      p3Hits.forEach(h => { h?.classList.remove('hit'); h?.setAttribute('r', '3.5') })
      await sleep(450)
      if (cancelled) return
      p3Query?.setAttribute('opacity', '1'); await sleep(380)
      if (p3Ring) { p3Ring.setAttribute('opacity', '0.6'); await animateAttr(p3Ring, 'r', 0, 48, 900) }
      await sleep(150)
      for (let i = 0; i < 3; i++) {
        if (cancelled) return
        p3Links[i]?.setAttribute('opacity', '1')
        p3Hits[i]?.classList.add('hit'); p3Hits[i]?.setAttribute('r', '4.5')
        await sleep(220)
      }
      await sleep(1500)
    }

    const p4Lines    = [1,2,3,4].map(i => document.getElementById(`ld-p4-line-${i}`))
    const p4Caret    = document.getElementById('ld-p4-caret')
    const p4CitePill = document.getElementById('ld-p4-cite-pill')
    const p4Counter  = document.getElementById('ld-p4-counter')
    const p4Toks     = [1,2,3,4].map(i => document.getElementById(`ld-tok-${i}`))

    const ANSWER_LINES = [
      'Срок поставки — 30 рабочих',
      'дней с момента подписания',
      'договора, согласно п. 3.2',
      'и приложения Б (стр. 11).',
    ]

    const startTokenParticles = async () => {
      tokenLoopRunning = true; let i = 0
      while (tokenLoopRunning && !cancelled && pendingJump === null) {
        const tok = p4Toks[i % p4Toks.length]
        if (tok) {
          const drift = (Math.random() - 0.5) * 24
          tok.setAttribute('cx', String(170 + drift)); tok.setAttribute('cy', '206')
          tok.style.transition = 'none'; tok.style.opacity = '0'
          tok.getBoundingClientRect()
          tok.style.transition = 'cy 0.7s linear, opacity 0.7s ease-out'
          tok.style.opacity = '0.9'; tok.setAttribute('cy', '234')
          timers.push(setTimeout(() => { tok.style.opacity = '0' }, 600))
        }
        i++; await sleep(180)
      }
    }

    const runPhase4 = async () => {
      p4Lines.forEach(l => { if (l) l.textContent = '' })
      if (p4CitePill) p4CitePill.setAttribute('opacity', '0')
      if (p4Counter) p4Counter.textContent = '0'
      if (p4Caret) { p4Caret.setAttribute('x', '14'); p4Caret.setAttribute('y', '37'); p4Caret.style.opacity = '1' }
      p4Toks.forEach(t => { if (t) t.style.opacity = '0' })
      await sleep(450); if (cancelled) return
      startTokenParticles()
      let totalTokens = 0
      for (let li = 0; li < ANSWER_LINES.length; li++) {
        const line = ANSWER_LINES[li]; const yLine = 46 + li * 16
        for (let i = 1; i <= line.length; i++) {
          if (cancelled) return
          const lineEl = p4Lines[li]; if (lineEl) lineEl.textContent = line.slice(0, i)
          if (i % 2 === 0 && p4Counter) p4Counter.textContent = String(++totalTokens)
          if (p4Caret) { p4Caret.setAttribute('x', String(14 + i * 6.3)); p4Caret.setAttribute('y', String(yLine - 9)) }
          await sleep(28)
        }
      }
      if (p4Caret) p4Caret.style.opacity = '0'
      if (p4CitePill) p4CitePill.setAttribute('opacity', '1')
      await sleep(1600)
      tokenLoopRunning = false
      p4Toks.forEach(t => { if (t) t.style.opacity = '0' })
    }

    const stepEl = document.getElementById('ld-ph-step')
    const nameEl = document.getElementById('ld-ph-name')
    const subEl  = document.getElementById('ld-ph-sub')
    const progDots  = [1,2,3,4].map(i => document.getElementById(`ld-prog-${i}`))
    const phaseEls  = [1,2,3,4].map(i => document.getElementById(`ld-phase-${i}`))

    const PHASES = [
      { step: 'ШАГ 01 · 04', name: 'Документ → чанки', sub: 'Docling · RecursiveChunker',       run: runPhase1 },
      { step: 'ШАГ 02 · 04', name: 'Чанки → векторы',  sub: 'multilingual-e5-large · 1024-d',   run: runPhase2 },
      { step: 'ШАГ 03 · 04', name: 'Поиск в Qdrant',   sub: 'cosine · top-20 → top-5',           run: runPhase3 },
      { step: 'ШАГ 04 · 04', name: 'LLM → ответ',      sub: 'Ollama / OpenAI · stream SSE',      run: runPhase4 },
    ]

    const showPhase = (i: number) => {
      const p = PHASES[i]
      if (stepEl) stepEl.textContent = p.step
      if (nameEl) nameEl.textContent = p.name
      if (subEl)  subEl.textContent  = p.sub
      progDots.forEach((d, j) => {
        d?.classList.toggle('done',   j < i)
        d?.classList.toggle('active', j === i)
      })
      phaseEls.forEach((el, j) => el?.classList.toggle('is-active', j === i))
    }

    const runHeroLoop = async () => {
      while (!cancelled) {
        if (pendingJump !== null) {
          currentPhaseIdx = pendingJump
          pendingJump = null
          tokenLoopRunning = false
        }
        if (cancelled) return
        showPhase(currentPhaseIdx)
        await sleep(550)
        await PHASES[currentPhaseIdx].run()
        await sleep(600)
        if (pendingJump === null) {
          currentPhaseIdx = (currentPhaseIdx + 1) % PHASES.length
        }
      }
    }

    navigatePhaseRef.current = (delta: number) => {
      const target = ((currentPhaseIdx + delta) % PHASES.length + PHASES.length) % PHASES.length
      pendingJump = target
      tokenLoopRunning = false
      abortSleeps()
    }

    timers.push(setTimeout(runHeroLoop, 600))

    return () => {
      cancelled = true
      tokenLoopRunning = false
      timers.forEach(clearTimeout)
      resolvers.length = 0
      revealIO.disconnect()
      counterIO.disconnect()
      navigatePhaseRef.current = null
    }
  }, [])

  return (
    <div className="landing-page">

      <nav className="ld-nav">
        <div className="ld-container ld-nav-inner">
          <div className="ld-brand">
            <span className="ld-brand-mark">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
            </span>
            <span className="ld-brand-name">DocDialog</span>
          </div>
          <div className="ld-nav-actions">
            <a className="ld-btn ld-btn-ghost" href="https://github.com/Root010qwe/DocDialog" target="_blank" rel="noopener noreferrer">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.27-1.69-1.27-1.69-1.04-.71.08-.69.08-.69 1.15.08 1.76 1.18 1.76 1.18 1.02 1.76 2.69 1.25 3.35.95.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.18 1.18.92-.26 1.91-.39 2.89-.39s1.97.13 2.89.39c2.21-1.49 3.18-1.18 3.18-1.18.62 1.58.23 2.75.11 3.04.74.81 1.18 1.84 1.18 3.1 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56C20.21 21.38 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z"/>
              </svg>
              GitHub
            </a>
            <Link className="ld-btn ld-btn-login" to="/login">Войти</Link>
          </div>
        </div>
      </nav>

      <section className="ld-hero">
        <div className="ld-container ld-hero-grid">
          <div className="ld-hero-left">
            <div className="ld-hero-badge" data-reveal>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              ВКР&nbsp;·&nbsp;МГТУ им. Баумана&nbsp;·&nbsp;2026
            </div>
            <h1 data-reveal data-delay="1">
              Диалог с<br />документами.<br />
              <span className="ld-grad">По-настоящему.</span>
            </h1>
            <p className="ld-hero-sub" data-reveal data-delay="2">
              Self-hosted RAG-система: загрузите документы, задайте вопрос — получите ответ
              с указанием источника. Без облаков, без утечки данных.
            </p>
            <div className="ld-hero-cta" data-reveal data-delay="3">
              <Link className="ld-btn ld-btn-primary" to="/login">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                  <polyline points="10 17 15 12 10 7"/>
                  <line x1="15" y1="12" x2="3" y2="12"/>
                </svg>
                Войти в систему
              </Link>
              <Link className="ld-btn ld-btn-ghost" to="/register">
                Зарегистрироваться
              </Link>
            </div>
            <div className="ld-hero-meta" data-reveal data-delay="4">
              v1.3.0&nbsp;·&nbsp;Python 3.11&nbsp;·&nbsp;React 18&nbsp;·&nbsp;Qdrant
            </div>
          </div>

          <div className="ld-hero-anim" data-reveal data-delay="2">
            <div className="ld-anim-wrap" aria-hidden="true">
              <svg viewBox="0 0 340 480" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="ld-anim-grad-brand" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#3b5bdb"/>
                    <stop offset="1" stopColor="#8b5cf6"/>
                  </linearGradient>
                </defs>

                <text id="ld-ph-step" className="ph-step" x="0" y="12">ШАГ 01 · 04</text>
                <text id="ld-ph-name" className="ph-name" x="0" y="34">Документ → чанки</text>
                <text id="ld-ph-sub"  className="ph-sub"  x="340" y="34" textAnchor="end">Docling · RecursiveChunker</text>
                <g transform="translate(0,50)">
                  <circle id="ld-prog-1" className="prog-dot active" cx="4"  cy="0" r="3"/>
                  <circle id="ld-prog-2" className="prog-dot"        cx="15" cy="0" r="3"/>
                  <circle id="ld-prog-3" className="prog-dot"        cx="26" cy="0" r="3"/>
                  <circle id="ld-prog-4" className="prog-dot"        cx="37" cy="0" r="3"/>
                </g>

                <g id="ld-phase-1" className="phase-group is-active">
                  <g transform="translate(60,68)">
                    <rect className="anim-card" x="0" y="0" width="220" height="118" rx="12"/>
                    <rect x="0" y="0" width="220" height="4" rx="2" fill="url(#ld-anim-grad-brand)"/>
                    <g transform="translate(14,18)">
                      <rect x="0" y="0" width="14" height="18" rx="2" fill="#eef2ff" stroke="#c7d2fe"/>
                      <line x1="3" y1="6"  x2="11" y2="6"  stroke="#c7d2fe" strokeWidth="1"/>
                      <line x1="3" y1="10" x2="11" y2="10" stroke="#c7d2fe" strokeWidth="1"/>
                      <line x1="3" y1="14" x2="9"  y2="14" stroke="#c7d2fe" strokeWidth="1"/>
                    </g>
                    <text className="anim-label"   x="36" y="28">Договор_2024.pdf</text>
                    <text className="anim-caption" x="36" y="42">42 страницы · 18 KB</text>
                    <rect className="anim-text-line dark" x="16" y="58"  width="186" height="3" rx="1.5"/>
                    <rect className="anim-text-line"      x="16" y="66"  width="170" height="3" rx="1.5"/>
                    <rect className="anim-text-line"      x="16" y="74"  width="188" height="3" rx="1.5"/>
                    <rect className="anim-text-line dark" x="16" y="86"  width="100" height="3" rx="1.5"/>
                    <rect className="anim-text-line"      x="16" y="94"  width="182" height="3" rx="1.5"/>
                    <rect className="anim-text-line"      x="16" y="102" width="160" height="3" rx="1.5"/>
                  </g>
                  <g transform="translate(170,198)">
                    <line className="arrow-dashed" x1="0" y1="0" x2="0" y2="22"/>
                    <polygon points="-4,18 0,24 4,18" fill="#94a3b8"/>
                    <text className="anim-caption" x="0" y="40" textAnchor="middle">overlap=20% · ≈400 tokens/chunk</text>
                  </g>
                  <g transform="translate(18,256)">
                    <g id="ld-p1-chunk-1" className="chunk-card">
                      <rect className="anim-card" x="0" y="0" width="96" height="168" rx="10"/>
                      <rect x="0" y="0" width="96" height="3" rx="1.5" fill="#3b5bdb"/>
                      <text className="anim-tag" x="10" y="22">CHUNK 01</text>
                      <rect className="anim-text-line dark" x="10" y="36" width="76" height="3" rx="1.5"/>
                      <rect className="anim-text-line"      x="10" y="44" width="64" height="3" rx="1.5"/>
                      <rect className="anim-text-line"      x="10" y="52" width="78" height="3" rx="1.5"/>
                      <rect className="anim-text-line"      x="10" y="60" width="58" height="3" rx="1.5"/>
                      <rect className="anim-text-line dark" x="10" y="72" width="40" height="3" rx="1.5"/>
                      <rect className="anim-text-line"      x="10" y="80" width="78" height="3" rx="1.5"/>
                      <text className="anim-caption" x="10" y="156">стр. 1–3</text>
                    </g>
                    <g id="ld-p1-chunk-2" className="chunk-card" transform="translate(104,0)">
                      <rect className="anim-card" x="0" y="0" width="96" height="168" rx="10"/>
                      <rect x="0" y="0" width="96" height="3" rx="1.5" fill="#8b5cf6"/>
                      <text className="anim-tag" x="10" y="22" style={{fill:'#8b5cf6'}}>CHUNK 02</text>
                      <rect className="anim-text-line"      x="10" y="36" width="72" height="3" rx="1.5"/>
                      <rect className="anim-text-line dark" x="10" y="44" width="56" height="3" rx="1.5"/>
                      <rect className="anim-text-line"      x="10" y="52" width="80" height="3" rx="1.5"/>
                      <rect className="anim-text-line"      x="10" y="60" width="68" height="3" rx="1.5"/>
                      <rect className="anim-text-line"      x="10" y="68" width="76" height="3" rx="1.5"/>
                      <text className="anim-caption" x="10" y="156">стр. 4–8</text>
                    </g>
                    <g id="ld-p1-chunk-3" className="chunk-card" transform="translate(208,0)">
                      <rect className="anim-card" x="0" y="0" width="96" height="168" rx="10"/>
                      <rect x="0" y="0" width="96" height="3" rx="1.5" fill="#10b981"/>
                      <text className="anim-tag" x="10" y="22" style={{fill:'#10b981'}}>CHUNK 03</text>
                      <rect className="anim-text-line"      x="10" y="36" width="60" height="3" rx="1.5"/>
                      <rect className="anim-text-line"      x="10" y="44" width="76" height="3" rx="1.5"/>
                      <rect className="anim-text-line dark" x="10" y="52" width="50" height="3" rx="1.5"/>
                      <rect className="anim-text-line"      x="10" y="60" width="78" height="3" rx="1.5"/>
                      <rect className="anim-text-line"      x="10" y="68" width="66" height="3" rx="1.5"/>
                      <text className="anim-caption" x="10" y="156">стр. 9–12 · …</text>
                    </g>
                  </g>
                </g>

                <g id="ld-phase-2" className="phase-group">
                  <g transform="translate(18,72)">
                    <g>
                      <rect className="anim-card" x="0" y="0" width="96" height="58" rx="8"/>
                      <rect x="0" y="0" width="96" height="3" rx="1.5" fill="#3b5bdb"/>
                      <text className="anim-tag" x="10" y="20">CHUNK 01</text>
                      <rect className="anim-text-line dark" x="10" y="30" width="70" height="2.5" rx="1"/>
                      <rect className="anim-text-line"      x="10" y="36" width="58" height="2.5" rx="1"/>
                      <rect className="anim-text-line"      x="10" y="42" width="72" height="2.5" rx="1"/>
                    </g>
                    <g transform="translate(104,0)">
                      <rect className="anim-card" x="0" y="0" width="96" height="58" rx="8"/>
                      <rect x="0" y="0" width="96" height="3" rx="1.5" fill="#8b5cf6"/>
                      <text className="anim-tag" x="10" y="20" style={{fill:'#8b5cf6'}}>CHUNK 02</text>
                      <rect className="anim-text-line"      x="10" y="30" width="66" height="2.5" rx="1"/>
                      <rect className="anim-text-line dark" x="10" y="36" width="54" height="2.5" rx="1"/>
                      <rect className="anim-text-line"      x="10" y="42" width="76" height="2.5" rx="1"/>
                    </g>
                    <g transform="translate(208,0)">
                      <rect className="anim-card" x="0" y="0" width="96" height="58" rx="8"/>
                      <rect x="0" y="0" width="96" height="3" rx="1.5" fill="#10b981"/>
                      <text className="anim-tag" x="10" y="20" style={{fill:'#10b981'}}>CHUNK 03</text>
                      <rect className="anim-text-line"      x="10" y="30" width="58" height="2.5" rx="1"/>
                      <rect className="anim-text-line"      x="10" y="36" width="72" height="2.5" rx="1"/>
                      <rect className="anim-text-line dark" x="10" y="42" width="50" height="2.5" rx="1"/>
                    </g>
                  </g>
                  <g>
                    <line className="arrow-dashed" x1="66"  y1="134" x2="66"  y2="154"/>
                    <line className="arrow-dashed" x1="170" y1="134" x2="170" y2="154"/>
                    <line className="arrow-dashed" x1="274" y1="134" x2="274" y2="154"/>
                  </g>
                  <g transform="translate(18,156)">
                    <rect x="0" y="0" width="304" height="40" rx="10" fill="url(#ld-anim-grad-brand)" filter="drop-shadow(0 4px 14px rgba(59,91,219,0.28))"/>
                    <text x="14" y="16" fontSize="9" fontWeight="700" fontFamily="JetBrains Mono, monospace" fill="rgba(255,255,255,0.75)" letterSpacing="0.14em">ENCODER</text>
                    <text x="14" y="31" fontSize="11.5" fontWeight="700" fill="#fff">multilingual-e5-large</text>
                    <text x="290" y="26" fontSize="10" fontFamily="JetBrains Mono, monospace" fontWeight="700" fill="rgba(255,255,255,0.9)" textAnchor="end">1024-d</text>
                  </g>
                  <g>
                    <line className="arrow-dashed" x1="66"  y1="200" x2="66"  y2="222"/>
                    <line className="arrow-dashed" x1="170" y1="200" x2="170" y2="222"/>
                    <line className="arrow-dashed" x1="274" y1="200" x2="274" y2="222"/>
                  </g>
                  <g transform="translate(18,224)">
                    <g id="ld-vec-1">
                      <rect x="0" y="0" width="96" height="22" rx="3" fill="#f1f5f9"/>
                      <g className="vec-cells"></g>
                      <text className="anim-caption" x="0" y="38">[0.12, −0.45, …]</text>
                    </g>
                    <g id="ld-vec-2" transform="translate(104,0)">
                      <rect x="0" y="0" width="96" height="22" rx="3" fill="#f1f5f9"/>
                      <g className="vec-cells"></g>
                      <text className="anim-caption" x="0" y="38">[−0.31, 0.62, …]</text>
                    </g>
                    <g id="ld-vec-3" transform="translate(208,0)">
                      <rect x="0" y="0" width="96" height="22" rx="3" fill="#f1f5f9"/>
                      <g className="vec-cells"></g>
                      <text className="anim-caption" x="0" y="38">[0.04, 0.91, …]</text>
                    </g>
                  </g>
                  <g transform="translate(170,288)">
                    <line className="arrow-dashed" x1="0" y1="0" x2="0" y2="22"/>
                    <polygon points="-4,18 0,24 4,18" fill="#94a3b8"/>
                  </g>
                  <g transform="translate(50,322)">
                    <rect className="anim-card" x="0" y="0" width="240" height="60" rx="12"/>
                    <rect x="0" y="0" width="240" height="3" rx="1.5" fill="#10b981"/>
                    <g transform="translate(16,18)" fill="none" stroke="#10b981" strokeWidth="1.4">
                      <ellipse cx="7" cy="3" rx="7" ry="2.2"/>
                      <path d="M0 3 v9 a7 2.2 0 0 0 14 0 V3"/>
                      <path d="M0 8 a7 2.2 0 0 0 14 0"/>
                    </g>
                    <text className="anim-label"   x="38" y="28">Qdrant</text>
                    <text className="anim-caption" x="38" y="44">collection · per-user · cosine</text>
                    <text className="anim-caption" x="226" y="44" textAnchor="end">indexed</text>
                  </g>
                </g>

                <g id="ld-phase-3" className="phase-group">
                  <g transform="translate(60,68)">
                    <rect className="anim-card" x="0" y="0" width="220" height="36" rx="18"/>
                    <rect x="0" y="0" width="6" height="36" rx="3" fill="#8b5cf6"/>
                    <text className="anim-tag" x="16" y="15" style={{fill:'#8b5cf6'}}>QUERY</text>
                    <text className="anim-caption" x="16" y="28" style={{fill:'#334155'}}>«Какой срок поставки?»</text>
                  </g>
                  <g transform="translate(14,118)">
                    <rect className="scatter-bg" x="0" y="0" width="312" height="260" rx="14"/>
                    <text className="anim-tag" x="12" y="18" style={{fill:'#94a3b8'}}>VECTOR SPACE · 1024-d → 2D</text>
                    <line className="scatter-grid" x1="156" y1="30" x2="156" y2="244"/>
                    <line className="scatter-grid" x1="14"  y1="137" x2="298" y2="137"/>
                    <circle className="scatter-dot" cx="38"  cy="50"  r="3"/>
                    <circle className="scatter-dot" cx="72"  cy="80"  r="3"/>
                    <circle className="scatter-dot" cx="110" cy="42"  r="3"/>
                    <circle className="scatter-dot" cx="50"  cy="118" r="3"/>
                    <circle className="scatter-dot" cx="82"  cy="168" r="3"/>
                    <circle className="scatter-dot" cx="36"  cy="205" r="3"/>
                    <circle className="scatter-dot" cx="92"  cy="222" r="3"/>
                    <circle className="scatter-dot" cx="140" cy="196" r="3"/>
                    <circle className="scatter-dot" cx="194" cy="212" r="3"/>
                    <circle className="scatter-dot" cx="240" cy="226" r="3"/>
                    <circle className="scatter-dot" cx="272" cy="190" r="3"/>
                    <circle className="scatter-dot" cx="212" cy="66"  r="3"/>
                    <circle className="scatter-dot" cx="258" cy="50"  r="3"/>
                    <circle className="scatter-dot" cx="284" cy="100" r="3"/>
                    <circle className="scatter-dot" cx="262" cy="140" r="3"/>
                    <circle className="scatter-dot" cx="176" cy="54"  r="3"/>
                    <circle className="scatter-dot" cx="196" cy="170" r="3"/>
                    <circle className="scatter-dot" cx="232" cy="160" r="3"/>
                    <circle id="ld-p3-hit-1" className="scatter-dot" cx="144" cy="125" r="3.5"/>
                    <circle id="ld-p3-hit-2" className="scatter-dot" cx="178" cy="152" r="3.5"/>
                    <circle id="ld-p3-hit-3" className="scatter-dot" cx="172" cy="118" r="3.5"/>
                    <circle id="ld-p3-ring"  className="scatter-ring" cx="156" cy="137" r="0" opacity="0"/>
                    <line id="ld-p3-link-1" className="scatter-link" x1="156" y1="137" x2="144" y2="125" opacity="0"/>
                    <line id="ld-p3-link-2" className="scatter-link" x1="156" y1="137" x2="178" y2="152" opacity="0"/>
                    <line id="ld-p3-link-3" className="scatter-link" x1="156" y1="137" x2="172" y2="118" opacity="0"/>
                    <circle id="ld-p3-query" className="scatter-query" cx="156" cy="137" r="5" opacity="0"/>
                    <text className="anim-caption" x="12" y="248">cosine · top-20 · CrossEncoder · top-5</text>
                    <text className="anim-caption" x="300" y="248" textAnchor="end" style={{fill:'#3b5bdb',fontWeight:700}}>3 hits</text>
                  </g>
                </g>

                <g id="ld-phase-4" className="phase-group">
                  <g transform="translate(14,68)">
                    <g>
                      <rect className="cite-chip" x="0" y="0" width="100" height="46" rx="8"/>
                      <rect x="0" y="0" width="100" height="3" rx="1.5" fill="#3b5bdb"/>
                      <text className="cite-chip-name" x="8" y="20">Договор_2024</text>
                      <text className="cite-chip-frag" x="8" y="34">п. 3.2 · стр. 4</text>
                      <g transform="translate(72,34)">
                        <rect className="cite-chip-pct" x="0" y="-9" width="22" height="12" rx="6"/>
                        <text className="cite-chip-pct-text" x="11" y="0" textAnchor="middle">95%</text>
                      </g>
                    </g>
                    <g transform="translate(106,0)">
                      <rect className="cite-chip" x="0" y="0" width="100" height="46" rx="8"/>
                      <rect x="0" y="0" width="100" height="3" rx="1.5" fill="#8b5cf6"/>
                      <text className="cite-chip-name" x="8" y="20">Договор_2024</text>
                      <text className="cite-chip-frag" x="8" y="34">прил. Б · стр. 11</text>
                      <g transform="translate(72,34)">
                        <rect className="cite-chip-pct" x="0" y="-9" width="22" height="12" rx="6"/>
                        <text className="cite-chip-pct-text" x="11" y="0" textAnchor="middle">82%</text>
                      </g>
                    </g>
                    <g transform="translate(212,0)">
                      <rect className="cite-chip" x="0" y="0" width="100" height="46" rx="8"/>
                      <rect x="0" y="0" width="100" height="3" rx="1.5" fill="#10b981"/>
                      <text className="cite-chip-name" x="8" y="20">Спецификация</text>
                      <text className="cite-chip-frag" x="8" y="34">п. 1.4 · стр. 2</text>
                      <g transform="translate(72,34)">
                        <rect className="cite-chip-pct" x="0" y="-9" width="22" height="12" rx="6"/>
                        <text className="cite-chip-pct-text" x="11" y="0" textAnchor="middle">71%</text>
                      </g>
                    </g>
                  </g>
                  <g>
                    <line className="arrow-dashed" x1="64"  y1="118" x2="64"  y2="140"/>
                    <line className="arrow-dashed" x1="170" y1="118" x2="170" y2="140"/>
                    <line className="arrow-dashed" x1="276" y1="118" x2="276" y2="140"/>
                  </g>
                  <g transform="translate(30,142)">
                    <rect className="llm-box" x="0" y="0" width="280" height="62" rx="14"/>
                    <rect x="0" y="0" width="280" height="4" rx="2" fill="url(#ld-anim-grad-brand)"/>
                    <g transform="translate(16,22)">
                      <rect x="0" y="0" width="24" height="24" rx="6" fill="url(#ld-anim-grad-brand)"/>
                      <circle cx="8"  cy="11" r="2" fill="#fff"/>
                      <circle cx="16" cy="11" r="2" fill="#fff"/>
                      <rect x="7" y="16" width="10" height="2" rx="1" fill="#fff"/>
                    </g>
                    <text className="llm-name"  x="50" y="32">LLM · qwen2.5:7b</text>
                    <text className="llm-model" x="50" y="48">Ollama · stream SSE</text>
                    <text className="llm-model" x="268" y="48" textAnchor="end">+ context (8 msg)</text>
                  </g>
                  <g id="ld-p4-tokens">
                    <circle id="ld-tok-1" className="token-particle" cx="170" cy="206" r="2.5"/>
                    <circle id="ld-tok-2" className="token-particle" cx="170" cy="206" r="2.5"/>
                    <circle id="ld-tok-3" className="token-particle" cx="170" cy="206" r="2.5"/>
                    <circle id="ld-tok-4" className="token-particle" cx="170" cy="206" r="2.5"/>
                  </g>
                  <g transform="translate(14,232)">
                    <rect className="anim-card" x="0" y="0" width="312" height="172" rx="14"/>
                    <rect x="0" y="0" width="312" height="4" rx="2" fill="#10b981"/>
                    <text className="anim-tag" x="14" y="22" style={{fill:'#10b981'}}>ОТВЕТ · STREAM</text>
                    <text id="ld-p4-line-1" className="ans-line" x="14" y="46"></text>
                    <text id="ld-p4-line-2" className="ans-line" x="14" y="62"></text>
                    <text id="ld-p4-line-3" className="ans-line" x="14" y="78"></text>
                    <text id="ld-p4-line-4" className="ans-line" x="14" y="94"></text>
                    <rect id="ld-p4-caret" className="ans-caret" x="14" y="37" width="1.6" height="11"/>
                    <g id="ld-p4-cite-pill" transform="translate(14,124)" opacity="0">
                      <rect className="ans-cite-pill" x="0" y="0" width="220" height="20" rx="10"/>
                      <text className="ans-cite-text" x="10" y="14">📄 Договор_2024.pdf · п. 3.2 · 95%</text>
                    </g>
                    <text className="anim-caption" x="14" y="156">токенов: <tspan id="ld-p4-counter">0</tspan> · ~12 t/s · SSE</text>
                  </g>
                </g>
              </svg>
            </div>
            <div className="ld-anim-controls">
              <button
                className="ld-anim-btn"
                onClick={() => navigatePhaseRef.current?.(-1)}
                title="Предыдущий шаг"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>
              <button
                className="ld-anim-btn"
                onClick={() => navigatePhaseRef.current?.(1)}
                title="Следующий шаг"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="ld-section">
        <div className="ld-container">
          <div className="ld-section-head">
            <h2 className="ld-section-title" data-reveal>Как это работает</h2>
            <p className="ld-section-sub" data-reveal data-delay="1">От файла до ответа — автоматически</p>
          </div>

          <div className="ld-phase">
            <div className="ld-phase-label" data-reveal>Indexing · индексация документов</div>
            <div className="ld-stepper">
              <div className="ld-step-card" data-reveal-x data-delay="1">
                <div className="ld-step-viz" aria-hidden="true">
                  <svg viewBox="0 0 170 84" preserveAspectRatio="xMidYMid meet">
                    <g className="viz-float-slow" transform="translate(18,28)">
                      <rect width="30" height="40" rx="4" fill="#fee2e2" stroke="#fca5a5" strokeWidth="1"/>
                      <path d="M22 0 L30 8 L22 8 Z" fill="#fca5a5"/>
                      <text x="15" y="26" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#dc2626" fontFamily="Inter,sans-serif">PDF</text>
                    </g>
                    <g className="viz-float-mid" transform="translate(56,22)">
                      <rect width="30" height="40" rx="4" fill="#dbeafe" stroke="#93c5fd" strokeWidth="1"/>
                      <path d="M22 0 L30 8 L22 8 Z" fill="#93c5fd"/>
                      <text x="15" y="26" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#2563eb" fontFamily="Inter,sans-serif">DOCX</text>
                    </g>
                    <g className="viz-float-fast" transform="translate(94,32)">
                      <rect width="30" height="40" rx="4" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1"/>
                      <path d="M22 0 L30 8 L22 8 Z" fill="#cbd5e1"/>
                      <text x="15" y="26" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#64748b" fontFamily="Inter,sans-serif">TXT</text>
                    </g>
                    <g transform="translate(138,30)" stroke="#3b5bdb" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="8" y1="22" x2="8" y2="6"/>
                      <polyline points="2 12 8 6 14 12"/>
                    </g>
                    <line x1="132" y1="58" x2="160" y2="58" stroke="#3b5bdb" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <span className="ld-viz-tag">multipart/form-data</span>
                </div>
                <div className="ld-step-num">01</div>
                <h3 className="ld-step-title">Загрузка</h3>
                <p className="ld-step-desc">Пользователь загружает PDF, DOCX или TXT в коллекцию.</p>
              </div>
              <div className="ld-step-arrow"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg></div>

              <div className="ld-step-card" data-reveal-x data-delay="2">
                <div className="ld-step-viz" aria-hidden="true">
                  <svg viewBox="0 0 170 84" preserveAspectRatio="xMidYMid meet">
                    <g transform="translate(8,12)">
                      <rect width="42" height="60" rx="4" fill="white" stroke="#cbd5e1"/>
                      <line x1="6" y1="10" x2="36" y2="10" stroke="#cbd5e1" strokeWidth="1.4"/>
                      <line x1="6" y1="18" x2="32" y2="18" stroke="#e2e8f0"/>
                      <line x1="6" y1="24" x2="34" y2="24" stroke="#e2e8f0"/>
                      <rect x="6" y="30" width="30" height="11" rx="1" fill="#f1f5f9" stroke="#cbd5e1"/>
                      <line x1="6" y1="46" x2="34" y2="46" stroke="#e2e8f0"/>
                    </g>
                    <path className="viz-flow" d="M 56 42 L 78 42" stroke="#3b5bdb" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
                    <polygon points="78,38 84,42 78,46" fill="#3b5bdb"/>
                    <g transform="translate(88,12)">
                      <rect width="72" height="14" rx="3" fill="#eef2ff" stroke="#c7d2fe"/>
                      <text x="6" y="10" fontSize="7.5" fontWeight="700" fill="#3b5bdb" fontFamily="Inter,sans-serif">H1</text>
                      <text x="22" y="10" fontSize="7.5" fill="#475569" fontFamily="Inter,sans-serif">Заголовок</text>
                      <rect y="20" width="72" height="14" rx="3" fill="white" stroke="#e2e8f0"/>
                      <text x="6" y="30" fontSize="9" fontWeight="700" fill="#94a3b8" fontFamily="Inter,sans-serif">¶</text>
                      <text x="18" y="30" fontSize="7.5" fill="#475569" fontFamily="Inter,sans-serif">Абзац текста</text>
                      <rect y="40" width="72" height="14" rx="3" fill="white" stroke="#e2e8f0"/>
                      <g transform="translate(5,43)">
                        <rect width="9" height="3" fill="#10b981"/>
                        <rect y="4" width="9" height="3" fill="#10b981" opacity="0.6"/>
                      </g>
                      <text x="20" y="50" fontSize="7.5" fill="#475569" fontFamily="Inter,sans-serif">Таблица</text>
                    </g>
                  </svg>
                  <span className="ld-viz-tag">Docling</span>
                </div>
                <div className="ld-step-num">02</div>
                <h3 className="ld-step-title">Парсинг</h3>
                <p className="ld-step-desc">Docling извлекает текст, таблицы, структуру.</p>
              </div>
              <div className="ld-step-arrow"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg></div>

              <div className="ld-step-card" data-reveal-x data-delay="3">
                <div className="ld-step-viz" aria-hidden="true">
                  <svg viewBox="0 0 170 84" preserveAspectRatio="xMidYMid meet">
                    <text x="10" y="14" fontSize="7.5" fontWeight="700" fill="#94a3b8" fontFamily="Inter,sans-serif">DOC</text>
                    <rect x="10" y="18" width="150" height="12" rx="2" fill="#e2e8f0"/>
                    <line x1="48"  y1="32" x2="48"  y2="40" stroke="#cbd5e1" strokeWidth="1"/>
                    <line x1="86"  y1="32" x2="86"  y2="40" stroke="#cbd5e1" strokeWidth="1"/>
                    <line x1="122" y1="32" x2="122" y2="40" stroke="#cbd5e1" strokeWidth="1"/>
                    <text x="10" y="50" fontSize="7.5" fontWeight="700" fill="#94a3b8" fontFamily="Inter,sans-serif">CHUNKS · overlap</text>
                    <g transform="translate(0,54)">
                      <rect x="10"  y="0" width="46" height="18" rx="3" fill="#dbeafe" stroke="#93c5fd"/>
                      <rect x="48"  y="0" width="46" height="18" rx="3" fill="#c7d2fe" stroke="#a5b4fc" opacity="0.92"/>
                      <rect x="86"  y="0" width="46" height="18" rx="3" fill="#ddd6fe" stroke="#c4b5fd" opacity="0.92"/>
                      <rect x="124" y="0" width="36" height="18" rx="3" fill="#e9d5ff" stroke="#d8b4fe" opacity="0.92"/>
                      <rect x="48"  y="6" width="8" height="6" fill="#3b5bdb" opacity="0.35"/>
                      <rect x="86"  y="6" width="8" height="6" fill="#3b5bdb" opacity="0.35"/>
                      <rect x="124" y="6" width="8" height="6" fill="#3b5bdb" opacity="0.35"/>
                    </g>
                  </svg>
                  <span className="ld-viz-tag">RecursiveChunker</span>
                </div>
                <div className="ld-step-num">03</div>
                <h3 className="ld-step-title">Чанкинг</h3>
                <p className="ld-step-desc">RecursiveChunker делит на перекрывающиеся фрагменты.</p>
              </div>
              <div className="ld-step-arrow"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg></div>

              <div className="ld-step-card" data-reveal-x data-delay="4">
                <div className="ld-step-viz" aria-hidden="true">
                  <svg viewBox="0 0 170 84" preserveAspectRatio="xMidYMid meet">
                    <g transform="translate(6,26)">
                      <rect width="40" height="32" rx="6" fill="#dbeafe" stroke="#93c5fd"/>
                      <text x="20" y="13" textAnchor="middle" fontSize="7" fontWeight="700" fill="#3b5bdb" fontFamily="Inter,sans-serif">chunk</text>
                      <text x="20" y="24" textAnchor="middle" fontSize="7" fill="#475569" fontFamily="Inter,sans-serif">«Договор»</text>
                    </g>
                    <path className="viz-flow" d="M 49 42 L 60 42" stroke="#8b5cf6" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
                    <g transform="translate(60,30)">
                      <rect width="46" height="24" rx="12" fill="#f5f3ff" stroke="#c4b5fd"/>
                      <text x="23" y="11" textAnchor="middle" fontSize="7" fontWeight="700" fill="#8b5cf6" fontFamily="Inter,sans-serif">e5-large</text>
                      <text x="23" y="19" textAnchor="middle" fontSize="6" fill="#94a3b8" fontFamily="Inter,sans-serif">multilingual</text>
                    </g>
                    <path className="viz-flow" d="M 108 42 L 119 42" stroke="#8b5cf6" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
                    <g transform="translate(118,18)">
                      <rect width="48" height="48" rx="5" fill="white" stroke="#c4b5fd"/>
                      <text x="24" y="11" textAnchor="middle" fontSize="6.5" fontWeight="700" fill="#8b5cf6" fontFamily="Inter,sans-serif">vector</text>
                      <text x="24" y="22" textAnchor="middle" fontSize="7" fill="#475569" fontFamily="JetBrains Mono,monospace">[0.13,</text>
                      <text x="24" y="31" textAnchor="middle" fontSize="7" fill="#475569" fontFamily="JetBrains Mono,monospace">-0.42,</text>
                      <text x="24" y="40" textAnchor="middle" fontSize="7" fill="#475569" fontFamily="JetBrains Mono,monospace">0.87…]</text>
                    </g>
                  </svg>
                  <span className="ld-viz-tag">e5-large · 1024-dim</span>
                </div>
                <div className="ld-step-num">04</div>
                <h3 className="ld-step-title">Эмбеддинг</h3>
                <p className="ld-step-desc">multilingual-e5-large кодирует фрагмент → вектор 1024-dim.</p>
              </div>
              <div className="ld-step-arrow"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg></div>

              <div className="ld-step-card" data-reveal-x data-delay="5">
                <div className="ld-step-viz" aria-hidden="true">
                  <svg viewBox="0 0 170 84" preserveAspectRatio="xMidYMid meet">
                    <rect x="22" y="14" width="140" height="58" rx="8" fill="white" stroke="#cbd5e1" strokeDasharray="3 3"/>
                    <text x="28" y="26" fontSize="7.5" fontWeight="700" fill="#3b5bdb" fontFamily="Inter,sans-serif">Qdrant</text>
                    <text x="62" y="26" fontSize="6.5" fill="#94a3b8" fontFamily="JetBrains Mono,monospace">cosine · per-user</text>
                    <circle cx="40"  cy="46" r="2.6" fill="#3b5bdb" opacity="0.85"/>
                    <circle cx="56"  cy="60" r="2.6" fill="#8b5cf6" opacity="0.7"/>
                    <circle cx="72"  cy="44" r="2.6" fill="#3b5bdb" opacity="0.6"/>
                    <circle cx="86"  cy="58" r="2.6" fill="#10b981" opacity="0.7"/>
                    <circle cx="100" cy="48" r="2.6" fill="#3b5bdb" opacity="0.8"/>
                    <circle cx="118" cy="42" r="2.6" fill="#8b5cf6" opacity="0.6"/>
                    <circle cx="132" cy="56" r="2.6" fill="#3b5bdb" opacity="0.75"/>
                    <circle cx="150" cy="48" r="2.6" fill="#3b5bdb" opacity="0.85"/>
                    <circle className="viz-pulse-new" cx="64" cy="52" r="4" fill="none" stroke="#10b981" strokeWidth="1.5"/>
                    <circle cx="64" cy="52" r="3" fill="#10b981"/>
                    <path d="M 4 52 L 18 52" stroke="#10b981" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                    <polygon points="18,49 22,52 18,55" fill="#10b981"/>
                  </svg>
                  <span className="ld-viz-tag">Qdrant v1.9</span>
                </div>
                <div className="ld-step-num">05</div>
                <h3 className="ld-step-title">Индекс</h3>
                <p className="ld-step-desc">Векторы сохраняются в Qdrant — коллекция per-user.</p>
              </div>
            </div>
          </div>

          <div className="ld-phase">
            <div className="ld-phase-label" data-reveal>Query · обработка запроса</div>
            <div className="ld-stepper">
              <div className="ld-step-card" data-reveal-x data-delay="1">
                <div className="ld-step-viz" aria-hidden="true">
                  <svg viewBox="0 0 170 84" preserveAspectRatio="xMidYMid meet">
                    <circle cx="20" cy="42" r="12" fill="#eef2ff" stroke="#c7d2fe"/>
                    <text x="20" y="46" textAnchor="middle" fontSize="12" fontWeight="700" fill="#3b5bdb" fontFamily="Inter,sans-serif">U</text>
                    <g transform="translate(38,16)">
                      <path d="M0 8 Q0 0 8 0 H118 Q126 0 126 8 V44 Q126 52 118 52 H22 L12 60 L14 52 H8 Q0 52 0 44 Z" fill="white" stroke="#e2e8f0"/>
                      <text x="12" y="20" fontSize="8.5" fill="#475569" fontFamily="Inter,sans-serif">Какой срок поставки</text>
                      <text x="12" y="34" fontSize="8.5" fill="#475569" fontFamily="Inter,sans-serif">по договору?</text>
                      <rect className="viz-blink-caret" x="74" y="26" width="2" height="10" fill="#3b5bdb"/>
                    </g>
                  </svg>
                  <span className="ld-viz-tag">user query</span>
                </div>
                <div className="ld-step-num">01</div>
                <h3 className="ld-step-title">Вопрос</h3>
                <p className="ld-step-desc">Пользователь задаёт вопрос на русском или английском.</p>
              </div>
              <div className="ld-step-arrow"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg></div>

              <div className="ld-step-card" data-reveal-x data-delay="2">
                <div className="ld-step-viz" aria-hidden="true">
                  <svg viewBox="0 0 170 84" preserveAspectRatio="xMidYMid meet">
                    <text x="10" y="14" fontSize="7" fontWeight="700" fill="#94a3b8" fontFamily="Inter,sans-serif">VECTOR SPACE</text>
                    <line x1="10" y1="78" x2="160" y2="78" stroke="#e2e8f0"/>
                    <line x1="10" y1="20" x2="10"  y2="78" stroke="#e2e8f0"/>
                    <circle cx="30"  cy="62" r="2.6" fill="#cbd5e1" opacity="0.7"/>
                    <circle cx="48"  cy="32" r="2.6" fill="#cbd5e1" opacity="0.7"/>
                    <circle cx="62"  cy="68" r="2.6" fill="#cbd5e1" opacity="0.7"/>
                    <circle cx="80"  cy="30" r="2.6" fill="#cbd5e1" opacity="0.7"/>
                    <circle cx="120" cy="64" r="2.6" fill="#cbd5e1" opacity="0.7"/>
                    <circle cx="138" cy="28" r="2.6" fill="#cbd5e1" opacity="0.7"/>
                    <circle cx="152" cy="66" r="2.6" fill="#cbd5e1" opacity="0.7"/>
                    <circle cx="96" cy="48" r="3.4" fill="#8b5cf6"/>
                    <circle cx="96" cy="48" r="14" fill="none" stroke="#8b5cf6" strokeDasharray="2 3" opacity="0.55"/>
                    <text x="96" y="42" textAnchor="middle" fontSize="6.5" fontWeight="700" fill="#8b5cf6" fontFamily="Inter,sans-serif">Q</text>
                    <circle cx="104" cy="44" r="3.4" fill="#3b5bdb"/>
                    <circle cx="86"  cy="52" r="3.4" fill="#3b5bdb" opacity="0.7"/>
                    <circle cx="108" cy="58" r="3.4" fill="#3b5bdb" opacity="0.45"/>
                    <line x1="96" y1="48" x2="104" y2="44" stroke="#3b5bdb" strokeWidth="0.8" opacity="0.6"/>
                    <line x1="96" y1="48" x2="86"  y2="52" stroke="#3b5bdb" strokeWidth="0.8" opacity="0.4"/>
                    <line x1="96" y1="48" x2="108" y2="58" stroke="#3b5bdb" strokeWidth="0.8" opacity="0.3"/>
                  </svg>
                  <span className="ld-viz-tag">cosine · top-20</span>
                </div>
                <div className="ld-step-num">02</div>
                <h3 className="ld-step-title">Поиск</h3>
                <p className="ld-step-desc">Запрос эмбеддится, ищутся ближайшие векторы (cosine).</p>
              </div>
              <div className="ld-step-arrow"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg></div>

              <div className="ld-step-card" data-reveal-x data-delay="3">
                <div className="ld-step-viz" aria-hidden="true">
                  <svg viewBox="0 0 170 84" preserveAspectRatio="xMidYMid meet">
                    <text x="8" y="14" fontSize="7" fontWeight="700" fill="#94a3b8" fontFamily="Inter,sans-serif">TOP-20</text>
                    <g transform="translate(8,18)">
                      <g className="viz-fade-1"><rect x="0"  y="0"  width="12" height="3.5" rx="1" fill="#cbd5e1"/></g>
                      <g className="viz-fade-2"><rect x="14" y="0"  width="10" height="3.5" rx="1" fill="#cbd5e1"/></g>
                      <g className="viz-fade-3"><rect x="0"  y="6"  width="8"  height="3.5" rx="1" fill="#cbd5e1"/></g>
                      <g className="viz-fade-1"><rect x="14" y="6"  width="12" height="3.5" rx="1" fill="#cbd5e1"/></g>
                      <g className="viz-fade-2"><rect x="0"  y="12" width="11" height="3.5" rx="1" fill="#cbd5e1"/></g>
                      <g className="viz-fade-3"><rect x="14" y="12" width="9"  height="3.5" rx="1" fill="#cbd5e1"/></g>
                      <g className="viz-fade-1"><rect x="0"  y="18" width="10" height="3.5" rx="1" fill="#cbd5e1"/></g>
                      <g className="viz-fade-2"><rect x="14" y="18" width="12" height="3.5" rx="1" fill="#cbd5e1"/></g>
                      <g className="viz-fade-3"><rect x="0"  y="24" width="9"  height="3.5" rx="1" fill="#cbd5e1"/></g>
                      <g className="viz-fade-1"><rect x="14" y="24" width="11" height="3.5" rx="1" fill="#cbd5e1"/></g>
                      <g className="viz-fade-2"><rect x="0"  y="30" width="12" height="3.5" rx="1" fill="#cbd5e1"/></g>
                      <g className="viz-fade-3"><rect x="14" y="30" width="10" height="3.5" rx="1" fill="#cbd5e1"/></g>
                      <g className="viz-fade-1"><rect x="0"  y="36" width="9"  height="3.5" rx="1" fill="#cbd5e1"/></g>
                      <g className="viz-fade-2"><rect x="14" y="36" width="11" height="3.5" rx="1" fill="#cbd5e1"/></g>
                      <g className="viz-fade-3"><rect x="0"  y="42" width="12" height="3.5" rx="1" fill="#cbd5e1"/></g>
                      <g className="viz-fade-1"><rect x="14" y="42" width="10" height="3.5" rx="1" fill="#cbd5e1"/></g>
                      <g className="viz-fade-2"><rect x="0"  y="48" width="11" height="3.5" rx="1" fill="#cbd5e1"/></g>
                      <g className="viz-fade-3"><rect x="14" y="48" width="9"  height="3.5" rx="1" fill="#cbd5e1"/></g>
                      <g className="viz-fade-1"><rect x="0"  y="54" width="10" height="3.5" rx="1" fill="#cbd5e1"/></g>
                      <g className="viz-fade-2"><rect x="14" y="54" width="12" height="3.5" rx="1" fill="#cbd5e1"/></g>
                    </g>
                    <g transform="translate(46,30)">
                      <text x="22" y="0" textAnchor="middle" fontSize="6.5" fontWeight="700" fill="#10b981" fontFamily="Inter,sans-serif">CrossEncoder</text>
                      <text x="22" y="9" textAnchor="middle" fontSize="6" fill="#94a3b8" fontFamily="JetBrains Mono,monospace">ms-marco</text>
                      <path className="viz-flow" d="M 4 18 L 38 18" stroke="#10b981" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
                      <polygon points="38,15 44,18 38,21" fill="#10b981"/>
                    </g>
                    <text x="98" y="14" fontSize="7" fontWeight="700" fill="#3b5bdb" fontFamily="Inter,sans-serif">TOP-5</text>
                    <g transform="translate(98,18)">
                      <rect width="60" height="9"  rx="2" fill="#3b5bdb"/>
                      <text x="3" y="7" fontSize="6" fill="white" fontWeight="700" fontFamily="JetBrains Mono,monospace">0.95</text>
                      <rect y="11" width="52" height="9" rx="2" fill="#3b5bdb" opacity="0.85"/>
                      <text x="3" y="18" fontSize="6" fill="white" fontWeight="700" fontFamily="JetBrains Mono,monospace">0.87</text>
                      <rect y="22" width="44" height="9" rx="2" fill="#3b5bdb" opacity="0.65"/>
                      <text x="3" y="29" fontSize="6" fill="white" fontWeight="700" fontFamily="JetBrains Mono,monospace">0.74</text>
                      <rect y="33" width="36" height="9" rx="2" fill="#3b5bdb" opacity="0.45"/>
                      <text x="3" y="40" fontSize="6" fill="white" fontWeight="700" fontFamily="JetBrains Mono,monospace">0.62</text>
                      <rect y="44" width="30" height="9" rx="2" fill="#3b5bdb" opacity="0.3"/>
                      <text x="3" y="51" fontSize="6" fill="white" fontWeight="700" fontFamily="JetBrains Mono,monospace">0.51</text>
                    </g>
                  </svg>
                  <span className="ld-viz-tag">CrossEncoder</span>
                </div>
                <div className="ld-step-num">03</div>
                <h3 className="ld-step-title">Реранкинг</h3>
                <p className="ld-step-desc">CrossEncoder ms-marco переоценивает топ-20 → топ-5.</p>
              </div>
              <div className="ld-step-arrow"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg></div>

              <div className="ld-step-card" data-reveal-x data-delay="4">
                <div className="ld-step-viz" aria-hidden="true">
                  <svg viewBox="0 0 170 84" preserveAspectRatio="xMidYMid meet">
                    <g transform="translate(6,30)">
                      <rect width="46" height="26" rx="13" fill="#f0fdf4" stroke="#86efac"/>
                      <text x="23" y="12" textAnchor="middle" fontSize="7" fontWeight="700" fill="#10b981" fontFamily="Inter,sans-serif">Ollama</text>
                      <text x="23" y="21" textAnchor="middle" fontSize="6" fill="#94a3b8" fontFamily="JetBrains Mono,monospace">qwen2.5:7b</text>
                    </g>
                    <text x="60" y="14" fontSize="7" fontWeight="700" fill="#94a3b8" fontFamily="Inter,sans-serif">SSE · stream</text>
                    <path className="viz-flow" d="M 54 43 L 64 43" stroke="#10b981" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
                    <g transform="translate(64,26)">
                      <g className="viz-tok viz-tok-1"><rect x="0"  y="0"  width="22" height="12" rx="3" fill="#dcfce7" stroke="#86efac"/><text x="11" y="9" textAnchor="middle" fontSize="6.5" fill="#10b981" fontFamily="JetBrains Mono,monospace">Срок</text></g>
                      <g className="viz-tok viz-tok-2"><rect x="26" y="0"  width="32" height="12" rx="3" fill="#dcfce7" stroke="#86efac"/><text x="42" y="9" textAnchor="middle" fontSize="6.5" fill="#10b981" fontFamily="JetBrains Mono,monospace">поставки</text></g>
                      <g className="viz-tok viz-tok-3"><rect x="62" y="0"  width="32" height="12" rx="3" fill="#dcfce7" stroke="#86efac"/><text x="78" y="9" textAnchor="middle" fontSize="6.5" fill="#10b981" fontFamily="JetBrains Mono,monospace">→ 30</text></g>
                      <g className="viz-tok viz-tok-4"><rect x="0"  y="16" width="28" height="12" rx="3" fill="#dcfce7" stroke="#86efac"/><text x="14" y="25" textAnchor="middle" fontSize="6.5" fill="#10b981" fontFamily="JetBrains Mono,monospace">раб.</text></g>
                      <g className="viz-tok viz-tok-5"><rect x="32" y="16" width="28" height="12" rx="3" fill="#dcfce7" stroke="#86efac"/><text x="46" y="25" textAnchor="middle" fontSize="6.5" fill="#10b981" fontFamily="JetBrains Mono,monospace">дней</text></g>
                      <g className="viz-tok viz-tok-6"><rect x="64" y="16" width="32" height="12" rx="3" fill="#eef2ff" stroke="#c7d2fe"/><text x="80" y="25" textAnchor="middle" fontSize="6.5" fill="#3b5bdb" fontFamily="JetBrains Mono,monospace">[95%]</text></g>
                    </g>
                  </svg>
                  <span className="ld-viz-tag">Ollama · SSE</span>
                </div>
                <div className="ld-step-num">04</div>
                <h3 className="ld-step-title">Генерация</h3>
                <p className="ld-step-desc">Ollama / OpenAI стримит ответ по SSE с цитатами.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="ld-section" style={{paddingTop:'32px'}}>
        <div className="ld-container">
          <div className="ld-section-head">
            <h2 className="ld-section-title" data-reveal>Возможности</h2>
            <p className="ld-section-sub" data-reveal data-delay="1">Реальные функции системы — все реализованы</p>
          </div>
          <div className="ld-features-grid">

            <div className="ld-card" data-reveal data-delay="1">
              <div className="ld-card-strip brand"/>
              <div className="ld-card-body">
                <div className="ld-card-head">
                  <div className="ld-icon-box brand">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  </div>
                  <h3 className="ld-card-title">Диалог с цитатами</h3>
                </div>
                <p className="ld-card-text">Каждый ответ — с указанием источника: документ, фрагмент, процент релевантности от CrossEncoder.</p>
                <div className="ld-demo">
                  <div className="ld-bubble user">Какой срок поставки по договору?</div>
                  <div className="ld-bubble assistant">Срок поставки — 30 рабочих дней с момента подписания, согласно п. 3.2.</div>
                  <div className="ld-citation">
                    <div className="ld-citation-left">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      <span className="ld-citation-name">Договор_2024.pdf · стр. 4</span>
                    </div>
                    <span className="ld-citation-pct">95%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="ld-card" data-reveal data-delay="2">
              <div className="ld-card-strip emerald"/>
              <div className="ld-card-body">
                <div className="ld-card-head">
                  <div className="ld-icon-box emerald">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                  </div>
                  <h3 className="ld-card-title">SSE-стриминг</h3>
                </div>
                <p className="ld-card-text">Ответ появляется токен за токеном через Server-Sent Events — без ожидания полного ответа.</p>
                <div className="ld-demo">
                  <div className="ld-stream-box">
                    <span id="ld-stream-target"></span><span className="ld-caret"/>
                    <span className="ld-dots" id="ld-stream-dots">
                      <span className="ld-dot ld-dot-1"/>
                      <span className="ld-dot ld-dot-2"/>
                      <span className="ld-dot ld-dot-3"/>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="ld-card" data-reveal data-delay="3">
              <div className="ld-card-strip violet"/>
              <div className="ld-card-body">
                <div className="ld-card-head">
                  <div className="ld-icon-box violet">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/></svg>
                  </div>
                  <h3 className="ld-card-title">Аналитическое саммари</h3>
                </div>
                <p className="ld-card-text">Map-reduce по всей коллекции: LLM анализирует каждый фрагмент, затем собирает итоговое резюме.</p>
                <div className="ld-demo">
                  <div className="ld-progress-row"><span>Группа 2 из 4</span><span>50%</span></div>
                  <div className="ld-progress-bar"><div className="ld-progress-fill"/></div>
                  <div className="ld-summary-hint">Обработка 142 фрагментов · map-reduce reduce-step</div>
                </div>
              </div>
            </div>

            <div className="ld-card" data-reveal data-delay="4">
              <div className="ld-card-strip amber"/>
              <div className="ld-card-body">
                <div className="ld-card-head">
                  <div className="ld-icon-box amber">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  </div>
                  <h3 className="ld-card-title">Экспорт PDF / DOCX</h3>
                </div>
                <p className="ld-card-text">Диалог можно экспортировать с кириллической поддержкой (DejaVu шрифт в reportlab).</p>
                <div className="ld-demo">
                  <div className="ld-export-pills">
                    <span className="ld-pill">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
                      PDF
                    </span>
                    <span className="ld-pill">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
                      DOCX
                    </span>
                    <span className="ld-pill" style={{borderStyle:'dashed',color:'var(--s-400)'}}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                      с цитатами
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="ld-card" data-reveal data-delay="5">
              <div className="ld-card-strip brand"/>
              <div className="ld-card-body">
                <div className="ld-card-head">
                  <div className="ld-icon-box brand">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6"/><path d="M23 11h-6"/></svg>
                  </div>
                  <h3 className="ld-card-title">Роли и доступ</h3>
                </div>
                <p className="ld-card-text">Поделитесь коллекцией с коллегами: роли admin / viewer, управление участниками.</p>
                <div className="ld-demo">
                  <div className="ld-role-list">
                    <div className="ld-role-row">
                      <div className="ld-role-who"><span className="ld-avatar">А</span> alice@corp.ru</div>
                      <span className="ld-role-tag admin">admin</span>
                    </div>
                    <div className="ld-role-row">
                      <div className="ld-role-who"><span className="ld-avatar" style={{background:'linear-gradient(135deg,#10b981,#3b5bdb)'}}>Б</span> bob@corp.ru</div>
                      <span className="ld-role-tag viewer">viewer</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="ld-card" data-reveal data-delay="6">
              <div className="ld-card-strip emerald"/>
              <div className="ld-card-body">
                <div className="ld-card-head">
                  <div className="ld-icon-box emerald">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  </div>
                  <h3 className="ld-card-title">Переключение LLM</h3>
                </div>
                <p className="ld-card-text">Переключайтесь между Ollama-моделями (qwen2.5:7b, llama3.2) и OpenAI прямо из UI — без перезапуска.</p>
                <div className="ld-demo">
                  <div className="ld-llm-list">
                    <div className="ld-llm-row active"><span>ollama / qwen2.5:7b</span><span className="ld-llm-dot"/></div>
                    <div className="ld-llm-row"><span>ollama / llama3.2</span><span className="ld-llm-dot"/></div>
                    <div className="ld-llm-row"><span>openai / gpt-4o-mini</span><span className="ld-llm-dot"/></div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      <section className="ld-section">
        <div className="ld-container">
          <div className="ld-section-head">
            <h2 className="ld-section-title" data-reveal>Технологический стек</h2>
            <p className="ld-section-sub" data-reveal data-delay="1">Каждый слой — production-ready инструменты</p>
          </div>
          <div className="ld-stack-list">
            {[
              { layer: '1', name: 'Frontend', tags: ['React 18','TypeScript','Vite','Zustand','React Router v6','Framer Motion'] },
              { layer: '2', name: 'API',      tags: ['FastAPI','SQLAlchemy async','Pydantic v2','asyncpg','SSE'] },
              { layer: '3', name: 'AI / ML',  tags: ['LangChain','Ollama','OpenAI','multilingual-e5-large','Qdrant v1.9','CrossEncoder','Docling'] },
              { layer: '4', name: 'Data',     tags: ['PostgreSQL 16','Redis','Celery'] },
              { layer: '5', name: 'Infra',    tags: ['Docker Compose × 7','nginx','SSE','argon2 + JWT'] },
            ].map((row, i) => (
              <div key={row.layer} className="ld-stack-row" data-layer={row.layer} data-reveal-x data-delay={String(i + 1)}>
                <div className="ld-layer-name">{row.name}</div>
                <div className="ld-stack-tags">
                  {row.tags.map(t => <span key={t} className="ld-tag">{t}</span>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="ld-section" style={{paddingTop:'32px'}}>
        <div className="ld-container">
          <div className="ld-stats" data-reveal>
            {[
              { count: 7,  suffix: '',  label: 'сервисов Docker' },
              { count: 12, suffix: '+', label: 'эндпоинтов API' },
              { count: 6,  suffix: '',  label: 'фаз разработки' },
              { count: 2,  suffix: '',  label: 'LLM-провайдера' },
            ].map(s => (
              <div key={s.label} className="ld-stat">
                <div className="ld-stat-num" data-count={s.count} data-suffix={s.suffix}>0</div>
                <div className="ld-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="ld-section" style={{paddingTop:'32px'}}>
        <div className="ld-container">
          <div className="ld-about-block" data-reveal>
            <div className="ld-about-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
            </div>
            <h2 className="ld-about-name">Гонов Марат Игоревич</h2>
            <p className="ld-about-univ">Студент МГТУ им. Баумана · Группа ИУ5-85Б</p>
            <p className="ld-about-thesis-label">Выпускная квалификационная работа</p>
            <p className="ld-about-thesis">Кафедра ИУ5 · 2026</p>
            <Link className="ld-btn ld-btn-primary" to="/login" style={{display:'inline-flex',justifyContent:'center',width:'100%',maxWidth:'280px'}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
              Открыть DocDialog
            </Link>
          </div>
        </div>
      </section>

      <footer className="ld-footer">
        <p>DocDialog · v1.3.0</p>
        <p className="mono">МГТУ им. Баумана · 2026 · github.com/Root010qwe/DocDialog</p>
      </footer>

    </div>
  )
}
