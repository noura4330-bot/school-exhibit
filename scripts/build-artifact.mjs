// يجمع النسخة المبنية في ملف HTML واحد لنشرها كصفحة Artifact (لا يُسمح فيها بملفات CSS/JS خارجية).
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'

const assets = readdirSync('dist/assets')
const css = readFileSync(`dist/assets/${assets.find((f) => f.endsWith('.css'))}`, 'utf8')
if (assets.filter((f) => f.endsWith('.js')).length > 1) throw new Error('more than one JS chunk; the artifact must be a single file')
const js = readFileSync(`dist/assets/${assets.find((f) => f.startsWith('index-') && f.endsWith('.js'))}`, 'utf8')
if (js.includes('</script')) throw new Error('bundle contains </script')

const html = `<title>معرض التمكين المدرسي</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap">
<style>${css}</style>
<div id="root"></div>
<script type="module">${js}</script>
`
mkdirSync('artifact', { recursive: true })
writeFileSync('artifact/index.html', html)
console.log('artifact/index.html', Math.round(html.length / 1024), 'KB')
