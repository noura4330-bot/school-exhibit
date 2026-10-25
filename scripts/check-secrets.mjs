// يمنع نشر أي مفتاح سري لقاعدة البيانات: يفحص الكود والنسخة المبنية بحثًا عن مفتاح sb_secret_ أو مفتاح JWT بدور service_role.
// يُشغَّل في GitHub Actions قبل النشر، فيتوقف النشر إن وُجد مفتاح سري.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const roots = process.argv.slice(2).length ? process.argv.slice(2) : ['src', 'dist']
const files = []
const walk = (p) => {
  try {
    if (statSync(p).isDirectory()) for (const f of readdirSync(p)) walk(join(p, f))
    else files.push(p)
  } catch {
    /* مجلد غير موجود */
  }
}
roots.forEach(walk)

const found = []
for (const f of files) {
  if (!/\.(js|mjs|ts|tsx|html|json|css|map)$/.test(f)) continue
  const text = readFileSync(f, 'utf8')
  for (const m of text.matchAll(/sb_secret_[A-Za-z0-9_-]{10,}/g)) found.push(`${f}: ${m[0].slice(0, 14)}…`)
  for (const m of text.matchAll(/eyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}/g)) {
    try {
      const claims = JSON.parse(Buffer.from(m[1], 'base64url').toString())
      if (claims.role && claims.role !== 'anon') found.push(`${f}: JWT role=${claims.role}`)
    } catch {
      /* ليس JWT */
    }
  }
}
if (found.length) {
  console.error('مفتاح سري في الملفات! أوقف النشر واحذفه، ثم غيّر المفتاح من لوحة Supabase:\n' + found.join('\n'))
  process.exit(1)
}
console.log(`لا مفاتيح سرية (${files.length} ملفًا)`)
