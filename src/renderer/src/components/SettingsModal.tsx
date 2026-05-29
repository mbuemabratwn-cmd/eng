import { useState, useEffect } from 'react'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

interface AppSettings {
  aiProvider: string
  aiModel: string
  aiApiKey: string
  aiBaseUrl: string
  language: string
  autoBackup: boolean
  backupInterval: number
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [settings, setSettings] = useState<AppSettings>({
    aiProvider: 'openai',
    aiModel: 'gpt-4',
    aiApiKey: '',
    aiBaseUrl: '',
    language: 'zh-CN',
    autoBackup: false,
    backupInterval: 24
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadSettings()
    }
  }, [isOpen])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const [provider, model, apiKey, baseUrl, language, autoBackup, backupInterval] = await Promise.all([
        window.appApi.getSetting('ai.provider'),
        window.appApi.getSetting('ai.model'),
        window.appApi.getSetting('ai.apiKey'),
        window.appApi.getSetting('ai.baseUrl'),
        window.appApi.getSetting('app.language'),
        window.appApi.getSetting('backup.autoEnabled'),
        window.appApi.getSetting('backup.intervalHours')
      ])

      setSettings({
        aiProvider: provider || 'openai',
        aiModel: model || 'gpt-4',
        aiApiKey: apiKey || '',
        aiBaseUrl: baseUrl || '',
        language: language || 'zh-CN',
        autoBackup: autoBackup === 'true',
        backupInterval: parseInt(backupInterval || '24', 10)
      })
    } catch (err) {
      console.error('Failed to load settings:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveSuccess(false)
    try {
      await Promise.all([
        window.appApi.updateSetting('ai.provider', settings.aiProvider),
        window.appApi.updateSetting('ai.model', settings.aiModel),
        window.appApi.updateSetting('ai.apiKey', settings.aiApiKey),
        window.appApi.updateSetting('ai.baseUrl', settings.aiBaseUrl),
        window.appApi.updateSetting('app.language', settings.language),
        window.appApi.updateSetting('backup.autoEnabled', settings.autoBackup.toString()),
        window.appApi.updateSetting('backup.intervalHours', settings.backupInterval.toString())
      ])
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2000)
    } catch (err) {
      console.error('Failed to save settings:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (field: keyof AppSettings, value: string | boolean | number) => {
    setSettings(prev => ({ ...prev, [field]: value }))
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>设置</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="settings-loading">加载中...</div>
          ) : (
            <>
              <div className="settings-section">
                <h3>AI 配置</h3>
                <div className="settings-form">
                  <div className="settings-row">
                    <label>
                      <span>AI 提供商</span>
                      <select
                        value={settings.aiProvider}
                        onChange={e => handleChange('aiProvider', e.target.value)}
                      >
                        <option value="openai">OpenAI</option>
                        <option value="anthropic">Anthropic</option>
                        <option value="custom">自定义</option>
                      </select>
                    </label>
                  </div>

                  <div className="settings-row">
                    <label>
                      <span>模型</span>
                      <input
                        type="text"
                        value={settings.aiModel}
                        onChange={e => handleChange('aiModel', e.target.value)}
                        placeholder="gpt-4"
                      />
                    </label>
                  </div>

                  <div className="settings-row">
                    <label>
                      <span>API Key</span>
                      <input
                        type="password"
                        value={settings.aiApiKey}
                        onChange={e => handleChange('aiApiKey', e.target.value)}
                        placeholder="sk-..."
                      />
                    </label>
                  </div>

                  <div className="settings-row">
                    <label>
                      <span>Base URL</span>
                      <input
                        type="text"
                        value={settings.aiBaseUrl}
                        onChange={e => handleChange('aiBaseUrl', e.target.value)}
                        placeholder="https://api.openai.com/v1"
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="settings-section">
                <h3>通用设置</h3>
                <div className="settings-form">
                  <div className="settings-row">
                    <label>
                      <span>语言</span>
                      <select
                        value={settings.language}
                        onChange={e => handleChange('language', e.target.value)}
                      >
                        <option value="zh-CN">中文</option>
                        <option value="en">English</option>
                      </select>
                    </label>
                  </div>

                  <div className="settings-row">
                    <label>
                      <span>自动备份</span>
                      <button
                        className={`toggle-button ${settings.autoBackup ? 'active' : ''}`}
                        onClick={() => handleChange('autoBackup', !settings.autoBackup)}
                      >
                        {settings.autoBackup ? '开启' : '关闭'}
                      </button>
                    </label>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          {saveSuccess && <span className="save-success">保存成功</span>}
          <button className="cancel-button" onClick={onClose}>取消</button>
          <button
            className="save-button"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
