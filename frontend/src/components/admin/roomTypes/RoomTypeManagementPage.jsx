import { useState } from 'react';
import { ImageOff, Loader2, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import ConfirmModal from '../../common/ConfirmModal';
import RoomTypeFormModal from './RoomTypeFormModal';
import RoomFormModal from '../rooms/RoomFormModal';
import formatCurrency from '../../../utils/formatCurrency';
import {
  useDeleteRoomTypeMutation,
  useGetAllRoomTypesQuery,
} from '../../../services/roomType';

export default function RoomTypeManagementPage() {
  const { t, i18n } = useTranslation();
  const { data, isFetching, error } = useGetAllRoomTypesQuery();
  const [deleteRoomType, { isLoading: isDeleting }] = useDeleteRoomTypeMutation();

  const [formState, setFormState] = useState({ open: false, roomType: null });
  const [isRoomFormOpen, setIsRoomFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const roomTypes = data?.data ?? [];

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteRoomType(deleteTarget.roomTypeId).unwrap();
      toast.success(t('admin.roomTypes.deactivateSuccess', { name: deleteTarget.name }));
      setDeleteTarget(null);
    } catch (err) {
      // 409 = đang inactive rồi, hoặc còn booking hiệu lực — BE trả message cụ thể cho từng
      // trường hợp, hiển thị đúng message đó thay vì lỗi chung chung.
      toast.error(err?.data?.message || t('admin.roomTypes.deactivateError'));
    }
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">{t('admin.roomTypes.title')}</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIsRoomFormOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-200"
          >
            <Plus size={16} /> {t('admin.roomTypes.addRoomButton')}
          </button>
          <button
            type="button"
            onClick={() => setFormState({ open: true, roomType: null })}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700"
          >
            <Plus size={16} /> {t('admin.roomTypes.addButton')}
          </button>
        </div>
      </div>

      {isFetching && (
        <div className="flex justify-center py-16 text-gray-400">
          <Loader2 className="animate-spin" size={28} />
        </div>
      )}

      {!isFetching && error && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-6 text-center text-sm text-red-600">
          {error?.data?.message || t('admin.roomTypes.loadError')}
        </div>
      )}

      {!isFetching && !error && roomTypes.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-400">
          {t('admin.roomTypes.empty')}
        </div>
      )}

      {!isFetching && !error && roomTypes.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {roomTypes.map((room) => (
            <div
              key={room.roomTypeId}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
            >
              <div className="flex h-40 items-center justify-center bg-gray-100">
                {room.images?.[0]?.url ? (
                  <img src={room.images[0].url} alt={room.name} className="h-full w-full object-cover" />
                ) : (
                  <ImageOff className="text-gray-300" size={28} />
                )}
              </div>
              <div className="p-4">
                <h3 className="font-bold text-gray-900">{room.name}</h3>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
                  <Users size={14} /> {t('admin.roomTypes.maxGuests', { count: room.capacity })}
                </p>
                <p className="mt-2 text-lg font-bold text-blue-600">{formatCurrency(room.basePrice, i18n.language)}</p>
                <p className="mt-1 text-xs text-gray-400">
                  {t('admin.roomTypes.photosAndAmenities', {
                    photos: room.images?.length ?? 0,
                    amenities: room.amenities?.length ?? 0,
                  })}
                </p>

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormState({ open: true, roomType: room })}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
                  >
                    <Pencil size={14} /> {t('admin.roomTypes.edit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(room)}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <RoomTypeFormModal
        open={formState.open}
        roomType={formState.roomType}
        onClose={() => setFormState({ open: false, roomType: null })}
      />

      <RoomFormModal
        open={isRoomFormOpen}
        roomTypes={roomTypes}
        onClose={() => setIsRoomFormOpen(false)}
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title={t('admin.roomTypes.deactivateTitle')}
        message={t('admin.roomTypes.deactivateMessage', { name: deleteTarget?.name })}
        confirmLabel={t('admin.roomTypes.deactivateConfirm')}
        danger
        loading={isDeleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}
