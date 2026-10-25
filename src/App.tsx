import { Component, useEffect, type ReactNode } from 'react'
import { StoreProvider, useStore } from './data/store'
import { FeedbackProvider } from './components/feedback'
import { CloudGate } from './components/CloudGate'
import { cloudEnabled } from './lib/cloud'
import { Layout } from './components/Layout'
import { Message } from './components/ui'
import { useRoute, type RouteId } from './lib/router'
import HomePage from './pages/HomePage'
import InitiativePage from './pages/InitiativePage'
import GovernancePage from './pages/GovernancePage'
import GovernanceAdminPage from './pages/GovernanceAdminPage'
import ProfessionalPage from './pages/ProfessionalPage'
import TeachingPage from './pages/TeachingPage'
import ProjectsPage from './pages/ProjectsPage'
import EvidencePage from './pages/EvidencePage'
import ImpactPage from './pages/ImpactPage'
import ReadinessPage from './pages/ReadinessPage'
import ReportsPage from './pages/ReportsPage'
import FilesPage from './pages/FilesPage'
import SettingsPage from './pages/SettingsPage'

const pages: Record<RouteId, (p: { param: string }) => ReactNode> = {
  home: () => <HomePage />,
  initiative: () => <InitiativePage />,
  governance: ({ param }) => (param === 'manage' ? <GovernanceAdminPage /> : <GovernancePage />),
  professional: () => <ProfessionalPage />,
  teaching: () => <TeachingPage />,
  projects: () => <ProjectsPage />,
  evidence: ({ param }) => <EvidencePage focusId={param} />,
  impact: () => <ImpactPage />,
  readiness: () => <ReadinessPage />,
  reports: () => <ReportsPage />,
  files: () => <FilesPage />,
  settings: () => <SettingsPage />,
}

class ErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null })
  }
  render() {
    if (this.state.error)
      return (
        <Message tone="danger" title="حدث خطأ غير متوقع في عرض هذه الصفحة">
          بياناتك لم تُحذف. انتقلي إلى صفحة أخرى أو أعيدي تحميل الصفحة، وإن تكرر الخطأ فصدّري نسخة احتياطية من الإعدادات.
          <div className="caption ltr" style={{ marginTop: 8 }}>
            {this.state.error.message}
          </div>
        </Message>
      )
    return this.props.children
  }
}

function Shell() {
  const { route, param } = useRoute()
  const { saveError, loadError } = useStore()
  useEffect(() => {
    window.scrollTo(0, 0)
    document.getElementById('main')?.focus({ preventScroll: true })
  }, [route])
  return (
    <Layout route={route}>
      <div className="page">
        {loadError && <Message tone="danger" title="تنبيه بشأن البيانات">{loadError}</Message>}
        {saveError && <Message tone="danger" title="لم يكتمل الحفظ">{saveError}</Message>}
        <ErrorBoundary resetKey={route}>{pages[route]({ param })}</ErrorBoundary>
      </div>
    </Layout>
  )
}

export default function App() {
  // الحفظ المركزي: لا يُعرض الموقع قبل تسجيل الدخول بحساب مصرّح له وتحميل البيانات من القاعدة
  return (
    <FeedbackProvider>
      {cloudEnabled ? (
        <CloudGate>
          <Shell />
        </CloudGate>
      ) : (
        <StoreProvider>
          <Shell />
        </StoreProvider>
      )}
    </FeedbackProvider>
  )
}
