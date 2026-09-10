import { useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import Modal from '../../common/Modal';
import {
  useGetShiftTypesQuery,
  useCreateShiftTypeMutation,
  useDeleteShiftTypeMutation,
} from '../../../services/shiftType';

const EMPTY_FORM = { name: '', startTime: '', endTime: '' };

// Quản lý danh mục "loại ca" (Ca sáng/chiều/đêm...) — Admin thiết lập 1 lần rồi
// dùng lại khi phân ca cho từng nhân viên ở ShiftSchedulePage.
export default function ShiftTypeManagerModal({ open, onClose }) {
  const { data: shiftTypes = [], isFetching } = useGetShiftTypesQuery();
  const [createShiftType, { isLoading: isCreating }] = useCreateShiftTypeMutation();
  const [deleteShiftType] = useDeleteShiftTypeMutation();
  const [form, setForm] = useState(EMPTY_FORM);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.startTime || !form.endTime) {
      toast.error('Vui lòng nhập đầy đủ tên ca, giờ bắt đầu và giờ kết thúc');
      return;
    }
    try {
      await createShiftType({
        name: form.name.trim(),
        startTime: form.startTime,
        endTime: form.endTime,
      }).unwrap();
      toast.success('Đã thêm loại ca');
      setForm(EMPTY_FORM);
    } catch (err) {
      toast.error(err.message || 'Không thể thêm loại ca');
    }
  };

  const handleDelete = async (shiftType) => {
    try {
      await deleteShiftType(shiftType.shiftTypeId).unwrap();
      toast.success(`Đã xoá "${shiftType.name}"`);
    } catch (err) {
      toast.error(err.message || 'Không thể xoá loại ca');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Quản lý loại ca">
      <div className="space-y-4">
        {isFetching && (
          <div className="flex justify-center py-6 text-gray-400">
            <Loader2 className="animate-spin" size={22} />
          </div>
        )}

        {!isFetching && shiftTypes.length === 0 && (
          <p className="py-2 text-sm text-gray-400">Chưa có loại ca nào, thêm ở form bên dưới.</p>
        )}

        {!isFetching && shiftTypes.length > 0 && (
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {shiftTypes.map((shiftType) => (
              <li
                key={shiftType.shiftTypeId}
                className="flex items-center justify-between gap-3 px-3 py-2.5"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900">{shiftType.name}</p>
                  <p className="text-xs text-gray-500">
                    {shiftType.startTime?.slice(0, 5)} - {shiftType.endTime?.slice(0, 5)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(shiftType)}
                  className="rounded-lg p-1.5 text-red-500 transition-colors hover:bg-red-50"
                  aria-label={`Xoá ${shiftType.name}`}
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleCreate} className="space-y-3 rounded-lg bg-gray-50 p-3">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">
              Tên ca
            </label>
            <input
              type="text"
              value={form.name}
              onChange={handleChange('name')}
              placeholder="Ca sáng"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">
                Giờ bắt đầu
              </label>
              <input
                type="time"
                value={form.startTime}
                onChange={handleChange('startTime')}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">
                Giờ kết thúc
              </label>
              <input
                type="time"
                value={form.endTime}
                onChange={handleChange('endTime')}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isCreating}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isCreating ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
            {isCreating ? 'Đang thêm...' : 'Thêm loại ca'}
          </button>
        </form>
      </div>
    </Modal>
  );
}
