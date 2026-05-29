interface TabNavProps {
  activeTab: 'chat' | 'dashboard' | 'settings'
  onTabChange: (tab: 'chat' | 'dashboard' | 'settings') => void
}

export default function TabNav({ activeTab, onTabChange }: TabNavProps) {
  return (
    <nav className="tab-nav">
      <button
        className={`tab-button ${activeTab === 'chat' ? 'tab-active' : ''}`}
        onClick={() => onTabChange('chat')}
      >
        对话
      </button>
      <button
        className={`tab-button ${activeTab === 'dashboard' ? 'tab-active' : ''}`}
        onClick={() => onTabChange('dashboard')}
      >
        仪表盘
      </button>
      <button
        className={`tab-button ${activeTab === 'settings' ? 'tab-active' : ''}`}
        onClick={() => onTabChange('settings')}
      >
        设置
      </button>
    </nav>
  )
}
