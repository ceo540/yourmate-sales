export default function Loading() {
  return (
    <div className="max-w-5xl mx-auto animate-pulse">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="h-7 w-24 bg-gray-200 rounded mb-2" />
          <div className="h-4 w-36 bg-gray-100 rounded" />
        </div>
        <div className="h-9 w-24 bg-gray-200 rounded-lg" />
      </div>
      <div className="flex gap-2 mb-6">
        {[...Array(3)].map((_, i) => <div key={i} className="h-8 w-20 bg-gray-100 rounded-lg" />)}
        <div className="flex-1" />
        <div className="h-8 w-32 bg-gray-100 rounded-lg" />
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="space-y-3">
          {[...Array(7)].map((_, i) => <div key={i} className="h-14 bg-gray-50 rounded" />)}
        </div>
      </div>
    </div>
  )
}
