// الحركة في الموقع: ظهور الأقسام عند دخولها الشاشة، وعمق خفيف لصورة الواجهة مع المؤشر.
// كل ما هنا يتوقف عند تفعيل «تقليل الحركة» في النظام، ولا يخفي أي محتوى إن لم يعمل.
import { useEffect, useLayoutEffect, useRef } from 'react'

export const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** عناصر الصفحة المباشرة داخل المحتوى الرئيسي، ما عدا الترويسة والتذييل وواجهة الرئيسية (لها حركتها) */
const SKIP = '.site-banner, .site-footer, .hp, .modal-backdrop, script'

/**
 * يُظهر أقسام الصفحة بتتابع خفيف عند دخولها الشاشة (IntersectionObserver).
 * الفئتان rv/in تُضافان فقط هنا: إن أعاد React رسم العنصر وحذفهما يبقى ظاهرًا كالمعتاد.
 */
export function useReveal(key: string) {
  useLayoutEffect(() => {
    const main = document.getElementById('main')
    if (!main || reducedMotion() || !('IntersectionObserver' in window)) return
    const els = Array.from(main.children).filter((el): el is HTMLElement => el instanceof HTMLElement && !el.matches(SKIP))
    const io = new IntersectionObserver(
      (entries) => {
        let i = 0
        for (const e of entries) {
          if (!e.isIntersecting) continue
          const el = e.target as HTMLElement
          el.style.setProperty('--rv-d', `${Math.min(i++, 4) * 70}ms`)
          el.classList.add('in')
          io.unobserve(el)
        }
      },
      { rootMargin: '0px 0px -40px 0px' },
    )
    for (const el of els) {
      el.classList.add('rv')
      io.observe(el)
    }
    return () => {
      io.disconnect()
      for (const el of els) {
        el.classList.remove('rv', 'in')
        el.style.removeProperty('--rv-d')
      }
    }
  }, [key])
}

/** عمق خفيف لصورة الواجهة: تتحرك الصورة والعناصر التقنية قليلًا مع المؤشر (للمؤشر الدقيق فقط) */
export function useHeroDepth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || reducedMotion() || !matchMedia('(hover: hover) and (pointer: fine)').matches) return
    let frame = 0
    const set = (x: number, y: number) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        el.style.setProperty('--px', x.toFixed(3))
        el.style.setProperty('--py', y.toFixed(3))
      })
    }
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      set(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1)
    }
    const onLeave = () => set(0, 0)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
    return () => {
      cancelAnimationFrame(frame)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
    }
  }, [])
  return ref
}

/** يفعّل حالة الضغط (:active) على اللمس في متصفحات iOS، كي تظهر استجابة الأزرار باللمس أيضًا */
export function enableTouchActive() {
  document.addEventListener('touchstart', () => {}, { passive: true })
}
