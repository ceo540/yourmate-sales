export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto animate-pulse">
      <div className="h-7 w-28 bg-gray-200 rounded mb-6" />
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-50 rounded" />
          ))}
        </div>
      </div>
    </div>
  )
}
