export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto animate-pulse">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-7 w-28 bg-gray-200 rounded mb-2" />
          <div className="h-4 w-44 bg-gray-100 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <div className="h-3 w-16 bg-gray-100 rounded mb-2" />
            <div className="h-7 w-10 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
      <div className="flex gap-4 h-[520px]">
        <div className="flex-1 bg-white rounded-xl border border-gray-200 p-4">
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-50 rounded" />
            ))}
          </div>
        </div>
        <div className="flex-1 bg-white rounded-xl border border-gray-200 p-4">
          <div className="h-6 w-32 bg-gray-200 rounded mb-4" />
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-8 bg-gray-50 rounded" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
