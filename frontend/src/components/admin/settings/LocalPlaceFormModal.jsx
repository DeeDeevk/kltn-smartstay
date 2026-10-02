import { useEffect, useState } from 'react';
import { Loader2, Save, X } from 'lucide-react';
import { toast } from 'react-toastify';
import AddressAutocompleteField from './AddressAutocompleteField';
import {
    useCreateLocalPlaceMutation,
    useUpdateLocalPlaceMutation,
} from '../../../services/hotelConfig';

const emptyForm = { name: '', description: '', address: '', latitude: null, longitude: null };

function placeToForm(place) {
    if (!place) return emptyForm;
    return {
        name: place.name ?? '',
        description: place.description ?? '',
        address: place.address ?? '',
        latitude: place.latitude ?? null,
        longitude: place.longitude ?? null,
    };
}

// Tạo/sửa LocalPlace thủ công — cùng khung modal với LocalEventFormModal. Khác biệt chính:
// địa chỉ chọn qua AddressAutocompleteField (Vietmap) thay vì gõ tay, và tạo thủ công luôn
// bắt buộc đủ địa chỉ ngay từ đầu (status=APPROVED ngay, không qua bước duyệt riêng).
export default function LocalPlaceFormModal({ open, place, onClose }) {
    const isEdit = Boolean(place);
    const [form, setForm] = useState(emptyForm);
    const [createLocalPlace, { isLoading: creating }] = useCreateLocalPlaceMutation();
    const [updateLocalPlace, { isLoading: updating }] = useUpdateLocalPlaceMutation();
    const saving = creating || updating;

    useEffect(() => {
        if (open) setForm(placeToForm(place));
    }, [open, place]);

    if (!open) return null;

    const isValid =
        form.name.trim().length > 0 &&
        Boolean(form.address) &&
        form.latitude !== null &&
        form.longitude !== null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isValid || saving) return;
        try {
            const payload = {
                name: form.name.trim(),
                description: form.description.trim() || undefined,
                address: form.address,
                latitude: form.latitude,
                longitude: form.longitude,
            };
            if (isEdit) {
                await updateLocalPlace({ placeId: place.placeId, ...payload }).unwrap();
                toast.success('Đã cập nhật địa điểm');
            } else {
                await createLocalPlace(payload).unwrap();
                toast.success('Đã thêm địa điểm');
            }
            onClose();
        } catch (err) {
            toast.error(err?.data?.message || 'Không thể lưu địa điểm, vui lòng thử lại.');
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
            <div className="flex h-full w-full flex-col overflow-hidden bg-white sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-md sm:rounded-[20px] sm:shadow-2xl">
                <div className="flex shrink-0 items-center justify-between border-b border-[#E7E9F1] px-5 py-4">
                    <h2 className="text-base font-bold text-[#1C1B29]">
                        {isEdit ? 'Sửa địa điểm' : 'Thêm địa điểm'}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full p-1.5 text-[#9AA0B4] transition-colors hover:bg-[#F7F7FB] hover:text-[#1C1B29]"
                        aria-label="Đóng"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                    <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-[#1C1B29]">Tên địa điểm</label>
                            <input
                                type="text"
                                value={form.name}
                                maxLength={200}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                placeholder="VD: Chợ đêm Bến Thành"
                                autoFocus
                                className="w-full rounded-lg border border-[#E7E9F1] px-3 py-2 text-sm text-[#1C1B29] focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-medium text-[#1C1B29]">
                                Mô tả <span className="font-normal text-[#9AA0B4]">(không bắt buộc)</span>
                            </label>
                            <textarea
                                value={form.description}
                                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                                rows={3}
                                placeholder="Mô tả ngắn để trợ lý AI giới thiệu cho khách..."
                                className="w-full resize-none rounded-lg border border-[#E7E9F1] px-3 py-2 text-sm text-[#1C1B29] focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-medium text-[#1C1B29]">Địa chỉ</label>
                            <AddressAutocompleteField
                                value={form.address}
                                onSelect={({ address, latitude, longitude }) =>
                                    setForm((f) => ({ ...f, address, latitude, longitude }))
                                }
                            />
                        </div>
                    </div>

                    <div className="flex shrink-0 gap-2 border-t border-[#E7E9F1] px-5 py-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl border border-[#E7E9F1] px-4 py-2.5 text-sm font-semibold text-[#6B7280] transition-colors hover:bg-gray-50"
                        >
                            Huỷ
                        </button>
                        <button
                            type="submit"
                            disabled={!isValid || saving}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#4F46E5] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#4338CA] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            Lưu
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
