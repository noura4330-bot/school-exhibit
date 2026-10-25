import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/app.css'
import App from './App'
import { watchTableLabels } from './lib/tableLabels'
import { enableTouchActive } from './lib/motion'

// يضمن الاتجاه واللغة حتى عند تضمين الصفحة في قالب لا يحددهما
document.documentElement.dir = 'rtl'
document.documentElement.lang = 'ar'
// هوية المعرض الافتراضية قبل قراءة الإعدادات، لتجنب وميض لون آخر
document.documentElement.dataset.brand ??= 'navy'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

watchTableLabels(document.getElementById('root')!)
enableTouchActive()
