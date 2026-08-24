import { useEffect, useRef, useState } from 'react';
import { Loader2, Plus, Upload, X } from 'lucide-react';
import { toast } from 'react-toastify';
import {
  useCreateRoomTypeMutation,
  useUpdateRoomTypeMutation,
  useUploadRoomTypeImageMutation,
} from '../../../services/roomType';

const emptyForm = { name: '', description: '', basePrice: '', capacity: '' };

// Modal tạo/sửa loại phòng — rộng hơn Modal dùng chung vì cần chỗ cho lưới ảnh + tiện ích.
export default function RoomTypeFormModal({ open, onClose, roomType }) {
  const isEdit = Boolean(roomType);
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [amenities, setAmenities] = useState([]);
  const [amenityInput, setAmenityInput] = useState('');
  const [images, setImages] = useState([]); // [{ url, uploading }]

  const [createRoomType, { isLoading: isCreating }] = useCreateRoomTypeMutation();
  const [updateRoomType, { isLoading: isUpdating }] = useUpdateRoomTypeMutation();
  const [uploadImage] = useUploadRoomTypeImageMutation();

  useEffect(() => {
    if (!open) return;
    if (roomType) {
      setFormData({
        name: roomType.name || '',
        description: roomType.description || '',
        basePrice: String(roomType.basePrice ?? ''),
        capacity: String(roomType.capacity ?? ''),
      });
      setAmenities(roomType.amenities || []);
      setImages(
        (roomType.images || []).map((img) => ({
          url: typeof img === 'string' ? img : img.url,
          uploading: false,
        })),
      );
    } else {
      setFormData(emptyForm);
      setAmenities([]);
      setImages([]);
    }
    setErrors({});
    setAmenityInput('');
  }, [open, roomType]);

  if (!open) return null;

  const isSaving = isCreating || isUpdating;
  const isUploading = images.some((img) => img.uploading);

  const handleChange = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleAddAmenity = () => {
    const value = amenityInput.trim();
    if (!value || amenities.includes(value)) return;
    setAmenities((prev) => [...prev, value]);
    setAmenityInput('');
  };

  const handleAmenityKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddAmenity();
    }
  };

  const handleRemoveAmenity = (name) => {
    setAmenities((prev) => prev.filter((item) => item !== name));
  };

  const handleFilesSelected = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    const placeholders = files.map((file) => ({ url: URL.createObjectURL(file), uploading: true }));
    setImages((prev) => [...prev, ...placeholders]);

    await Promise.all(
      files.map(async (file, index) => {
        const placeholder = placeholders[index];
        try {
          const result = await uploadImage(file).unwrap();
          setImages((prev) =>
            prev.map((img) => (img === placeholder ? { url: result.url, uploading: false } : img)),
          );
        } catch (err) {
          toast.error(err?.data?.message || 'Tải ảnh lên thất bại');
          setImages((prev) => prev.filter((img) => img !== placeholder));
        }
      }),
    );
  };

  const handleRemoveImage = (url) => {
    setImages((prev) => prev.filter((img) => img.url !== url));
  };

  const validate = () => {
    const nextErrors = {};
    if (!formData.name.trim()) nextErrors.name = 'Vui lòng nhập tên loại phòng';
    if (!formData.basePrice || Number(formData.basePrice) < 0) nextErrors.basePrice = 'Giá không hợp lệ';
    if (!formData.capacity || Number(formData.capacity) < 1) nextErrors.capacity = 'Sức chứa phải từ 1 khách';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    if (isUploading) {
      toast.error('Vui lòng đợi ảnh tải lên xong');
      return;
    }

    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      basePrice: Number(formData.basePrice),
      capacity: Number(formData.capacity),
      amenities,
      images: images.map((img) => img.url),
    };

    try {
      if (isEdit) {
        await updateRoomType({ roomTypeId: roomType.roomTypeId, ...payload }).unwrap();
        toast.success('Đã cập nhật loại phòng');
      } else {
        await createRoomType(payload).unwrap();
        toast.success('Đã thêm loại phòng mới');
      }
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || 'Không thể lưu loại phòng');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-full overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">
            {isEdit ? 'Sửa loại phòng' : 'Thêm loại phòng mới'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 transition-colors hover:text-gray-600"
            aria-label="Đóng"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">
                Tên loại phòng
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={handleChange('name')}
                placeholder="VD: Deluxe Ocean View"
                className={`w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.name ? 'border-red-300' : 'border-gray-200'
                }`}
              />
              {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">
                Giá cơ bản (VNĐ/đêm)
              </label>
              <input
                type="number"
                min="0"
                value={formData.basePrice}
                onChange={handleChange('basePrice')}
                className={`w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.basePrice ? 'border-red-300' : 'border-gray-200'
                }`}
              />
              {errors.basePrice && <p className="mt-1 text-xs text-red-500">{errors.basePrice}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">
                Sức chứa (khách)
              </label>
              <input
                type="number"
                min="1"
                value={formData.capacity}
                onChange={handleChange('capacity')}
                className={`w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.capacity ? 'border-red-300' : 'border-gray-200'
                }`}
              />
              {errors.capacity && <p className="mt-1 text-xs text-red-500">{errors.capacity}</p>}
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">
                Mô tả
              </label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={handleChange('description')}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">
              Tiện nghi
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={amenityInput}
                onChange={(e) => setAmenityInput(e.target.value)}
                onKeyDown={handleAmenityKeyDown}
                placeholder="VD: Wifi miễn phí — nhấn Enter để thêm"
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleAddAmenity}
                className="flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
              >
                <Plus size={16} /> Thêm
              </button>
            </div>
            {amenities.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-2">
                {amenities.map((name) => (
                  <span
                    key={name}
                    className="flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700"
                  >
                    {name}
                    <button
                      type="button"
                      onClick={() => handleRemoveAmenity(name)}
                      className="text-blue-400 hover:text-blue-700"
                      aria-label={`Xóa ${name}`}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">
              Hình ảnh
            </label>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {images.map((img) => (
                <div key={img.url} className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200">
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                  {img.uploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <Loader2 className="animate-spin text-white" size={20} />
                    </div>
                  )}
                  {!img.uploading && (
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(img.url)}
                      className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label="Xóa ảnh"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 text-gray-400 transition-colors hover:border-blue-400 hover:text-blue-500"
              >
                <Upload size={18} />
                <span className="text-xs font-semibold">Tải ảnh lên</span>
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              className="hidden"
              onChange={handleFilesSelected}
            />
          </div>

          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-70"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSaving || isUploading}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSaving ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Thêm loại phòng'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
