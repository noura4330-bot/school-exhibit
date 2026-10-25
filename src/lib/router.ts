// توجيه بسيط يعتمد على الرابط (#/الصفحة) ليعمل على أي استضافة ثابتة دون إعداد خادم.
import { useEffect, useState } from 'react'

export type RouteId =
  | 'home'
  | 'initiative'
  | 'governance'
  | 'professional'
  | 'teaching'
  | 'projects'
  | 'evidence'
  | 'impact'
  | 'readiness'
  | 'reports'
  | 'files'
  | 'settings'

const routes: RouteId[] = [
  'home',
  'initiative',
  'governance',
  'professional',
  'teaching',
  'projects',
  'evidence',
  'impact',
  'readiness',
  'reports',
  'files',
  'settings',
]

function parse(): { route: RouteId; param: string } {
  const [route, param = ''] = window.location.hash.replace(/^#\/?/, '').split('/')
  return { route: (routes as string[]).includes(route) ? (route as RouteId) : 'home', param: decodeURIComponent(param) }
}

export function useRoute() {
  const [state, setState] = useState(parse)
  useEffect(() => {
    const on = () => setState(parse())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return state
}

export const href = (route: RouteId | string, param?: string) =>
  `#/${route === 'home' ? '' : route}${param ? `/${encodeURIComponent(param)}` : ''}`

export const navigate = (route: RouteId | string, param?: string) => {
  window.location.hash = href(route, param)
}
