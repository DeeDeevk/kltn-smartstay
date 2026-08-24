import { useTranslation } from 'react-i18next';

export default function RoomInfo({ description }) {
  const { t } = useTranslation();

  return (
    <div className="h-fit rounded-xl border border-gray-200 bg-white flex flex-col p-6 shadow-sm">
      <div className="flex mb-4">
        <h1 className="font-bold text-xl text-gray-900">{t('room.about')}</h1>
      </div>
      <div className="flex flex-col gap-3 text-sm text-gray-600 leading-relaxed">
        <p>{description || t('room.defaultDescription')}</p>
      </div>
    </div>
  );
}
