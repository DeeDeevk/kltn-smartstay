export default function TienIch({ icon: Icon, name }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-gray-100 bg-gray-50 p-3">
      <span className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
        <Icon size={16} />
      </span>
      <span className="text-sm font-medium text-gray-700">{name}</span>
    </div>
  );
}
