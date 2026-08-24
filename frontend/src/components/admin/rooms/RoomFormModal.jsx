import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import Modal from '../../common/Modal';
import { useCreateRoomMutation } from '../../../services/adminRoom';

const emptyForm = { roomTypeId: '', roomNumber: '', floor: '' };

export default function RoomFormModal({ open, onClose, roomTypes = [] }) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [createRoom, { isLoading }] = useCreateRoomMutation();

  useEffect(() => {
    if (open) {
      setFormData(emptyForm);
      setErrors({});
    }
  }, [open]);

  if (!open) return null;

  const handleChange = (field) => (e) =>
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  const validate = () => {
    const nextErrors = {};
    if (!formData.roomTypeId) nextErrors.roomTypeId = t('admin.rooms.roomTypeRequired');
    if (!formData.roomNumber.trim()) nextErrors.roomNumber = t('admin.rooms.roomNumberRequired');
    if (formData.floor === '' || Number(formData.floor) < 0) nextErrors.floor = t('admin.rooms.floorInvalid');
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const roomNumber = formData.roomNumber.trim();
    try {
      await createRoom({
        roomTypeId: formData.roomTypeId,
        roomNumber,
        floor: Number(formData.floor),
      }).unwrap();
      toast.success(t('admin.rooms.createSuccess', { roomNumber }));
      onClose();
    } catch (err) {
      // 409 = trùng số phòng — hiển thị lý do cụ thể thay vì lỗi generic.
      if (err?.status === 409) {
        toast.error(t('admin.rooms.createConflict', { roomNumber }));
      } else {
        toast.error(err?.data?.message || t('admin.rooms.createError'));
      }
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('admin.rooms.formTitle')}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-70"
          >
            {t('admin.rooms.cancel')}
          </button>
          <button
            type="submit"
            form="room-form"
            disabled={isLoading}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading ? t('admin.rooms.submitting') : t('admin.rooms.submit')}
          </button>
        </>
      }
    >
      <form id="room-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">
            {t('admin.rooms.roomType')}
          </label>
          <select
            value={formData.roomTypeId}
            onChange={handleChange('roomTypeId')}
            className={`w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.roomTypeId ? 'border-red-300' : 'border-gray-200'
            }`}
          >
            <option value="">{t('admin.rooms.roomTypePlaceholder')}</option>
            {roomTypes.map((rt) => (
              <option key={rt.roomTypeId} value={rt.roomTypeId}>
                {rt.name}
              </option>
            ))}
          </select>
          {errors.roomTypeId && <p className="mt-1 text-xs text-red-500">{errors.roomTypeId}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">
            {t('admin.rooms.roomNumber')}
          </label>
          <input
            type="text"
            value={formData.roomNumber}
            onChange={handleChange('roomNumber')}
            placeholder={t('admin.rooms.roomNumberPlaceholder')}
            className={`w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.roomNumber ? 'border-red-300' : 'border-gray-200'
            }`}
          />
          {errors.roomNumber && <p className="mt-1 text-xs text-red-500">{errors.roomNumber}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">
            {t('admin.rooms.floor')}
          </label>
          <input
            type="number"
            min="0"
            value={formData.floor}
            onChange={handleChange('floor')}
            className={`w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.floor ? 'border-red-300' : 'border-gray-200'
            }`}
          />
          {errors.floor && <p className="mt-1 text-xs text-red-500">{errors.floor}</p>}
        </div>
      </form>
    </Modal>
  );
}
