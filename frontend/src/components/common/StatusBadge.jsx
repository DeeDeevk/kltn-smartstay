const STATUS_STYLES = {
  Active: 'bg-green-50 text-green-600',
  Locked: 'bg-red-50 text-red-600',
};

const STATUS_LABELS = {
  Active: 'Đang hoạt động',
  Locked: 'Đã bị khóa',
};

export default function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full text-xs font-semibold px-2.5 py-1 ${
        STATUS_STYLES[status] || 'bg-gray-100 text-gray-600'
      }`}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}
