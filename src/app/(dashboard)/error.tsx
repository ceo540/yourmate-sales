'use client'

import { useEffect } from 'react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[dashboard-error]', error?.message, 'digest:', error?.digest, '\n', error?.stack)
  }, [error])

  return (
    <div style={{ padding: 16, maxWidth: 720, margin: '24px auto' }}>
      <div style={{ background: '#fef2f2', border: '2px solid #dc2626', borderRadius: 12, padding: 20 }}>
        <h2 style={{ color: '#7f1d1d', fontSize: 16, fontWeight: 700, marginBottom: 8 }}>🚨 화면 에러 (dashboard)</h2>
        <p style={{ fontSize: 12, color: '#7f1d1d', marginBottom: 10 }}>
          이 화면에서 에러가 발생했습니다. 아래 메시지·digest 캡처 후 [다시 시도]를 눌러주세요.
        </p>
        <div style={{ background: '#fff', border: '1px solid #fecaca', padding: 10, borderRadius: 6, fontSize: 11, color: '#7f1d1d', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          <div><b>message:</b> {error?.message ?? '(no message)'}</div>
          {error?.digest && <div style={{ marginTop: 4 }}><b>digest:</b> {error.digest}</div>}
          {error?.stack && (
            <details style={{ marginTop: 6 }}>
              <summary style={{ cursor: 'pointer' }}>stack 보기</summary>
              <pre style={{ fontSize: 10, marginTop: 4, overflowX: 'auto' }}>{error.stack}</pre>
            </details>
          )}
        </div>
        <button
          onClick={reset}
          style={{ marginTop: 10, padding: '6px 12px', background: '#dc2626', color: '#fff', border: 0, borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
        >
          다시 시도
        </button>
      </div>
    </div>
  )
}
