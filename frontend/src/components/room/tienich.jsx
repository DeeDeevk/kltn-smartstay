export default function TienIch({ url, name }) {
  return (
    <div className="flex items-center gap-2 border rounded-lg p-2 bg-white">
      <img src={url} className="w-6 h-6 shrink-0 rounded-sm" />
      <span className="text-sm">{name}</span>
    </div>
  );
}
