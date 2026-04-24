'use client'

export const AVATAR_COLORS = ['bg-yellow-400', 'bg-blue-400', 'bg-green-400', 'bg-purple-400', 'bg-orange-400']

interface Props {
  name: string
  idx?: number
  size?: 'sm' | 'md'
}

export default function Avatar({ name, idx = 0, size = 'sm' }: Props) {
  const sz = size === 'sm' ? 'w-5 h-5 text-xs' : 'w-7 h-7 text-sm'
  return (
    <div className={`${sz} ${AVATAR_COLORS[idx % AVATAR_COLORS.length]} rounded-full flex items-center justify-center font-bold text-gray-900 flex-shrink-0`}>
      {name[0]}
    </div>
  )
}
