import fs from 'node:fs'

const url = fs.readFileSync('D:/工作区/启动文件/dsh-web-launcher/last-url.txt', 'utf8').trim()
const tok = (url.match(/token=([^&]+)/) || [])[1]
const base = 'http://127.0.0.1:3080'
const jar = new Map()
const absorb = (r) => {
  const list = r.headers.getSetCookie ? r.headers.getSetCookie() : []
  for (const l of list) {
    const q = l.split(';')[0]
    const i = q.indexOf('=')
    if (i > 0) jar.set(q.slice(0, i).trim(), q.slice(i + 1).trim())
  }
}
const ck = () => [...jar].map(([k, v]) => k + '=' + v).join('; ')

await fetch(base + '/?token=' + tok, { redirect: 'manual' }).then(absorb)
const r = await fetch(base + '/', { headers: { cookie: ck() } })
const html = await r.text()
console.log('  首页 status:', r.status)
console.log('  含 dsh-tech-deco:', html.includes('dsh-tech-deco'))
const refs = [...new Set((html.match(/dsh-tech-deco\/client\.js[^"'\s<>]*/g) || []))]
console.log('  模块引用:', refs.length ? refs.join(' , ') : '(无)')
