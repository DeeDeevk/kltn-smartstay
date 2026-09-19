import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import Modal from '../../common/Modal';
import { useCreateFaqMutation, useUpdateFaqMutation } from '../../../services/faq';

// Giới hạn khớp với CreateFaqDto ở backend.
const QUESTION_MAX = 500;
const ANSWER_MAX = 4000;
const CATEGORY_MAX = 100;

const EMPTY_FORM = { question: '', answer: '', category: '', isActive: true };

// class-validator trả message dạng mảng khi nhiều trường cùng lỗi.
export function getErrorMessage(err, fallback) {
  const message = err?.data?.message ?? err?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message || fallback;
}

// Thêm mới (faq = null) hoặc sửa 1 FAQ. categories: danh sách nhóm đã có, gợi ý qua
// <datalist> để admin chọn lại đúng tên nhóm cũ thay vì gõ lệch chính tả.
export default function FaqFormModal({ open, faq, categories, onClose }) {
  const isEdit = Boolean(faq);
  const [form, setForm] = useState(EMPTY_FORM);
  const [createFaq, { isLoading: isCreating }] = useCreateFaqMutation();
  const [updateFaq, { isLoading: isUpdating }] = useUpdateFaqMutation();
  const isSaving = isCreating || isUpdating;

  useEffect(() => {
    if (!open) return;
    setForm(
      faq
        ? {
            question: faq.question,
            answer: faq.answer,
            category: faq.category ?? '',
            isActive: faq.isActive,
          }
        : EMPTY_FORM,
    );
  }, [open, faq]);

  const setField = (field) => (e) =>
    setForm((prev) => ({
      ...prev,
      [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
    }));

  const handleSubmit = async () => {
    const payload = {
      question: form.question.trim(),
      answer: form.answer.trim(),
      category: form.category.trim(),
      isActive: form.isActive,
    };
    if (!payload.question || !payload.answer) {
      toast.error('Vui lòng nhập đầy đủ câu hỏi và câu trả lời');
      return;
    }
    try {
      if (isEdit) {
        await updateFaq({ faqId: faq.faqId, data: payload }).unwrap();
        toast.success('Đã cập nhật FAQ');
      } else {
        await createFaq(payload).unwrap();
        toast.success('Đã thêm FAQ');
      }
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Không thể lưu FAQ'));
    }
  };

  const inputClass =
    'w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Sửa FAQ' : 'Thêm FAQ'}
      size="lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-70"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-70"
          >
            {isSaving && <Loader2 size={16} className="animate-spin" />}
            {isEdit ? 'Lưu thay đổi' : 'Thêm FAQ'}
          </button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <div>
          <label className="mb-1.5 block font-semibold text-gray-700">Câu hỏi</label>
          <input
            type="text"
            value={form.question}
            onChange={setField('question')}
            maxLength={QUESTION_MAX}
            placeholder="VD: Mấy giờ được nhận phòng?"
            className={inputClass}
            autoFocus
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="block font-semibold text-gray-700">Câu trả lời</label>
            <span className="text-xs text-gray-400">
              {form.answer.length}/{ANSWER_MAX}
            </span>
          </div>
          <textarea
            value={form.answer}
            onChange={setField('answer')}
            maxLength={ANSWER_MAX}
            rows={7}
            placeholder="Nội dung trợ lý AI sẽ dựa vào để trả lời khách"
            className={`${inputClass} resize-y`}
          />
        </div>

        <div>
          <label className="mb-1.5 block font-semibold text-gray-700">Nhóm chủ đề</label>
          <input
            type="text"
            list="faq-category-options"
            value={form.category}
            onChange={setField('category')}
            maxLength={CATEGORY_MAX}
            placeholder="VD: Nhận/trả phòng, Thanh toán, Huỷ phòng"
            className={inputClass}
          />
          <datalist id="faq-category-options">
            {categories.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={setField('isActive')}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span>
            <span className="font-semibold text-gray-700">Hiển thị cho trợ lý AI</span>
            <span className="block text-xs text-gray-400">
              Bỏ chọn để ẩn FAQ khỏi kết quả tìm kiếm của AI mà vẫn giữ lại dữ liệu.
            </span>
          </span>
        </label>
      </div>
    </Modal>
  );
}
