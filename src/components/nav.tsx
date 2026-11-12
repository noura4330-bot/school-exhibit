// عناصر التنقل الرئيسية ومجموعاتها، مشتركة بين القائمة وعناوين الصفحات.
import type { ReactNode } from 'react'
import {
  DataTrendingRegular,
  DocumentTextRegular,
  FolderOpenRegular,
  HomeRegular,
  SettingsRegular,
} from '@fluentui/react-icons'
import type { RouteId } from '../lib/router'

// بطلب مديرة النظام (2026-11-12) يقتصر الموقع على توثيق شواهد البرامج ومتابعتها؛ الصفحات الأخرى مخفية من القائمة
// وتبقى بياناتها وروابطها المباشرة كما هي.
export const navItems: { id: RouteId; label: string; icon: ReactNode; group: string }[] = [
  { id: 'home', label: 'الرئيسية', icon: <HomeRegular />, group: 'المبادرة' },
  { id: 'initiative', label: 'ملف المبادرة', icon: <DocumentTextRegular />, group: 'المبادرة' },
  { id: 'evidence', label: 'الشواهد والأدلة', icon: <FolderOpenRegular />, group: 'التوثيق والمتابعة' },
  { id: 'impact', label: 'قياس الأثر', icon: <DataTrendingRegular />, group: 'التوثيق والمتابعة' },
  { id: 'settings', label: 'الإعدادات', icon: <SettingsRegular />, group: 'الإدارة' },
]
