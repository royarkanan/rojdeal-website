export default function Loading() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-pulse pb-12">
      <div className="lg:col-span-2 space-y-4">
        <div className="w-full h-80 sm:h-96 bg-gray-200 rounded-[22px]" />
        <div className="bg-white p-6 rounded-[22px] space-y-4">
          <div className="h-6 bg-gray-200 rounded w-2/3" />
          <div className="h-10 bg-gray-200 rounded w-1/3" />
          <div className="h-20 bg-gray-200 rounded" />
        </div>
      </div>
      <div className="bg-white p-6 rounded-[22px] h-64 bg-gray-100" />
    </div>
  );
}
