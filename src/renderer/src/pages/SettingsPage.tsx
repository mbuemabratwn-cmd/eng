import { useState, useEffect } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'

interface BackupConfig {
  backupDir: string
  maxBackups: number
  autoBackupEnabled: boolean
  autoBackupIntervalHours: number
}

interface BackupInfo {
  filename: string
  path: string
  timestamp: string
  sizeBytes: number
}

interface AIConfig {
  apiKey: string
  baseUrl: string
  model: string
}

export default function SettingsPage() {
  const [backupConfig, setBackupConfig] = useState<BackupConfig | null>(null)
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [aiConfig, setAiConfig] = useState<AIConfig>({ apiKey: '', baseUrl: '', model: '' })
  const [aiSaved, setAiSaved] = useState(false)

  const [confirmDialog, setConfirmDialog] = useState<{
    visible: boolean
    title: string
    message: string
    onConfirm: () => void
  }>({ visible: false, title: '', message: '', onConfirm: () => {} })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [config, backupList, apiKey, baseUrl, model] = await Promise.all([
        window.appApi.getBackupConfig(),
        window.appApi.listBackups(),
        window.appApi.getSetting('ai.api_key'),
        window.appApi.getSetting('ai.base_url'),
        window.appApi.getSetting('ai.model')
      ])
      setBackupConfig(config)
      setBackups(backupList)
      setAiConfig({
        apiKey: apiKey || '',
        baseUrl: baseUrl || 'https://987xyz.com/v1',
        model: model || 'gpt-5.5'
      })
      setError(null)
    } catch (err) {
      console.error('Failed to load settings:', err)
      setError('加载设置失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveAI = async () => {
    try {
      await window.appApi.updateSetting('ai.api_key', aiConfig.apiKey)
      await window.appApi.updateSetting('ai.base_url', aiConfig.baseUrl)
      await window.appApi.updateSetting('ai.model', aiConfig.model)
      setAiSaved(true)
      setTimeout(() => setAiSaved(false), 2000)
    } catch (err) {
      console.error('Failed to save AI config:', err)
      setError('保存 AI 配置失败')
    }
  }

  const handleToggleAutoBackup = async () => {
    if (!backupConfig) return
    try {
      const updated = await window.appApi.updateBackupConfig({
        autoBackupEnabled: !backupConfig.autoBackupEnabled
      })
      setBackupConfig(updated)
    } catch (err) {
      console.error('Failed to update backup config:', err)
      setError('更新备份配置失败')
    }
  }

  const handleIntervalChange = async (hours: number) => {
    if (!backupConfig) return
    try {
      const updated = await window.appApi.updateBackupConfig({
        autoBackupIntervalHours: hours
      })
      setBackupConfig(updated)
    } catch (err) {
      console.error('Failed to update backup config:', err)
      setError('更新备份配置失败')
    }
  }

  const handleMaxBackupsChange = async (max: number) => {
    if (!backupConfig) return
    try {
      const updated = await window.appApi.updateBackupConfig({
        maxBackups: max
      })
      setBackupConfig(updated)
    } catch (err) {
      console.error('Failed to update backup config:', err)
      setError('更新备份配置失败')
    }
  }

  const handleCreateBackup = async () => {
    try {
      const result = await window.appApi.createBackup('manual')
      if (result.success) {
        await loadData()
      } else {
        setError(result.error || '备份失败')
      }
    } catch (err) {
      console.error('Failed to create backup:', err)
      setError('创建备份失败')
    }
  }

  const handleDeleteBackup = async (filename: string) => {
    setConfirmDialog({
      visible: true,
      title: '删除备份',
      message: `确定要删除备份 "${filename}" 吗？此操作不可恢复。`,
      onConfirm: async () => {
        try {
          await window.appApi.deleteBackup(filename)
          await loadData()
        } catch (err) {
          console.error('Failed to delete backup:', err)
          setError('删除备份失败')
        }
        setConfirmDialog(prev => ({ ...prev, visible: false }))
      }
    })
  }

  const handleRestoreBackup = async (filename: string) => {
    setConfirmDialog({
      visible: true,
      title: '恢复备份',
      message: `确定要恢复备份 "${filename}" 吗？当前数据将被替换，系统会自动创建快照备份。`,
      onConfirm: async () => {
        try {
          const result = await window.appApi.restoreBackup(filename)
          if (result.success) {
            await loadData()
          } else {
            setError(result.error || '恢复失败')
          }
        } catch (err) {
          console.error('Failed to restore backup:', err)
          setError('恢复备份失败')
        }
        setConfirmDialog(prev => ({ ...prev, visible: false }))
      }
    })
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleString('zh-CN')
  }

  if (loading) {
    return (
      <div className="settings-page">
        <div className="settings-header">
          <h2>设置</h2>
        </div>
        <div className="settings-content">
          <div className="stat-empty">加载中...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h2>设置</h2>
      </div>

      {error && (
        <div className="settings-error">
          {error}
          <button onClick={() => setError(null)}>关闭</button>
        </div>
      )}

      <div className="settings-content">
        {/* AI Configuration */}
        <section className="settings-section">
          <h3>AI 配置</h3>
          <div className="settings-form">
            <div className="settings-row">
              <label>
                <span>API Key</span>
                <input
                  type="password"
                  value={aiConfig.apiKey}
                  onChange={(e) => setAiConfig({ ...aiConfig, apiKey: e.target.value })}
                  placeholder="sk-..."
                />
              </label>
            </div>
            <div className="settings-row">
              <label>
                <span>Base URL</span>
                <input
                  type="text"
                  value={aiConfig.baseUrl}
                  onChange={(e) => setAiConfig({ ...aiConfig, baseUrl: e.target.value })}
                  placeholder="https://api.openai.com/v1"
                />
              </label>
            </div>
            <div className="settings-row">
              <label>
                <span>模型</span>
                <input
                  type="text"
                  value={aiConfig.model}
                  onChange={(e) => setAiConfig({ ...aiConfig, model: e.target.value })}
                  placeholder="gpt-5.5"
                />
              </label>
            </div>
            <div className="settings-row">
              <button className="primary-button" onClick={handleSaveAI}>
                保存 AI 配置
              </button>
              {aiSaved && <span className="save-success">已保存</span>}
            </div>
          </div>
        </section>

        {/* Backup Settings */}
        <section className="settings-section">
          <h3>备份设置</h3>
          {backupConfig && (
            <div className="settings-form">
              <div className="settings-row">
                <label>
                  <span>自动备份</span>
                  <button
                    className={`toggle-button ${backupConfig.autoBackupEnabled ? 'active' : ''}`}
                    onClick={handleToggleAutoBackup}
                  >
                    {backupConfig.autoBackupEnabled ? '已开启' : '已关闭'}
                  </button>
                </label>
              </div>

              {backupConfig.autoBackupEnabled && (
                <div className="settings-row">
                  <label>
                    <span>备份间隔</span>
                    <select
                      value={backupConfig.autoBackupIntervalHours}
                      onChange={(e) => handleIntervalChange(Number(e.target.value))}
                    >
                      <option value={6}>每 6 小时</option>
                      <option value={12}>每 12 小时</option>
                      <option value={24}>每 24 小时</option>
                      <option value={48}>每 48 小时</option>
                      <option value={168}>每周</option>
                    </select>
                  </label>
                </div>
              )}

              <div className="settings-row">
                <label>
                  <span>最大备份数</span>
                  <select
                    value={backupConfig.maxBackups}
                    onChange={(e) => handleMaxBackupsChange(Number(e.target.value))}
                  >
                    <option value={5}>5 个</option>
                    <option value={10}>10 个</option>
                    <option value={20}>20 个</option>
                    <option value={50}>50 个</option>
                  </select>
                </label>
              </div>

              <div className="settings-row">
                <button className="primary-button" onClick={handleCreateBackup}>
                  立即备份
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Backup List */}
        <section className="settings-section">
          <h3>备份记录</h3>
          {backups.length > 0 ? (
            <div className="backup-list">
              {backups.map((backup) => (
                <div className="backup-item" key={backup.filename}>
                  <div className="backup-info">
                    <span className="backup-name">{backup.filename}</span>
                    <span className="backup-meta">
                      {formatDate(backup.timestamp)} · {formatSize(backup.sizeBytes)}
                    </span>
                  </div>
                  <div className="backup-actions">
                    <button
                      className="secondary-button"
                      onClick={() => handleRestoreBackup(backup.filename)}
                    >
                      恢复
                    </button>
                    <button
                      className="danger-button"
                      onClick={() => handleDeleteBackup(backup.filename)}
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="stat-empty">暂无备份</div>
          )}
        </section>
      </div>

      <ConfirmDialog
        visible={confirmDialog.visible}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel="确认"
        cancelLabel="取消"
        danger={confirmDialog.title === '删除备份'}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, visible: false }))}
      />
    </div>
  )
}
