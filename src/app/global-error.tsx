'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[global-error]', error?.message, 'digest:', error?.digest, '\n', error?.stack)
  }, [error])

  return (
    <html lang="ko">
      <body style={{ margin: 0, padding: 16, fontFamily: 'system-ui, -apple-system, sans-serif', background: '#f9fafb' }}>
        <div style={{ maxWidth: 720, margin: '40px auto', padding: 24, background: '#fef2f2', border: '2px solid #dc2626', borderRadius: 12 }}>
          <h1 style={{ color: '#7f1d1d', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>🚨 시스템 에러 (global)</h1>
          <p style={{ fontSize: 13, color: '#7f1d1d', marginBottom: 12 }}>
            최상위에서 잡힌 에러입니다. 아래 메시지/digest 캡처해서 개발자에게 보내주세요.
          </p>
          <div style={{ background: '#fff', border: '1px solid #fecaca', padding: 12, borderRadius: 8, fontSize: 12, color: '#7f1d1d', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            <div><b>message:</b> {error?.message ?? '(no message)'}</div>
            {error?.digest && <div style={{ marginTop: 4 }}><b>digest:</b> {error.digest}</div>}
            {error?.stack && (
              <details style={{ marginTop: 8 }}>
                <summary style={{ cursor: 'pointer' }}>stack 보기</summary>
                <pre style={{ fontSize: 10, marginTop: 6, overflowX: 'auto' }}>{error.stack}</pre>
              </details>
            )}
          </div>
          <button
            onClick={reset}
            style={{ marginTop: 12, padding: '8px 14px', background: '#dc2626', color: '#fff', border: 0, borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  )
}
