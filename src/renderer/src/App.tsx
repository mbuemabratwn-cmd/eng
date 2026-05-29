import { useState } from 'react'
import SessionSidebar from './components/SessionSidebar'
import DashboardPanel from './components/DashboardPanel'
import SettingsModal from './components/SettingsModal'
import ChatPage from './pages/ChatPage'
import ErrorBoundary from './components/ErrorBoundary'

export default function App() {
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [dashboardCollapsed, setDashboardCollapsed] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const handleSessionSelect = (sessionId: number) => {
    setActiveSessionId(sessionId)
  }

  const handleNewSession = () => {
    setActiveSessionId(null)
  }

  return (
    <ErrorBoundary>
      <div className="app-shell three-column">
        <SessionSidebar
          activeSessionId={activeSessionId}
          onSessionSelect={handleSessionSelect}
          onNewSession={handleNewSession}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        <div className="main-content">
          <ChatPage
            sessionId={activeSessionId}
            onSettingsClick={() => setSettingsOpen(true)}
          />
        </div>

        <DashboardPanel
          collapsed={dashboardCollapsed}
          onToggleCollapse={() => setDashboardCollapsed(!dashboardCollapsed)}
        />

        <SettingsModal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />
      </div>
    </ErrorBoundary>
  )
}
