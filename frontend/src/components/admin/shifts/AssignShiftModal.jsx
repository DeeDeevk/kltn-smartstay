import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import Modal from '../../common/Modal';
import { useCreateShiftAssignmentMutation } from '../../../services/shiftAssignment';

function getErrorMessage(err) {
  if (err.status === 409) return err.message || 'Nhân viên đã có ca này trong ngày đã chọn';
  return err.message || 'Không thể phân ca';
}

// Modal phân 1 nhân viên vào 1 loại ca, cho 1 ngày cụ thể — mở khi Admin bấm vào
// 1 ô trống trên lưới lịch tuần (ShiftSchedulePage).
export default function AssignShiftModal({ open, staff, workDate, shiftTypes, onClose }) {
  const [createShiftAssignment, { isLoading }] = useCreateShiftAssignmentMutation();
  const [shiftTypeId, setShiftTypeId] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open) {
      setShiftTypeId(shiftTypes[0]?.shiftTypeId ?? '');
      setNote('');
    }
  }, [open, staff, workDate, shiftTypes]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!shiftTypeId) {
      toast.error('Vui lòng chọn loại ca');
      return;
    }

    try {
      await createShiftAssignment({
        staffId: staff.userId,
        shiftTypeId,
        workDate,
        note: note.trim() || undefined,
      }).unwrap();
      toast.success(
        `Đã phân ${staff.fullName} vào ca ngày ${new Date(workDate).toLocaleDateString('vi-VN')}`,
      );
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  if (!staff) return null;

  return (
    <Modal open={open} onClose={onClose} title="Phân ca làm việc">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg bg-blue-50 px-3 py-2.5 text-sm text-blue-700">
          <p>
            Nhân viên: <span className="font-bold">{staff.fullName}</span>
          </p>
          <p>
            Ngày: <span className="font-bold">{new Date(workDate).toLocaleDateString('vi-VN')}</span>
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">
            Loại ca
          </label>
          {shiftTypes.length === 0 ? (
            <p className="text-sm text-red-500">
              Chưa có loại ca nào — hãy thêm loại ca trước ở mục "Quản lý loại ca".
            </p>
          ) : (
            <select
              value={shiftTypeId}
              onChange={(e) => setShiftTypeId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {shiftTypes.map((shiftType) => (
                <option key={shiftType.shiftTypeId} value={shiftType.shiftTypeId}>
                  {shiftType.name} ({shiftType.startTime?.slice(0, 5)}-{shiftType.endTime?.slice(0, 5)})
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">
            Ghi chú
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Không bắt buộc"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-70"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={isLoading || shiftTypes.length === 0}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading && <Loader2 className="animate-spin" size={16} />}
            {isLoading ? 'Đang lưu...' : 'Phân ca'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
