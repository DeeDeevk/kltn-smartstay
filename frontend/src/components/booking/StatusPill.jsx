export default function StatusPill({ value, styles, label }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset whitespace-nowrap ${
        styles[value] || 'bg-gray-100 text-gray-600 ring-gray-200'
      }`}
    >
      {label}
    </span>
  );
}
