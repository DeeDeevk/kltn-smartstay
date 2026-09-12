import { useTranslation } from 'react-i18next';

const STATUS_STYLES = {
  Active: 'bg-green-50 text-green-600',
  Locked: 'bg-red-50 text-red-600',
};

const STATUS_LABEL_KEYS = {
  Active: 'common.statusActive',
  Locked: 'common.statusLocked',
};

export default function StatusBadge({ status }) {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex items-center rounded-full text-xs font-semibold px-2.5 py-1 ${
        STATUS_STYLES[status] || 'bg-gray-100 text-gray-600'
      }`}
    >
      {STATUS_LABEL_KEYS[status] ? t(STATUS_LABEL_KEYS[status]) : status}
    </span>
  );
}
