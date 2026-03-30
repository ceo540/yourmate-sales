export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto animate-pulse">
      <div className="mb-6">
        <div className="h-7 w-24 bg-gray-200 rounded mb-2" />
        <div className="h-4 w-36 bg-gray-100 rounded" />
      </div>
      <div className="flex gap-2 mb-5">
        <div className="h-9 w-32 bg-gray-100 rounded-lg" />
        <div className="flex-1" />
        <div className="h-9 w-24 bg-gray-100 rounded-lg" />
        <div className="h-9 w-20 bg-gray-200 rounded-lg" />
      </div>
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="h-3 w-16 bg-gray-100 rounded mb-3" />
            <div className="h-7 w-24 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="h-3 w-20 bg-gray-100 rounded mb-3" />
            <div className="space-y-2">
              {[...Array(3)].map((_, j) => <div key={j} className="h-4 bg-gray-50 rounded" />)}
            </div>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="h-10 bg-gray-50 rounded mb-4" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-gray-50 rounded" />)}
        </div>
      </div>
    </div>
  )
}
