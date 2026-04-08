export default function Loading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-8 w-28 bg-gray-200 rounded" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <div className="h-3 w-16 bg-gray-100 rounded mb-2" />
            <div className="h-6 w-12 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
            <div className="h-5 w-20 bg-gray-200 rounded mb-3" />
            <div className="space-y-2">
              {[...Array(4)].map((_, j) => (
                <div key={j} className="bg-white rounded-xl h-20 border border-gray-100" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
