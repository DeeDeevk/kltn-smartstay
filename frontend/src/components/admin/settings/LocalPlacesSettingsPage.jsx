import { useMemo, useState } from 'react';
import { Check, MapPin, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import ConfirmModal from '../../common/ConfirmModal';
import LocalPlaceFormModal from './LocalPlaceFormModal';
import LocalPlaceExtractModal from './LocalPlaceExtractModal';
import AddressAutocompleteField from './AddressAutocompleteField';
import {
    useApproveLocalPlaceMutation,
    useDeleteLocalPlaceMutation,
    useGetLocalPlacesQuery,
    useUpdateLocalPlaceMutation,
} from '../../../services/hotelConfig';

// sourceRef là URL gốc hoặc đoạn text admin dán vào — rút gọn để hiện gọn trong 1 dòng,
// cùng cách truncateSourceRef() ở LocalEventsSettingsPage.
function truncateSourceRef(sourceRef, max = 100) {
    if (!sourceRef) return null;
    return sourceRef.length > max ? `${sourceRef.slice(0, max)}…` : sourceRef;
}

const TABS = [
    { value: 'approved', label: 'Đã duyệt' },
    { value: 'pending', label: 'Chờ duyệt' },
];

// Card cho tab "Đã duyệt" — tên, mô tả, địa chỉ đã xác nhận.
function PlaceCard({ place, onEdit, onDelete }) {
    return (
        <div className="flex flex-col gap-3 rounded-2xl border border-[#E7E9F1] bg-white p-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-[#1C1B29]">{place.name}</h3>
                    {place.source === 'AI_SUGGESTED' && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#E7E9F1] bg-[#F7F7FB] px-2 py-0.5 text-[11px] font-semibold text-[#6B7280]">
                            <Sparkles size={11} /> Do AI đề xuất
                        </span>
                    )}
                </div>
                {place.address && (
                    <p className="flex items-start gap-1 text-xs text-[#6B7280]">
                        <MapPin size={12} className="mt-0.5 shrink-0" /> {place.address}
                    </p>
                )}
                {place.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-[#6B7280]">{place.description}</p>
                )}
            </div>
            <div className="flex shrink-0 gap-1.5 self-end sm:self-start">
                <button
                    type="button"
                    onClick={onEdit}
                    aria-label="Sửa địa điểm"
                    className="rounded-lg p-2 text-[#6B7280] transition-colors hover:bg-[#F7F7FB] hover:text-[#4F46E5]"
                >
                    <Pencil size={16} />
                </button>
                <button
                    type="button"
                    onClick={onDelete}
                    aria-label="Xoá địa điểm"
                    className="rounded-lg p-2 text-[#6B7280] transition-colors hover:bg-red-50 hover:text-red-600"
                >
                    <Trash2 size={16} />
                </button>
            </div>
        </div>
    );
}

// Card cho tab "Chờ duyệt": kèm addressHint (gợi ý màu xám) + ô Vietmap Autocomplete nhỏ để
// admin xác nhận địa chỉ thật — nút "Duyệt" chỉ bật sau khi đã có address/latitude/longitude
// (chặn lại ở LocalPlaceService.approve() nếu admin cố lách qua API trực tiếp).
function PendingPlaceCard({ place, onEdit, onReject }) {
    const [updateLocalPlace, { isLoading: savingAddress }] = useUpdateLocalPlaceMutation();
    const [approveLocalPlace, { isLoading: approving }] = useApproveLocalPlaceMutation();

    const hasAddress = Boolean(place.address) && place.latitude !== null && place.longitude !== null;

    const handleSelectAddress = async ({ address, latitude, longitude }) => {
        try {
            await updateLocalPlace({ placeId: place.placeId, address, latitude, longitude }).unwrap();
            toast.success('Đã cập nhật địa chỉ');
        } catch (err) {
            toast.error(err?.data?.message || 'Không thể lưu địa chỉ, vui lòng thử lại.');
        }
    };

    const handleApprove = async () => {
        try {
            await approveLocalPlace(place.placeId).unwrap();
            toast.success('Đã duyệt địa điểm');
        } catch (err) {
            toast.error(err?.data?.message || 'Không thể duyệt địa điểm, vui lòng thử lại.');
        }
    };

    return (
        <div className="flex flex-col gap-3 rounded-2xl border border-[#FDE68A] bg-[#FFFBEB]/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-[#1C1B29]">{place.name}</h3>
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#F59E0B] px-2 py-0.5 text-[11px] font-bold text-white">
                            <Sparkles size={11} /> AI đề xuất
                        </span>
                    </div>
                    {place.description && (
                        <p className="mb-1.5 line-clamp-2 text-sm text-[#6B7280]">{place.description}</p>
                    )}
                    {!place.address && place.addressHint && (
                        <p className="text-xs text-[#9AA0B4]">Gợi ý địa chỉ: {place.addressHint}</p>
                    )}
                    {place.sourceRef && (
                        <p className="mt-1 truncate text-xs text-[#9AA0B4]">
                            Nguồn: {truncateSourceRef(place.sourceRef)}
                        </p>
                    )}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <button
                        type="button"
                        onClick={onEdit}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#E7E9F1] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#6B7280] transition-colors hover:bg-[#F7F7FB] hover:text-[#1C1B29]"
                    >
                        <Pencil size={13} /> Sửa
                    </button>
                    <button
                        type="button"
                        onClick={handleApprove}
                        disabled={!hasAddress || approving}
                        title={hasAddress ? undefined : 'Chọn địa chỉ trước khi duyệt'}
                        className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Check size={13} /> Duyệt
                    </button>
                    <button
                        type="button"
                        onClick={onReject}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#E7E9F1] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#6B7280] transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                        <Trash2 size={13} /> Từ chối
                    </button>
                </div>
            </div>

            <div className="max-w-sm">
                <AddressAutocompleteField
                    value={place.address}
                    placeholder={savingAddress ? 'Đang lưu...' : 'Tìm địa chỉ trên Vietmap...'}
                    onSelect={handleSelectAddress}
                />
            </div>
        </div>
    );
}

export default function LocalPlacesSettingsPage() {
    const { data: places, isLoading } = useGetLocalPlacesQuery();
    const [deleteLocalPlace, { isLoading: deleting }] = useDeleteLocalPlaceMutation();

    const [activeTab, setActiveTab] = useState('approved');
    const [formState, setFormState] = useState({ open: false, place: null });
    const [extractOpen, setExtractOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);

    const approvedList = useMemo(
        () => (places ?? []).filter((p) => p.status !== 'PENDING'),
        [places],
    );
    const pendingList = useMemo(
        () => (places ?? []).filter((p) => p.status === 'PENDING'),
        [places],
    );
    const visibleList = activeTab === 'pending' ? pendingList : approvedList;

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;
        try {
            await deleteLocalPlace(deleteTarget.placeId).unwrap();
            toast.success(deleteTarget.status === 'PENDING' ? 'Đã từ chối đề xuất' : 'Đã xoá địa điểm');
            setDeleteTarget(null);
        } catch (err) {
            toast.error(err?.data?.message || 'Không thể xoá địa điểm, vui lòng thử lại.');
        }
    };

    return (
        <>
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="mb-1 text-2xl font-bold text-[#1C1B29]">Địa điểm nổi bật</h1>
                    <p className="text-sm text-[#6B7280]">
                        Các địa điểm này được trợ lý AI giới thiệu riêng cho khách, tách biệt với dữ liệu
                        từ Google Places.
                    </p>
                </div>
                <div className="flex shrink-0 gap-2">
                    <button
                        type="button"
                        onClick={() => setExtractOpen(true)}
                        className="inline-flex items-center gap-2 rounded-xl border border-[#DDD6FE] bg-[#F5F3FF] px-4 py-2.5 text-sm font-semibold text-[#7C3AED] transition-colors hover:bg-[#EDE9FE]"
                    >
                        <Sparkles size={16} /> Trích xuất từ nguồn
                    </button>
                    <button
                        type="button"
                        onClick={() => setFormState({ open: true, place: null })}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#4F46E5] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#4338CA]"
                    >
                        <Plus size={16} /> Thêm địa điểm
                    </button>
                </div>
            </div>

            <div className="mb-4 flex gap-1 rounded-lg bg-[#F7F7FB] p-1 sm:w-fit">
                {TABS.map((t) => (
                    <button
                        key={t.value}
                        type="button"
                        onClick={() => setActiveTab(t.value)}
                        className={`inline-flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${
                            activeTab === t.value
                                ? 'bg-white text-[#4F46E5] shadow-sm'
                                : 'text-[#6B7280] hover:text-[#1C1B29]'
                        }`}
                    >
                        {t.label}
                        {t.value === 'pending' && pendingList.length > 0 && (
                            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
                                {pendingList.length}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="space-y-3">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="h-24 animate-pulse rounded-2xl bg-[#F7F7FB]" />
                    ))}
                </div>
            ) : visibleList.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-[#E7E9F1] bg-white px-6 py-16 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#F7F7FB]">
                        <MapPin size={22} className="text-[#9AA0B4]" />
                    </div>
                    {activeTab === 'pending' ? (
                        <p className="text-sm font-bold text-[#1C1B29]">
                            Chưa có địa điểm nào chờ duyệt. Dùng nút "Trích xuất từ nguồn" để AI hỗ trợ
                            bạn thêm địa điểm nhanh hơn.
                        </p>
                    ) : (
                        <>
                            <p className="text-sm font-bold text-[#1C1B29]">Chưa có địa điểm nào được thiết lập</p>
                            <button
                                type="button"
                                onClick={() => setFormState({ open: true, place: null })}
                                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#4F46E5] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#4338CA]"
                            >
                                <Plus size={16} /> Thêm địa điểm đầu tiên
                            </button>
                        </>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {visibleList.map((place) =>
                        place.status === 'PENDING' ? (
                            <PendingPlaceCard
                                key={place.placeId}
                                place={place}
                                onEdit={() => setFormState({ open: true, place })}
                                onReject={() => setDeleteTarget(place)}
                            />
                        ) : (
                            <PlaceCard
                                key={place.placeId}
                                place={place}
                                onEdit={() => setFormState({ open: true, place })}
                                onDelete={() => setDeleteTarget(place)}
                            />
                        ),
                    )}
                </div>
            )}

            <LocalPlaceFormModal
                open={formState.open}
                place={formState.place}
                onClose={() => setFormState({ open: false, place: null })}
            />

            <LocalPlaceExtractModal
                open={extractOpen}
                onClose={() => setExtractOpen(false)}
                onExtracted={() => setActiveTab('pending')}
            />

            <ConfirmModal
                open={Boolean(deleteTarget)}
                title={deleteTarget?.status === 'PENDING' ? 'Từ chối đề xuất' : 'Xoá địa điểm'}
                message={
                    deleteTarget?.status === 'PENDING'
                        ? `Từ chối đề xuất "${deleteTarget?.name}"? Địa điểm này sẽ bị xoá hẳn, không lưu lại.`
                        : `Xoá địa điểm "${deleteTarget?.name}"? Trợ lý AI sẽ không còn giới thiệu địa điểm này cho khách nữa.`
                }
                confirmLabel={deleteTarget?.status === 'PENDING' ? 'Từ chối' : 'Xoá'}
                danger
                loading={deleting}
                onConfirm={handleConfirmDelete}
                onClose={() => setDeleteTarget(null)}
            />
        </>
    );
}
