'use client'

import { useState, useTransition } from 'react'
import {
  NotificationConfig,
  NotificationSetting,
  NotificationSettingId,
} from '@/lib/notification-settings'
import {
  saveNotificationSettingAction,
  saveChanneltalkUserIdAction,
  previewPaymentRemindersAction,
} from '../notifications-actions'

interface ProfileLite {
  id: string
  name: string | null
  channeltalk_user_id: string | null
}

interface Props {
  settings: NotificationSetting[]
  profiles: ProfileLite[]
}

const SEND_TO_LABEL: Record<string, string> = {
  service_group: '서비스별 채널 (자동 라우팅)',
  fixed_group: '고정 채널 (아래 ID 사용)',
  default_group: '기본 채널 (0_YOURMATE_OFFICIAL)',
}

export default function NotificationsTab({ settings: initialSettings, profiles: initialProfiles }: Props) {
  const [settings, setSettings] = useState(initialSettings)
  const [profiles, setProfiles] = useState(initialProfiles)
  const [isPending, startTransition] = useTransition()
  const [preview, setPreview] = useState<unknown>(null)
  const [error, setError] = useState<string | null>(null)

  const updateLocal = (id: NotificationSettingId, partial: Partial<NotificationSetting>) => {
    setSettings(prev => prev.map(s => s.id === id ? { ...s, ...partial } : s))
  }

  const persist = (id: NotificationSettingId, patch: { enabled?: boolean; config?: Partial<NotificationConfig> }) => {
    startTransition(async () => {
      try {
        await saveNotificationSettingAction(id, patch)
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })
  }

  const handleEnabled = (s: NotificationSetting, value: boolean) => {
    updateLocal(s.id, { enabled: value })
    persist(s.id, { enabled: value })
  }

  const handleConfigPatch = (s: NotificationSetting, patch: Partial<NotificationConfig>) => {
    const nextConfig = { ...s.config, ...patch }
    updateLocal(s.id, { config: nextConfig })
    persist(s.id, { config: patch })
  }

  const handleArrayChange = (s: NotificationSetting, key: 'd_minus' | 'd_plus', text: string) => {
    const arr = text
      .split(/[\s,]+/)
      .map(x => x.trim())
      .filter(Boolean)
      .map(x => Number(x))
      .filter(n => !isNaN(n) && n >= 0)
    handleConfigPatch(s, { [key]: arr } as Partial<NotificationConfig>)
  }

  const handleChanneltalkId = (userId: string, value: string) => {
    setProfiles(prev => prev.map(p => p.id === userId ? { ...p, channeltalk_user_id: value || null } : p))
    startTransition(async () => {
      try {
        await saveChanneltalkUserIdAction(userId, value || null)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })
  }

  const handlePreview = () => {
    setPreview(null)
    setError(null)
    startTransition(async () => {
      const r = await previewPaymentRemindersAction()
      if (r.ok) setPreview(r.result)
      else setError(r.error ?? 'unknown error')
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">알림 설정</h2>
          <p className="text-xs text-gray-500 mt-0.5">결제 입금 / 외주비 지급 알림 자동화</p>
        </div>
        <button
          onClick={handlePreview}
          disabled={isPending}
          className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 hover:border-yellow-400 hover:text-yellow-700 disabled:opacity-40 transition-colors"
        >
          지금 미리보기 실행 (dry-run)
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {settings.map(s => (
        <div key={s.id} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{s.label}</h3>
              <p className="text-xs text-gray-500 mt-0.5 max-w-xl">{s.description}</p>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={s.enabled}
                onChange={e => handleEnabled(s, e.target.checked)}
                className="w-4 h-4"
              />
              <span className={s.enabled ? 'text-green-600 font-medium' : 'text-gray-400'}>
                {s.enabled ? '켜짐' : '꺼짐'}
              </span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <label className="space-y-1">
              <span className="text-xs text-gray-500">며칠 전부터 (D-N, 콤마/공백 구분)</span>
              <input
                type="text"
                defaultValue={s.config.d_minus.join(', ')}
                onBlur={e => handleArrayChange(s, 'd_minus', e.target.value)}
                placeholder="3, 0"
                className="w-full px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:border-yellow-400"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-gray-500">며칠 후까지 (D+N, 콤마/공백 구분)</span>
              <input
                type="text"
                defaultValue={s.config.d_plus.join(', ')}
                onBlur={e => handleArrayChange(s, 'd_plus', e.target.value)}
                placeholder="1, 7"
                className="w-full px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:border-yellow-400"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <label className="space-y-1">
              <span className="text-xs text-gray-500">발송 채널 방식</span>
              <select
                value={s.config.send_to}
                onChange={e => handleConfigPatch(s, { send_to: e.target.value as NotificationConfig['send_to'] })}
                className="w-full px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:border-yellow-400 bg-white"
              >
                {Object.entries(SEND_TO_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
            {s.config.send_to === 'fixed_group' && (
              <label className="space-y-1">
                <span className="text-xs text-gray-500">채널톡 그룹 ID</span>
                <input
                  type="text"
                  defaultValue={s.config.target_group_id ?? ''}
                  onBlur={e => handleConfigPatch(s, { target_group_id: e.target.value || null })}
                  placeholder="예: 563786"
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:border-yellow-400"
                />
              </label>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={s.config.include_assignee_mention}
              onChange={e => handleConfigPatch(s, { include_assignee_mention: e.target.checked })}
              className="w-4 h-4"
            />
            <span className="text-gray-600">담당자 멘션 포함</span>
          </label>
        </div>
      ))}

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">직원별 채널톡 ID</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            멘션을 진짜 채널톡 멘션으로 보내려면 채널톡 매니저 ID 매핑 필요. 비어있으면 텍스트(@이름)로만 표시됨.
          </p>
        </div>
        <div className="space-y-2">
          {profiles.map(p => (
            <div key={p.id} className="flex items-center gap-2 text-sm">
              <span className="w-32 text-gray-700">{p.name ?? '(이름 없음)'}</span>
              <input
                type="text"
                defaultValue={p.channeltalk_user_id ?? ''}
                onBlur={e => {
                  const v = e.target.value.trim()
                  if (v !== (p.channeltalk_user_id ?? '')) handleChanneltalkId(p.id, v)
                }}
                placeholder="채널톡 매니저 ID (선택)"
                className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:border-yellow-400"
              />
            </div>
          ))}
        </div>
      </div>

      {preview !== null && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <div className="text-xs font-semibold text-gray-700 mb-2">미리보기 결과 (dry-run)</div>
          <pre className="text-xs text-gray-600 overflow-auto max-h-96 whitespace-pre-wrap">
            {JSON.stringify(preview, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
