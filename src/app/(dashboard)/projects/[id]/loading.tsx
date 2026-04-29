// Next.js App Router 자동 활용. /projects/[id] 진입 시 데이터 fetch 동안 표시.
// 사용자 보고: 행 클릭 시 로딩 인디케이터 부재.

export default function ProjectLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-5 space-y-3">
        <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
        <div className="flex items-center gap-3">
          <div className="h-7 w-20 bg-gray-100 rounded-full animate-pulse" />
          <div className="h-8 w-72 bg-gray-100 rounded animate-pulse" />
          <div className="h-6 w-16 bg-gray-100 rounded-full animate-pulse" />
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-7 w-24 bg-gray-100 rounded-full animate-pulse" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-5">
        <div className="space-y-4">
          <div className="h-24 bg-yellow-50 border border-yellow-200 rounded-xl animate-pulse" />
          <div className="h-32 bg-white border border-gray-100 rounded-xl animate-pulse" />
          <div className="h-48 bg-white border border-gray-100 rounded-xl animate-pulse" />
        </div>
        <div className="space-y-3">
          <div className="h-64 bg-white border border-gray-100 rounded-xl animate-pulse" />
          <div className="h-32 bg-white border border-gray-100 rounded-xl animate-pulse" />
        </div>
      </div>
      <div className="mt-6 text-xs text-gray-400 text-center">프로젝트 불러오는 중…</div>
    </div>
  )
}
