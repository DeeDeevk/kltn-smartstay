import { useEffect, useRef, useState } from 'react';
import { Loader2, Plus, Upload, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import Modal from '../../common/Modal';
import {
  useCreateRoomTypeMutation,
  useUpdateRoomTypeMutation,
  useUploadRoomTypeImageMutation,
} from '../../../services/roomType';

const emptyForm = { name: '', description: '', basePrice: '', capacity: '' };

export default function RoomTypeFormModal({ open, onClose, roomType }) {
  const { t } = useTranslation();
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

  const amenitySuggestions = t('admin.roomTypes.amenitySuggestions', { returnObjects: true });

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

  const handleAddAmenity = (value = amenityInput) => {
    const trimmed = value.trim();
    if (!trimmed || amenities.includes(trimmed)) return;
    setAmenities((prev) => [...prev, trimmed]);
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
          toast.error(err?.data?.message || t('admin.roomTypes.form.uploadError'));
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
    if (!formData.name.trim()) nextErrors.name = t('admin.roomTypes.form.nameRequired');
    if (!formData.basePrice || Number(formData.basePrice) < 0) nextErrors.basePrice = t('admin.roomTypes.form.basePriceInvalid');
    if (!formData.capacity || Number(formData.capacity) < 1) nextErrors.capacity = t('admin.roomTypes.form.capacityInvalid');
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    if (isUploading) {
      toast.error(t('admin.roomTypes.form.uploadWait'));
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
        toast.success(t('admin.roomTypes.form.save'));
      } else {
        await createRoomType(payload).unwrap();
        toast.success(t('admin.roomTypes.form.create'));
      }
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || t('admin.roomTypes.form.saveError'));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? t('admin.roomTypes.form.editTitle') : t('admin.roomTypes.form.createTitle')}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-70"
          >
            {t('admin.roomTypes.form.cancel')}
          </button>
          <button
            type="submit"
            form="room-type-form"
            disabled={isSaving || isUploading}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSaving ? t('admin.roomTypes.form.saving') : isEdit ? t('admin.roomTypes.form.save') : t('admin.roomTypes.form.create')}
          </button>
        </>
      }
    >
      <form id="room-type-form" onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">
              {t('admin.roomTypes.form.name')}
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={handleChange('name')}
              placeholder={t('admin.roomTypes.form.namePlaceholder')}
              className={`w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.name ? 'border-red-300' : 'border-gray-200'
              }`}
            />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">
              {t('admin.roomTypes.form.basePrice')}
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
              {t('admin.roomTypes.form.capacity')}
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
              {t('admin.roomTypes.form.description')}
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
            {t('admin.roomTypes.form.amenities')}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={amenityInput}
              onChange={(e) => setAmenityInput(e.target.value)}
              onKeyDown={handleAmenityKeyDown}
              placeholder={t('admin.roomTypes.form.amenityPlaceholder')}
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => handleAddAmenity()}
              className="flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
            >
              <Plus size={16} /> {t('admin.roomTypes.form.addAmenity')}
            </button>
          </div>

          {amenitySuggestions.some((name) => !amenities.includes(name)) && (
            <div className="mt-2.5">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                {t('admin.roomTypes.form.suggestedAmenities')}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {amenitySuggestions
                  .filter((name) => !amenities.includes(name))
                  .map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => handleAddAmenity(name)}
                      className="flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-500 transition-colors hover:border-blue-300 hover:text-blue-600"
                    >
                      <Plus size={11} /> {name}
                    </button>
                  ))}
              </div>
            </div>
          )}

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
                    aria-label={`${t('admin.roomTypes.form.removeImage')} ${name}`}
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
            {t('admin.roomTypes.form.images')}
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
                    aria-label={t('admin.roomTypes.form.removeImage')}
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
              <span className="text-xs font-semibold">{t('admin.roomTypes.form.uploadImage')}</span>
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
      </form>
    </Modal>
  );
}
