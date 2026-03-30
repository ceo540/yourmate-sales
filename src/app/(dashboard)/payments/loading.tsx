export default function Loading() {
  return (
    <div className="max-w-5xl mx-auto animate-pulse">
      <div className="mb-8">
        <div className="h-7 w-28 bg-gray-200 rounded mb-2" />
        <div className="h-4 w-44 bg-gray-100 rounded" />
      </div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="h-3 w-20 bg-gray-100 rounded mb-3" />
            <div className="h-8 w-28 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-7 w-10 bg-gray-100 rounded-lg" />
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-50 rounded" />
          ))}
        </div>
      </div>
    </div>
  )
}
