import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base: './' يتيح تشغيل النسخة المبنية من أي مسار أو استضافة ثابتة
export default defineConfig({
  base: './',
  plugins: [react()],
})
