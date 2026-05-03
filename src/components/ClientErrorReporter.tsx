'use client'

import { useEffect, useState } from 'react'

type Err = { id: number; msg: string; src?: string; ts: number }

export default function ClientErrorReporter() {
  const [errs, setErrs] = useState<Err[]>([])

  useEffect(() => {
    let counter = 0

    const push = (msg: string, src?: string) => {
      try {
        counter += 1
        const id = counter
        const ts = Date.now()
        setErrs(prev => [...prev.slice(-4), { id, msg, src, ts }])
        // 콘솔에도 표준 prefix 로 남김
        console.error('[client-err]', src ?? '', msg)
      } catch {
        // 자기 자신 에러로 무한 루프 방지
      }
    }

    const onError = (ev: ErrorEvent) => {
      const msg = ev.message || (ev.error instanceof Error ? ev.error.message : 'unknown error')
      const stackHead = ev.error instanceof Error
        ? ev.error.stack?.split('\n').slice(0, 3).join(' | ')
        : undefined
      push(stackHead ? `${msg} || ${stackHead}` : msg, `${ev.filename ?? '?'}:${ev.lineno ?? '?'}:${ev.colno ?? '?'}`)
    }

    const onRejection = (ev: PromiseRejectionEvent) => {
      const r: unknown = ev.reason
      let msg: string
      let stackHead: string | undefined
      if (r instanceof Error) {
        msg = r.message
        stackHead = r.stack?.split('\n').slice(0, 3).join(' | ')
      } else if (typeof r === 'string') {
        msg = r
      } else {
        try { msg = JSON.stringify(r) } catch { msg = String(r) }
      }
      push(stackHead ? `${msg} || ${stackHead}` : msg, 'unhandledrejection')
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  if (errs.length === 0) return null

  return (
    <div style={{ position: 'fixed', top: 8, right: 8, zIndex: 9999, maxWidth: 360, pointerEvents: 'none' }}>
      {errs.map(e => (
        <div
          key={e.id}
          style={{
            background: '#fef2f2',
            border: '2px solid #dc2626',
            color: '#7f1d1d',
            padding: '8px 10px',
            marginBottom: 6,
            borderRadius: 6,
            fontSize: 11,
            wordBreak: 'break-word',
            pointerEvents: 'auto',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 2 }}>🚨 클라이언트 에러</div>
          {e.src && <div style={{ opacity: 0.7, fontSize: 10 }}>{e.src}</div>}
          <div style={{ marginTop: 4 }}>{e.msg}</div>
          <button
            type="button"
            onClick={() => setErrs(prev => prev.filter(x => x.id !== e.id))}
            style={{ marginTop: 4, fontSize: 10, padding: '2px 6px', background: '#fff', border: '1px solid #dc2626', borderRadius: 3, color: '#7f1d1d', cursor: 'pointer' }}
          >
            닫기
          </button>
        </div>
      ))}
    </div>
  )
}
