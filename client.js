/**
 * dsh-tech-deco — 浏览器半侧
 *
 * 预览版视觉的「装饰层」实现：全部画在 shell.overlay 上，绝不修改宿主。
 *
 * 与预览版的差异（因为不再有"真背景层"）：
 *   · 纸面底色不再替换（那需要改宿主），改用「边缘渐晕」营造纵深感
 *   · 长条方块与准星用低透明度（0.05–0.13）叠在内容之上，只做氛围
 *   · 指针 HUD、四角标、刻度、扫描线、状态牌保持原样
 *
 * 开关：window.__DSH_TECH_DECO__.hide() / .show() / .setIntensity(0..2)
 */
window.__ModuleLoader__.load({
  id: 'dsh-tech-deco',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /* ── 设置：存 localStorage，插件自带，不依赖 Host ── */
    const SETTINGS_KEY = 'dsh-tech-deco:settings'
    const DEFAULTS = {
      soundVolume: 0.6,     // 选中提示音量 0–1
      ringSpeed: 1,         // 圆环转速倍率 0.25–3
      blockSpeed: 1,        // 背景方块滑动倍率 0.25–3
      intensity: 2,         // 整体浓度 0–2
      theme: 'follow',      // follow | light | dark
      pointer: 'close'      // instant | close | lag
    }
    const settings = Object.assign({}, DEFAULTS)
    function loadSettings() {
      try {
        const raw = window.localStorage.getItem(SETTINGS_KEY)
        if (!raw) return
        const obj = JSON.parse(raw)
        for (const k of Object.keys(DEFAULTS)) {
          if (obj[k] !== undefined) settings[k] = obj[k]
        }
      } catch (e) { /* noop */ }
    }
    function saveSettings(patch) {
      Object.assign(settings, patch)
      try {
        window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
      } catch (e) { /* noop */ }
      window.dispatchEvent(new CustomEvent('dsh-tech-deco:settings', { detail: Object.assign({}, settings) }))
    }

    const CSS_ID = 'dsh-tech-deco-style'
    const ACCENT = '#ff7500'

    const CSS = [
      '.dtd-root{position:fixed;inset:0;pointer-events:none;z-index:1;',
      '  font-family:"Cascadia Mono","Consolas","Menlo",monospace;user-select:none}',
      '.dtd-root[data-hidden="1"]{display:none}',
      '.dtd-canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}',
      '  transition:opacity 700ms cubic-bezier(.4,0,.2,1)}',
      '.dtd-root{transition:opacity 700ms ease}',
      '.dtd-grain{position:absolute;inset:-40%;pointer-events:none;opacity:.035;',
      '  background-image:url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'120\' height=\'120\'><filter id=\'n\'><feTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'2\'/></filter><rect width=\'120\' height=\'120\' filter=\'url(%23n)\' opacity=\'0.6\'/></svg>")}',

      '.dtd-c{position:absolute;width:20px;height:20px;border:0 solid rgba(255,117,0,.45);opacity:.7}',
      '.dtd-c.tl{left:12px;top:12px;border-left-width:1px;border-top-width:1px}',
      '.dtd-c.tr{right:12px;top:12px;border-right-width:1px;border-top-width:1px}',
      '.dtd-c.bl{left:12px;bottom:12px;border-left-width:1px;border-bottom-width:1px}',
      '.dtd-c.br{right:12px;bottom:12px;border-right-width:1px;border-bottom-width:1px}',

      '.dtd-ticks{position:absolute;left:50%;transform:translateX(-50%);width:min(46vw,420px);height:6px;',
      '  display:flex;justify-content:space-between;opacity:.30}',
      '.dtd-ticks.top{top:10px}',
      '.dtd-ticks.bottom{bottom:10px}',
      '.dtd-ticks i{width:1px;height:6px;display:block;',
      '  background:var(--dsw-alias-label-tertiary,rgba(120,124,130,.5))}',

      '.dtd-vscale{position:absolute;left:12px;top:50%;transform:translateY(-50%);',
      '  display:flex;flex-direction:column;gap:9px;opacity:.28}',
      '.dtd-vscale i{width:6px;height:1px;display:block;background:var(--dsw-alias-label-tertiary,rgba(120,124,130,.5))}',
      '.dtd-vscale i.big{width:12px;background:' + ACCENT + ';opacity:.8}',

      '.dtd-info{position:absolute;right:22px;top:96px;text-align:right;',
      '  font-family:"Cascadia Mono","Consolas",monospace;font-size:8px;letter-spacing:.22em;',
      '  line-height:1.9;color:var(--dsw-alias-label-tertiary,rgba(120,124,130,.7));opacity:.62}',
      '.dtd-info b{color:#ff7500;font-weight:600}',
      '.dtd-info .ln{display:flex;align-items:center;justify-content:flex-end;gap:6px}',
      '.dtd-info .ln i{width:14px;height:1px;background:rgba(255,117,0,.55);display:block}',

      '.dtd-status{position:absolute;right:22px;bottom:22px;text-align:right;',
      '  font-size:8px;letter-spacing:.2em;line-height:1.9;',
      '  color:var(--dsw-alias-label-tertiary,rgba(120,124,130,.7));opacity:.75}',
      '.dtd-status .t{color:' + ACCENT + ';letter-spacing:.14em}',
      '.dtd-status b{color:' + ACCENT + ';font-weight:600}',
      '.dtd-dot{display:inline-block;width:5px;height:5px;border-radius:50%;margin-right:5px;',
      '  background:' + ACCENT + ';box-shadow:0 0 8px rgba(255,117,0,.8);vertical-align:1px}',

      '.dtd-side{position:absolute;inset:0;pointer-events:none;z-index:3;overflow:hidden;',
      '  font-family:"Cascadia Mono","Consolas",monospace}',
      '.dtd-side .rev{position:absolute;left:22px;display:flex;align-items:center;gap:6px;',
      '  font-size:8px;letter-spacing:.18em;color:rgba(255,117,0,.85)}',
      '.dtd-side .rev i{width:5px;height:5px;border-radius:50%;background:#ff7500;',
      '  box-shadow:0 0 8px rgba(255,117,0,.85);display:block}',
      '.dtd-side .idx{position:absolute;font-size:8px;letter-spacing:.1em;color:rgba(130,130,130,.85)}',
      '.dtd-side .sec{position:absolute;left:22px;font-size:8px;letter-spacing:.3em;color:rgba(130,130,130,.7)}',
      '.dtd-side .foot{position:absolute;left:22px;right:20px;display:flex;align-items:center;',
      '  justify-content:space-between;font-size:8px;letter-spacing:.18em;color:rgba(130,130,130,.75)}',
      '.dtd-side .foot .bars{display:flex;gap:2px;align-items:flex-end}',
      '.dtd-side .foot .bars i{width:2px;background:#ff7500;opacity:.85;display:block}',
      '.dtd-sel{position:absolute;pointer-events:none;z-index:3;transition:left .14s ease,top .14s ease,',
      '  width .14s ease,height .14s ease,opacity .18s ease;opacity:0;',
      '  border:1px solid rgba(255,117,0,.55);',
      '  background:linear-gradient(90deg,rgba(255,117,0,.12),rgba(255,117,0,.02) 55%,transparent);',
      '  box-shadow:0 0 14px rgba(255,117,0,.22),inset 0 0 12px rgba(255,117,0,.10)}',
      '.dtd-sel.fixed{position:fixed}',
      '.dtd-sel.on{opacity:1}',
      '.dtd-sel.lock{border-color:rgba(255,190,110,.95);',
      '  box-shadow:0 0 22px rgba(255,140,30,.45),inset 0 0 18px rgba(255,140,30,.16)}',
      '.dtd-sel .k{position:absolute;width:5px;height:5px;border:1px solid #ffb45a;',
      '  background:rgba(255,180,90,.9);box-shadow:0 0 8px rgba(255,150,40,.8)}',
      '.dtd-sel .k.tl{left:0;top:0}.dtd-sel .k.tr{right:0;top:0}',
      '.dtd-sel .k.bl{left:0;bottom:0}.dtd-sel .k.br{right:0;bottom:0}',
      '.dtd-sel .bar{position:absolute;left:0;top:50%;transform:translateY(-50%);',
      '  width:3px;height:60%;background:#ff7500;box-shadow:0 0 10px rgba(255,117,0,.9)}',

      '.dtd-marks{position:absolute;inset:0;pointer-events:none;z-index:4}',
      '.dtd-marks i{position:absolute;width:3px;height:10px;background:rgba(255,117,0,.75);',
      '  box-shadow:0 0 8px rgba(255,117,0,.55)}',
      '.dtd-marks i.grp{width:5px;height:5px;background:#ff7500;box-shadow:0 0 10px rgba(255,117,0,.85)}',

      '.dtd-bottom{position:fixed;pointer-events:none;z-index:4;overflow:visible}',
      '.dtd-bottom .f{position:absolute;inset:0;border:1px solid rgba(255,117,0,.34);border-radius:12px;',
      '  box-shadow:0 0 18px rgba(255,117,0,.10),inset 0 0 18px rgba(255,117,0,.05)}',
      '.dtd-bottom .k{position:absolute;width:8px;height:8px;border:1px solid #ff9a3c;',
      '  background:rgba(255,140,40,.85);box-shadow:0 0 8px rgba(255,140,40,.7)}',
      '.dtd-bottom .k.tl{left:-4px;top:-4px}.dtd-bottom .k.tr{right:-4px;top:-4px}',
      '.dtd-bottom .k.bl{left:-4px;bottom:-4px}.dtd-bottom .k.br{right:-4px;bottom:-4px}',
      '.dtd-tele{position:fixed;pointer-events:none;z-index:4;display:flex;align-items:center;gap:6px;',
      '  font-family:"Cascadia Mono","Consolas",monospace;font-size:8px;letter-spacing:.28em;',
      '  color:rgba(255,117,0,.65);opacity:0;transition:opacity .3s ease}',
      '.dtd-tele.on{opacity:1}',
      '.dtd-tele .bars{display:flex;gap:2px;align-items:center}',
      '.dtd-tele .bars i{width:1px;background:rgba(255,117,0,.85);display:block}',

      '.dtd-bottom .cap{position:absolute;left:10px;top:-16px;font-size:8px;letter-spacing:.3em;color:rgba(255,117,0,.8);',
      '  font-family:"Cascadia Mono","Consolas",monospace}',

      '.dtd-side .frame{position:absolute;left:10px;right:10px;top:8px;bottom:8px;',
      '  border:1px solid rgba(255,117,0,.20);border-radius:6px}',
      '.dtd-side .cap{position:absolute;left:22px;font-size:8px;letter-spacing:.3em;color:rgba(255,117,0,.85)}',
      '.dtd-side .line{position:absolute;left:16px;right:16px;height:1px;',
      '  background:linear-gradient(90deg,transparent,rgba(255,117,0,.30),transparent)}',
      '.dtd-side .sep{position:absolute;right:0;top:0;bottom:0;width:1px;',
      '  background:linear-gradient(180deg,transparent,rgba(255,117,0,.45) 20%,rgba(255,117,0,.45) 80%,transparent)}',

      /* ── 设置页 ── */
      '.tds{display:flex;flex-direction:column;gap:0;max-width:640px;',
      '  font-size:13px;color:var(--dsw-alias-label-primary)}',
      '.tds-nav{display:flex;gap:6px;flex-wrap:wrap;padding:0 0 12px;margin-bottom:12px;',
      '  border-bottom:1px solid var(--dsw-alias-border-l2);position:sticky;top:0;',
      '  background:var(--dsw-alias-bg-layer-1,transparent);z-index:2}',
      '.tds-nav button{font:inherit;font-size:12px;padding:5px 12px;border-radius:999px;cursor:pointer;',
      '  border:1px solid var(--dsw-alias-border-l2);background:transparent;',
      '  color:var(--dsw-alias-label-secondary);transition:all .18s ease}',
      '.tds-nav button:hover{border-color:#ff7500;color:#ff7500}',
      '.tds-sec{padding:6px 0 18px;scroll-margin-top:8px}',
      '.tds-sec h4{margin:6px 0 10px;font-size:12px;letter-spacing:.14em;',
      '  color:var(--dsw-alias-label-tertiary);text-transform:uppercase}',
      '.tds-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:9px 0;',
      '  border-bottom:1px dashed var(--dsw-alias-border-l1,rgba(128,128,128,.2))}',
      '.tds-row .lab{flex:0 0 108px;font-size:12.5px}',
      '.tds-row .ctl{flex:1;display:flex;align-items:center;gap:10px}',
      '.tds-row input[type=range]{flex:1;accent-color:#ff7500;height:18px}',
      '.tds-row select,.tds-row input[type=number]{font:inherit;font-size:12px;padding:4px 8px;',
      '  border-radius:8px;border:1px solid var(--dsw-alias-border-l2);',
      '  background:var(--dsw-alias-bg-layer-3,transparent);color:inherit}',
      '.tds-val{flex:0 0 62px;text-align:right;font-size:12px;',
      '  color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}',
      '.tds-hint{flex:0 0 100%;margin:2px 0 0 120px;font-size:11px;color:var(--dsw-alias-label-tertiary)}',
      '.tds-btn{font:inherit;font-size:12px;padding:5px 12px;border-radius:8px;cursor:pointer;',
      '  border:1px solid var(--dsw-alias-border-l2);background:transparent;color:inherit}',
      '.tds-btn:hover{border-color:#ff7500;color:#ff7500}',
      '@media (max-width:900px){.dtd-vscale,.dtd-status{display:none}}'
    ].join('')

    function injectCss() {
      if (document.getElementById(CSS_ID)) return
      const tag = document.createElement('style')
      tag.id = CSS_ID
      tag.textContent = CSS
      document.head.appendChild(tag)
    }

    function pad2(n) { return String(n).padStart(2, '0') }
    function isDark() {
      if (settings.theme === 'dark') return true
      if (settings.theme === 'light') return false
      try {
        const el = document.documentElement
        const a = (el.getAttribute('data-theme') || el.getAttribute('data-dsh-theme') || '').toLowerCase()
        if (a.includes('dark')) return true
        if (a.includes('light')) return false
        if (el.classList.contains('dark')) return true
        if (el.classList.contains('light')) return false
        if (window.matchMedia) return !!window.matchMedia('(prefers-color-scheme: dark)').matches
      } catch (e) { /* noop */ }
      return false
    }

    function rad(d) { return (d - 90) * Math.PI / 180 }
    function arcPath(c, cx, cy, r, a0, a1) {
      const s = rad(a0)
      let e = rad(a1)
      if (a1 < a0) e += Math.PI * 2
      c.beginPath()
      c.arc(cx, cy, r, s, e, false)
    }

    /* ── 画布：边缘渐晕 + 两侧长条方块 + 准星 + 指针 ── */
    function useScene(canvasRef, intensityRef) {
      React.useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        let w = 0, h = 0, dpr = 1
        let raf = 0, last = 0, t = 0, running = true
        let intro = 0
        const ptr = { x: 0, y: 0, tx: 0, ty: 0, trailX: 0, trailY: 0, active: false }

        function resize() {
          dpr = Math.min(2, window.devicePixelRatio || 1)
          w = window.innerWidth
          h = window.innerHeight
          canvas.width = Math.floor(w * dpr)
          canvas.height = Math.floor(h * dpr)
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        }

        function draw() {
          const k = Math.max(0, Number(settings.intensity != null ? settings.intensity : intensityRef.current))
          const dark = isDark()
          const faint = dark ? '255,255,255' : '10,10,10'
          ctx.clearRect(0, 0, w, h)

          // 1) 边缘渐晕（中心完全透明，不挡正文）
          const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.72)
          vg.addColorStop(0, 'rgba(0,0,0,0)')
          vg.addColorStop(1, 'rgba(0,0,0,' + (0.05 * k).toFixed(3) + ')')
          ctx.fillStyle = vg
          ctx.fillRect(0, 0, w, h)

          // 2) 两侧长条方块下滑（避开中间内容区）
          const boxes = [[0.70, 0.10], [0.86, 0.14]]
          const blockH = 460, gap = 14, per = blockH + gap
          for (let b = 0; b < boxes.length; b += 1) {
            const bx = boxes[b][0] * w
            const bw = boxes[b][1] * w
            const off = (t * (14 + b * 6) * Math.max(0.1, settings.blockSpeed || 1)) % per
            ctx.save()
            ctx.beginPath()
            ctx.rect(bx, 0, bw, h)
            ctx.clip()
            for (let y = -per + off; y < h; y += per) {
              ctx.fillStyle = 'rgba(' + faint + ',' + (0.035 * k).toFixed(3) + ')'
              ctx.fillRect(bx, y, bw, blockH)
              ctx.fillStyle = 'rgba(' + faint + ',' + (0.06 * k).toFixed(3) + ')'
              ctx.fillRect(bx, y, bw, 1)
            }
            ctx.restore()
          }

          // 3) 准星（几何照搬 startup，低透明度）
          const CX = w * 0.32, CY = h * 0.46
          const gi = 1 - Math.pow(1 - intro, 3)
          const S = Math.min(w, h) * 0.26 / 150 * (0.12 + 0.88 * gi)
          const a1 = 0.13 * k * (0.35 + 0.65 * gi)
          const ringK = Math.max(0.1, settings.ringSpeed || 1)
          const rotA = (t * 360 / (18 / ringK)) * Math.PI / 180
          const rotB = -(t * 360 / (10.8 / ringK)) * Math.PI / 180
          const ink = dark ? '255,255,255' : '10,10,10'
          ctx.globalAlpha = 1

          ctx.save(); ctx.translate(CX, CY); ctx.rotate(rotA)
          ctx.strokeStyle = 'rgba(' + ink + ',' + a1.toFixed(3) + ')'
          ctx.lineWidth = 6 * S; ctx.lineCap = 'round'
          arcPath(ctx, 0, 0, 150 * S, 215, 505); ctx.stroke()
          ctx.restore()

          ctx.save(); ctx.translate(CX, CY); ctx.rotate(rotB)
          ctx.strokeStyle = 'rgba(' + ink + ',' + (a1 * 0.7).toFixed(3) + ')'
          ctx.lineWidth = 2.2 * S; ctx.lineCap = 'round'
          arcPath(ctx, 0, 0, 104 * S, 200, 490); ctx.stroke()
          ctx.restore()

          ctx.save(); ctx.translate(CX, CY)
          ctx.strokeStyle = 'rgba(' + ink + ',' + (a1 * 0.8).toFixed(3) + ')'
          ctx.lineWidth = 1.6 * S; ctx.lineCap = 'round'
          arcPath(ctx, 0, 0, 62 * S, 118, 242); ctx.stroke()
          arcPath(ctx, 0, 0, 62 * S, 298, 62); ctx.stroke()
          ctx.restore()

          // 三颗橙点
          const dots = [[-48, -68], [52, 68], [78, -50]]
          ctx.fillStyle = 'rgba(255,117,0,' + (0.30 * k).toFixed(3) + ')'
          for (let i = 0; i < dots.length; i += 1) {
            ctx.beginPath()
            ctx.arc(CX + dots[i][0] * S, CY + dots[i][1] * S, 2.8 * S, 0, Math.PI * 2)
            ctx.fill()
          }

          // 4) 扫描线（画布版，比 CSS 版更平顺）
          const phase = (t * 1000) % 26000
          if (phase < 3200) {
            const y = (phase / 3200) * (h + 80) - 40
            const lg = ctx.createLinearGradient(0, y - 30, 0, y + 30)
            lg.addColorStop(0, 'rgba(255,117,0,0)')
            lg.addColorStop(0.5, 'rgba(255,117,0,' + (0.10 * k).toFixed(3) + ')')
            lg.addColorStop(1, 'rgba(255,117,0,0)')
            ctx.fillStyle = lg
            ctx.fillRect(0, y - 30, w, 60)
          }

          // 5) 工程点阵（极淡，营造图纸感）
          const dotA = 0.045 * k
          ctx.fillStyle = 'rgba(' + faint + ',' + dotA.toFixed(3) + ')'
          const step = 34
          for (let gx = 0; gx < w; gx += step) {
            for (let gy = 0; gy < h; gy += step) {
              ctx.fillRect(gx, gy, 1, 1)
            }
          }
          // 每 4 格一个稍亮的点
          ctx.fillStyle = 'rgba(' + faint + ',' + (dotA * 2.2).toFixed(3) + ')'
          for (let gx = 0; gx < w; gx += step * 4) {
            for (let gy = 0; gy < h; gy += step * 4) {
              ctx.fillRect(gx - 1, gy - 1, 2, 2)
            }
          }

          // 6) 准星柔光：一层极淡的暖色光斑，取代刻度线
          const glowR = 150 * S * 2.6
          const glow = ctx.createRadialGradient(CX, CY, 0, CX, CY, glowR)
          glow.addColorStop(0, 'rgba(255,150,60,' + (0.055 * k * gi).toFixed(4) + ')')
          glow.addColorStop(0.55, 'rgba(255,150,60,' + (0.022 * k * gi).toFixed(4) + ')')
          glow.addColorStop(1, 'rgba(255,150,60,0)')
          ctx.fillStyle = glow
          ctx.beginPath()
          ctx.arc(CX, CY, glowR, 0, Math.PI * 2)
          ctx.fill()

          // 7) 同心淡环：三道细圆，缓慢呼吸扩缩（无刻度）
          const rings = [1.28, 1.62, 2.02]
          for (let i = 0; i < rings.length; i += 1) {
            const breathe = 1 + Math.sin(t * 0.35 + i * 1.1) * 0.012
            const rr = 150 * S * rings[i] * breathe
            ctx.strokeStyle = 'rgba(' + ink + ',' + ((0.075 - i * 0.018) * k * gi).toFixed(4) + ')'
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.arc(CX, CY, rr, 0, Math.PI * 2)
            ctx.stroke()
          }

          // 5) 指针 HUD
          if (ptr.active) {
            const x = ptr.tx, y = ptr.ty
            ctx.strokeStyle = 'rgba(255,117,0,0.18)'
            ctx.lineWidth = 1
            ctx.beginPath(); ctx.arc(ptr.trailX, ptr.trailY, 20, 0, Math.PI * 2); ctx.stroke()

            ctx.strokeStyle = 'rgba(255,117,0,' + (0.45 * k).toFixed(3) + ')'
            ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.stroke()

            const rot = t * 0.6
            ctx.strokeStyle = 'rgba(255,117,0,' + (0.35 * k).toFixed(3) + ')'
            ctx.beginPath()
            for (let i = 0; i < 4; i += 1) {
              const a = rot + i * Math.PI / 2
              ctx.moveTo(x + Math.cos(a) * 15, y + Math.sin(a) * 15)
              ctx.lineTo(x + Math.cos(a) * 21, y + Math.sin(a) * 21)
            }
            ctx.stroke()

            ctx.fillStyle = 'rgba(255,117,0,' + (0.7 * k).toFixed(3) + ')'
            ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill()

            ctx.font = '9px "Cascadia Mono","Consolas",monospace'
            ctx.fillStyle = 'rgba(' + faint + ',0.30)'
            const label = 'X ' + String(Math.round(x)).padStart(4, '0') + '  Y ' + String(Math.round(y)).padStart(4, '0')
            ctx.fillText(label, x + 26, y - 9)
          }
        }

        function loop(ts) {
          if (!running) return
          raf = requestAnimationFrame(loop)
          if (!last) last = ts
          const dt = ts - last
          if (dt < 33) return
          last = ts
          t += dt / 1000
          if (window.__DSH_TECH_DECO_INTRO_RESET__) {
            window.__DSH_TECH_DECO_INTRO_RESET__ = false
            intro = 0
          }
          if (intro < 1 && document.visibilityState === 'visible') intro = Math.min(1, intro + dt / 3200)
          window.__DSH_TECH_DECO_INTRO__ = intro
          if (ptr.active) {
            const rate = settings.pointer === 'instant' ? 1 : (settings.pointer === 'lag' ? 0.10 : 0.32)
            ptr.tx += (ptr.x - ptr.tx) * rate
            ptr.ty += (ptr.y - ptr.ty) * rate
            ptr.trailX += (ptr.tx - ptr.trailX) * (rate * 0.4)
            ptr.trailY += (ptr.ty - ptr.trailY) * (rate * 0.4)
          }
          draw()
        }

        function onMove(e) {
          ptr.x = e.clientX
          ptr.y = e.clientY
          if (!ptr.active) {
            ptr.tx = ptr.x; ptr.ty = ptr.y; ptr.trailX = ptr.x; ptr.trailY = ptr.y
            ptr.active = true
          }
        }
        function onLeave() { ptr.active = false }

        resize()
        draw()
        raf = requestAnimationFrame(loop)
        window.addEventListener('resize', resize)
        window.addEventListener('mousemove', onMove, { passive: true })
        window.addEventListener('mouseleave', onLeave)

        return () => {
          running = false
          if (raf) cancelAnimationFrame(raf)
          window.removeEventListener('resize', resize)
          window.removeEventListener('mousemove', onMove)
          window.removeEventListener('mouseleave', onLeave)
        }
      }, [])
    }

    /* ── 侧栏装饰：REV 行 / 导航序号 / 底部 OPS 行 / 分隔线 ── */
    function useSideDeco() {
      React.useEffect(() => {
        let timer = 0
        let tries = 0
        let host = null

        function findSidebar() {
          const nodes = document.body.querySelectorAll('*')
          const limit = Math.min(nodes.length, 3000)
          let best = null
          let bestW = 0
          for (let i = 0; i < limit; i += 1) {
            const el = nodes[i]
            if (!el || el.nodeType !== 1) continue
            if (el.id && el.id.indexOf('dsh-tech') === 0) continue
            if (el.closest && el.closest('.dsu-root, .dsu-stage')) continue
            const cs = getComputedStyle(el)
            if (cs.display === 'none' || cs.visibility === 'hidden') continue
            const r = el.getBoundingClientRect()
            if (r.left > 100) continue
            if (r.width < 140 || r.width > Math.min(window.innerWidth * 0.5, 560)) continue
            if (r.height < window.innerHeight * 0.4) continue
            if (r.width > bestW) { bestW = r.width; best = el }
          }
          return best
        }

        function build() {
          if (!host || !document.body.contains(host)) host = findSidebar()
          const old = document.getElementById('dsh-tech-deco-side')
          if (old && old.parentNode) old.parentNode.removeChild(old)
          if (!host) return

          try {
            if (getComputedStyle(host).position === 'static') host.style.position = 'relative'
          } catch (e) { /* noop */ }

          const box = document.createElement('div')
          box.id = 'dsh-tech-deco-side'
          box.className = 'dtd-side'

          // 专栏框：整块内描边 + 顶部标题 + 上下两条横线
          const frame = document.createElement('div')
          frame.className = 'frame'
          box.appendChild(frame)

          const cap = document.createElement('div')
          cap.className = 'cap'
          cap.style.top = '20px'
          cap.textContent = 'NAV // SYSTEM'
          box.appendChild(cap)

          const lineTop = document.createElement('div')
          lineTop.className = 'line'
          lineTop.style.top = '44px'
          box.appendChild(lineTop)

          const lineBot = document.createElement('div')
          lineBot.className = 'line'
          lineBot.style.bottom = '40px'
          box.appendChild(lineBot)

          const sep = document.createElement('i')
          sep.className = 'sep'
          box.appendChild(sep)

          const rev = document.createElement('div')
          rev.className = 'rev'
          rev.style.top = '58px'
          rev.innerHTML = '<i></i>REV 0.1.0 · WEB PROFILE'
          box.appendChild(rev)

          const foot = document.createElement('div')
          foot.className = 'foot'
          foot.style.bottom = '12px'
          foot.innerHTML = '<span>OPS · 0087</span><span class="bars">' +
            '<i style="height:5px"></i><i style="height:9px"></i>' +
            '<i style="height:6px"></i><i style="height:11px"></i></span>'
          box.appendChild(foot)

          // 导航序号：贴合宿主按钮位置
          try {
            const sr = host.getBoundingClientRect()
            const items = host.querySelectorAll('button, a')
            let idx = 0
            for (let i = 0; i < items.length && idx < 4; i += 1) {
              const it = items[i]
              const r = it.getBoundingClientRect()
              if (r.width < 60 || r.height < 18 || r.height > 52) continue
              if (r.top - sr.top < 86) continue
              idx += 1
              const tag = document.createElement('span')
              tag.className = 'idx'
              tag.textContent = ('0' + idx).slice(-2)
              tag.style.left = '6px'
              tag.style.top = Math.round(r.top - sr.top + r.height / 2 - 5) + 'px'
              box.appendChild(tag)
            }
          } catch (e) { /* noop */ }

          host.appendChild(box)
        }

        function tick() {
          tries += 1
          build()
          if (tries > 12) clearInterval(timer)
        }

        timer = setInterval(tick, 600)
        tick()
        const onResize = () => build()
        window.addEventListener('resize', onResize)

        return () => {
          clearInterval(timer)
          window.removeEventListener('resize', onResize)
          const el = document.getElementById('dsh-tech-deco-side')
          if (el && el.parentNode) el.parentNode.removeChild(el)
        }
      }, [])
    }

    /* ── 底部输入区装饰框（零侵入，纯叠加） ── */
    function useBottomDeco() {
      React.useEffect(() => {
        let box = null
        let timer = 0

        let tele = null

        function ensure() {
          if (!box || !box.isConnected) {
            box = document.createElement('div')
            box.className = 'dtd-bottom'
            box.innerHTML = '<div class="f"></div>' +
              '<i class="k tl"></i><i class="k tr"></i><i class="k bl"></i><i class="k br"></i>' +
              '<div class="cap">// COMPOSER</div>'
            document.body.appendChild(box)
          }
          if (!tele || !tele.isConnected) {
            tele = document.createElement('div')
            tele.className = 'dtd-tele'
            tele.innerHTML = '<span class="bars">' +
              '<i style="height:4px"></i><i style="height:8px"></i><i style="height:5px"></i></span>' +
              '<span>TELEMETRY</span>'
            document.body.appendChild(tele)
          }
          return box
        }

        function findComposer() {
          const W = window.innerWidth, H = window.innerHeight
          const nodes = document.body.querySelectorAll('div, section, form')
          const limit = Math.min(nodes.length, 4000)
          let withInput = null
          let withInputArea = Infinity
          let fallback = null
          let fallbackScore = -1
          for (let i = 0; i < limit; i += 1) {
            const el = nodes[i]
            if (el.closest && el.closest('#dsh-tech-deco-side, .dtd-root, .dtd-sel, .dtd-marks, .dtd-bottom, .dtd-tele')) continue
            const r = el.getBoundingClientRect()
            if (r.width < W * 0.45) continue
            if (r.height < 50 || r.height > 280) continue
            if (r.top < H * 0.62) continue
            if (r.bottom < H * 0.86) continue
            const score = r.width * r.height
            if (score > fallbackScore) { fallbackScore = score; fallback = el }
            // 优先：内部含输入控件的**最小**容器
            if (el.querySelector && el.querySelector('textarea, input, [contenteditable="true"]')) {
              if (score < withInputArea) { withInputArea = score; withInput = el }
            }
          }
          return withInput || fallback
        }

        function findStatusBar(composer) {
          const W = window.innerWidth, H = window.innerHeight
          const base = composer ? composer.getBoundingClientRect() : null
          const nodes = document.body.querySelectorAll('div, section, footer')
          const limit = Math.min(nodes.length, 4000)
          let best = null
          let bestTop = -1
          for (let i = 0; i < limit; i += 1) {
            const el = nodes[i]
            if (el.closest && el.closest('#dsh-tech-deco-side, .dtd-root, .dtd-sel, .dtd-marks, .dtd-bottom, .dtd-tele')) continue
            const r = el.getBoundingClientRect()
            if (r.width < W * 0.4) continue
            if (r.height < 12 || r.height > 44) continue
            if (r.bottom < H * 0.82) continue
            if (base && r.top < base.bottom - 2) continue
            if (r.top > bestTop) { bestTop = r.top; best = el }
          }
          return best
        }

        function measure() {
          const b = ensure()
          const el = findComposer()
          if (!el) {
            b.style.opacity = '0'
            if (tele) tele.classList.remove('on')
            return
          }
          const r = el.getBoundingClientRect()
          b.style.opacity = '1'
          b.style.left = Math.round(r.left - 2) + 'px'
          b.style.top = Math.round(r.top - 2) + 'px'
          b.style.width = Math.round(r.width + 4) + 'px'
          b.style.height = Math.round(r.height + 4) + 'px'

          const bar = findStatusBar(el)
          if (bar && tele) {
            const br = bar.getBoundingClientRect()
            tele.style.left = Math.round(br.left + 8) + 'px'
            tele.style.top = Math.round(br.top + br.height / 2 - 6) + 'px'
            tele.classList.add('on')
          } else if (tele) {
            tele.classList.remove('on')
          }
        }

        measure()
        timer = setInterval(measure, 1200)
        const onResize = () => measure()
        window.addEventListener('resize', onResize)

        return () => {
          clearInterval(timer)
          window.removeEventListener('resize', onResize)
          if (box && box.parentNode) box.parentNode.removeChild(box)
          if (tele && tele.parentNode) tele.parentNode.removeChild(tele)
        }
      }, [])
    }

    /* ── 科技风方块选中框（全局）：可点击栏位全部适用 ── */
    function useGlobalSelection() {
      React.useEffect(() => {
        let hoverEl = null
        let lockEl = null
        let box = null

        const TARGETS = 'button, a, [role="button"], [role="menuitem"], [role="tab"], [role="option"], [tabindex], li'
        const SKIP = 'input, textarea, select, [contenteditable="true"]'

        function ensureBox() {
          if (!box || !box.isConnected) {
            box = document.createElement('div')
            box.className = 'dtd-sel fixed'
            box.innerHTML = '<i class="k tl"></i><i class="k tr"></i><i class="k bl"></i><i class="k br"></i><i class="bar"></i>'
            document.body.appendChild(box)
          }
          return box
        }

        function visible(el) {
          if (!el || !el.isConnected) return false
          const cs = getComputedStyle(el)
          if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) return false
          const r = el.getBoundingClientRect()
          return r.width >= 14 && r.height >= 12
        }

        function place() {
          const b = ensureBox()
          const el = (hoverEl && visible(hoverEl)) ? hoverEl : ((lockEl && visible(lockEl)) ? lockEl : null)
          if (!el) { b.classList.remove('on'); return }
          const r = el.getBoundingClientRect()
          // 过大或过小的目标不加框，避免框住整块面板或小图标
          if (r.width < 60 || r.height < 18 || r.height > 96) { b.classList.remove('on'); return }
          b.style.left = Math.round(r.left - 2) + 'px'
          b.style.top = Math.round(r.top - 2) + 'px'
          b.style.width = Math.round(r.width + 4) + 'px'
          b.style.height = Math.round(r.height + 4) + 'px'
          b.classList.add('on')
          b.classList.toggle('lock', !hoverEl && !!lockEl)
        }

        function pick(target) {
          if (!target || !target.closest) return null
          if (target.closest && target.closest(SKIP)) return null
          if (target.closest && target.closest('.dtd-root, .dtd-sel, #dsh-tech-deco-side, .dtd-marks')) return null
          const el = target.closest(TARGETS)
          if (!el || !visible(el)) return null
          // 排除大段文本容器（消息体、代码块、表格等），只框真正的控件
          const txt = (el.textContent || '').trim()
          if (txt.length > 40) return null
          const r = el.getBoundingClientRect()
          if (r.width < 20 || r.height < 14) return null
          if (r.width > window.innerWidth * 0.75) return null
          return el
        }

        let raf = 0
        let dirty = false
        function tick() {
          raf = requestAnimationFrame(tick)
          if (!dirty) return
          dirty = false
          place()
        }

        function onOver(e) {
          const el = pick(e.target)
          if (el === hoverEl) return
          hoverEl = el
          dirty = true
        }
        function onOut(e) {
          if (!e.target || !e.target.closest) return
          const el = e.target.closest(TARGETS)
          if (el && el === hoverEl) { hoverEl = null; dirty = true }
        }
        let lockTimer = 0
        function onClick(e) {
          const el = pick(e.target)
          if (!el) return
          lockEl = el
          hoverEl = null
          dirty = true
          window.clearTimeout(lockTimer)
          lockTimer = window.setTimeout(() => {
            lockEl = null
            dirty = true
          }, 1500)
        }
        function onScroll() { dirty = true }

        document.addEventListener('pointerover', onOver, true)
        document.addEventListener('pointerout', onOut, true)
        document.addEventListener('click', onClick, true)
        document.addEventListener('scroll', onScroll, true)
        window.addEventListener('resize', onScroll)
        raf = requestAnimationFrame(tick)
        dirty = true

        return () => {
          document.removeEventListener('pointerover', onOver, true)
          document.removeEventListener('pointerout', onOut, true)
          document.removeEventListener('click', onClick, true)
          document.removeEventListener('scroll', onScroll, true)
          window.removeEventListener('resize', onScroll)
          cancelAnimationFrame(raf)
          window.clearTimeout(lockTimer)
          if (box && box.parentNode) box.parentNode.removeChild(box)
        }
      }, [])
    }

    /* ── 侧栏悬停 / 点击音效（全局委托，不改宿主） ── */
    function useSideSfx() {
      React.useEffect(() => {
        let actx = null
        function audio() {
          try {
            if (!actx) {
              const C = window.AudioContext || window.webkitAudioContext
              if (!C) return null
              actx = new C()
            }
            if (actx.state === 'suspended') actx.resume().catch(() => {})
            return actx
          } catch (e) { return null }
        }
        function beep(freq, dur, vol, type, delay) {
          const ac = audio()
          if (!ac) return
          vol = vol * Math.max(0, Math.min(1, settings.soundVolume))
          const t0 = ac.currentTime + (delay || 0)
          const osc = ac.createOscillator()
          const g = ac.createGain()
          osc.type = type || 'sine'
          osc.frequency.setValueAtTime(freq, t0)
          g.gain.setValueAtTime(0.0001, t0)
          g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008)
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
          osc.connect(g).connect(ac.destination)
          osc.start(t0)
          osc.stop(t0 + dur + 0.02)
        }
        function hoverSfx() { beep(2400, 0.018, 0.012, 'sine') }
        function clickSfx() {
          beep(1800, 0.014, 0.022, 'square')
          beep(880, 0.05, 0.016, 'sine', 0.012)
          beep(120, 0.06, 0.018, 'sine', 0.01)
        }

        function inSidebar(target) {
          const host = document.querySelector('#dsh-tech-deco-side') &&
            document.querySelector('#dsh-tech-deco-side').parentElement
          if (!host || !target) return false
          return host.contains(target) && target !== host
        }

        let lastKey = null
        function onOver(e) {
          const host = document.querySelector('#dsh-tech-deco-side')
          const parent = host && host.parentElement
          if (!parent || !e.target || !parent.contains(e.target)) return
          const el = e.target.closest ? e.target.closest('button, a, [role="button"]') : null
          if (!el) return
          const r = el.getBoundingClientRect()
          const key = Math.round(r.top) + ':' + Math.round(r.left) + ':' + el.textContent.slice(0, 12)
          if (key === lastKey) return
          lastKey = key
          hoverSfx()
        }
        function onOut() { lastKey = null }
        function onClick(e) {
          if (inSidebar(e.target)) clickSfx()
        }

        document.addEventListener('pointerover', onOver, true)
        document.addEventListener('pointerout', onOut, true)
        document.addEventListener('click', onClick, true)
        return () => {
          document.removeEventListener('pointerover', onOver, true)
          document.removeEventListener('pointerout', onOut, true)
          document.removeEventListener('click', onClick, true)
        }
      }, [])
    }

    /* ── 设置页：分类导航 + 锚点跳转 ── */
    function SettingsPanel() {
      const [s, setS] = React.useState(() => Object.assign({}, settings))
      React.useEffect(() => {
        const on = (e) => setS(Object.assign({}, e.detail))
        window.addEventListener('dsh-tech-deco:settings', on)
        return () => window.removeEventListener('dsh-tech-deco:settings', on)
      }, [])

      const upd = (patch) => {
        saveSettings(patch)
        setS((prev) => Object.assign({}, prev, patch))
      }
      const pct = (v) => Math.round(v * 100) + '%'
      const mult = (v) => Number(v).toFixed(2) + '×'
      const secRef = (id) => () => {
        const el = document.getElementById(id)
        if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }

      const row = (label, ctl, val, hint) => h('div', { className: 'tds-row', key: label },
        h('div', { className: 'lab' }, label),
        h('div', { className: 'ctl' }, ctl),
        val ? h('div', { className: 'tds-val' }, val) : null,
        hint ? h('div', { className: 'tds-hint' }, hint) : null)

      const range = (key, min, max, step) => h('input', {
        type: 'range', min, max, step, value: s[key],
        onChange: (e) => { upd({ [key]: Number(e.target.value) }) }
      })

      return h('div', { className: 'tds' },
        h('div', { className: 'tds-nav' },
          h('button', { type: 'button', onClick: secRef('tds-motion') }, '动效'),
          h('button', { type: 'button', onClick: secRef('tds-visual') }, '视觉'),
          h('button', { type: 'button', onClick: secRef('tds-sound') }, '声音'),
          h('button', { type: 'button', onClick: secRef('tds-reset') }, '重置')),

        h('section', { className: 'tds-sec', id: 'tds-motion' },
          h('h4', null, '动效'),
          row('圆环转速', range('ringSpeed', 0.25, 3, 0.25), mult(s.ringSpeed),
            '1× ≈ 18 秒转一圈；越高越快'),
          row('背景方块速度', range('blockSpeed', 0.25, 3, 0.25), mult(s.blockSpeed),
            '两侧长条方块的滑动倍率'),
          row('指针跟随', h('select', {
            value: s.pointer,
            onChange: (e) => upd({ pointer: e.target.value })
          },
            h('option', { value: 'instant' }, '立即跟随'),
            h('option', { value: 'close' }, '贴近跟随'),
            h('option', { value: 'lag' }, '延迟跟随')),
            null, '“延迟跟随”会留下明显的拖尾')) ,

        h('section', { className: 'tds-sec', id: 'tds-visual' },
          h('h4', null, '视觉'),
          row('整体浓度', range('intensity', 0, 2, 0.1), String(Number(s.intensity).toFixed(1)),
            '0 = 几乎不可见，2 = 默认'),
          row('主题配色', h('select', {
            value: s.theme,
            onChange: (e) => upd({ theme: e.target.value })
          },
            h('option', { value: 'follow' }, '跟随 startup / 系统'),
            h('option', { value: 'light' }, '强制浅色'),
            h('option', { value: 'dark' }, '强制深色')))),

        h('section', { className: 'tds-sec', id: 'tds-sound' },
          h('h4', null, '声音'),
          row('选中提示音量', range('soundVolume', 0, 1, 0.05), pct(s.soundVolume),
            '侧栏悬停「叮」与点击「哒—咚」的音量')),

        h('section', { className: 'tds-sec', id: 'tds-reset' },
          h('h4', null, '重置'),
          h('div', { className: 'tds-row' },
            h('div', { className: 'lab' }, '默认值'),
            h('div', { className: 'ctl' },
              h('button', {
                type: 'button', className: 'tds-btn',
                onClick: () => upd(Object.assign({}, DEFAULTS))
              }, '恢复默认')),
            null)
          , h('div', { className: 'tds-hint', style: { marginLeft: '120px' } },
            '所有设置保存在 localStorage，卸载插件即失效。')))
    }

    function Deco() {
      const canvasRef = React.useRef(null)
      const intensityRef = React.useRef(2)
      const [time, setTime] = React.useState(() => {
        const d = new Date()
        return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds())
      })
      const [hidden, setHidden] = React.useState(false)

      useScene(canvasRef, intensityRef)

      useSideDeco()
      useGlobalSelection()
      useBottomDeco()
      useSideSfx()

      React.useEffect(() => {
        const timer = setInterval(() => {
          const d = new Date()
          setTime(pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds()))
        }, 1000)
        window.__DSH_TECH_DECO__ = {
          hide: () => setHidden(true),
          replay: () => {
            window.__DSH_TECH_DECO_INTRO_RESET__ = true
          },
          get intro() { return window.__DSH_TECH_DECO_INTRO__ || 0 },
          show: () => setHidden(false),
          setIntensity: (v) => { intensityRef.current = Math.max(0, Math.min(2, Number(v) || 0)) },
          get intensity() { return intensityRef.current }
        }
        return () => {
          clearInterval(timer)
          delete window.__DSH_TECH_DECO__
        }
      }, [])

      const ticks = (pos) => h('div', { className: 'dtd-ticks ' + pos, key: 'tick-' + pos },
        Array.from({ length: 25 }, (_, i) => h('i', { key: i })))

      return h('div', {
        className: 'dtd-root',
        'data-hidden': hidden ? '1' : '0',
        'aria-hidden': true,
        style: { opacity: hidden ? 0 : 1 }
      },
        h('canvas', { className: 'dtd-canvas', ref: canvasRef }),
        h('div', { className: 'dtd-grain' }),
        h('i', { className: 'dtd-c tl' }),
        h('i', { className: 'dtd-c tr' }),
        h('i', { className: 'dtd-c bl' }),
        h('i', { className: 'dtd-c br' }),
        ticks('top'),
        ticks('bottom'),
        h('div', { className: 'dtd-vscale' },
          Array.from({ length: 13 }, (_, i) => h('i', { key: i, className: i % 4 === 0 ? 'big' : '' }))),
        h('div', { className: 'dtd-info' },
          h('div', { className: 'ln' }, h('i'), h('span', null, 'BUILD ', h('b', null, '0.1.0'))),
          h('div', { className: 'ln' }, h('i'), h('span', null, 'DECO · ACTIVE')),
          h('div', null, 'PROFILE : WEB')
        ),
        h('div', { className: 'dtd-status' },
          h('div', null, 'REV 0.1.0 · DECO'),
          h('div', { className: 't' }, time),
          h('div', null, h('i', { className: 'dtd-dot' }), 'SYS STATUS : ', h('b', null, 'ONLINE'))
        )
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        loadSettings()
        injectCss()
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: 'tech-deco',
          order: 5
        }, Deco))
        try {
          ctx.slots.inject('settings.section', () => ctx.slots.register({
            name: 'settings.section',
            id: 'tech-deco',
            order: 28,
            label: '科技装饰'
          }, SettingsPanel))
        } catch (e) { /* noop */ }
      }
    }
  }
})
