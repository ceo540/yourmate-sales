'use client'
import { useFormStatus } from 'react-dom'

interface Props {
  label?: string
  loadingLabel?: string
  className?: string
  style?: React.CSSProperties
  fullWidth?: boolean
}

export default function SubmitButton({
  label = '등록',
  loadingLabel = '처리 중...',
  className = '',
  style,
  fullWidth = false,
}: Props) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className={`relative py-2.5 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-70 disabled:cursor-not-allowed ${fullWidth ? 'w-full' : 'px-6'} ${className}`}
      style={style ?? { backgroundColor: '#FFCE00', color: '#121212' }}
    >
      {pending ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          {loadingLabel}
        </span>
      ) : label}
    </button>
  )
}
