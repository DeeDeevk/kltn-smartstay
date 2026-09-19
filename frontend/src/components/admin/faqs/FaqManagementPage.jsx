import { useMemo, useState } from 'react';
import { ChevronDown, Loader2, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import ConfirmModal from '../../common/ConfirmModal';
import FaqFormModal, { getErrorMessage } from './FaqFormModal';
import {
  useDeleteFaqMutation,
  useGetAllFaqsQuery,
  useReindexFaqsMutation,
  useUpdateFaqMutation,
} from '../../../services/faq';

const UNCATEGORIZED = 'Chưa phân nhóm';

const STATUS_FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'active', label: 'Đang hiển thị' },
  { value: 'hidden', label: 'Đang ẩn' },
];

// Bỏ dấu để tìm "nhan phong" vẫn ra "nhận phòng".
function normalize(text) {
  return (text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();
}

// Công tắc bật/tắt FAQ ngay trên danh sách, không cần mở form sửa.
function ActiveToggle({ faq }) {
  const [updateFaq, { isLoading }] = useUpdateFaqMutation();

  const handleToggle = async () => {
    try {
      await updateFaq({ faqId: faq.faqId, data: { isActive: !faq.isActive } }).unwrap();
      toast.success(faq.isActive ? 'Đã ẩn FAQ khỏi trợ lý AI' : 'Đã hiển thị FAQ cho trợ lý AI');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Không thể cập nhật trạng thái'));
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={faq.isActive}
      onClick={handleToggle}
      disabled={isLoading}
      title={faq.isActive ? 'Đang hiển thị — bấm để ẩn' : 'Đang ẩn — bấm để hiển thị'}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
        faq.isActive ? 'bg-green-500' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
          faq.isActive ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

function FaqRow({ faq, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <li className={`px-4 py-3.5 ${faq.isActive ? '' : 'bg-gray-50/70'}`}>
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="min-w-0 flex-1 text-left"
        >
          <p className={`flex items-start gap-1.5 font-semibold ${faq.isActive ? 'text-gray-900' : 'text-gray-400'}`}>
            <ChevronDown
              size={16}
              className={`mt-0.5 shrink-0 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
            <span className="wrap-anywhere">{faq.question}</span>
          </p>
          <p
            className={`mt-1 pl-5.5 text-sm whitespace-pre-line wrap-anywhere text-gray-500 ${
              expanded ? '' : 'line-clamp-2'
            }`}
          >
            {faq.answer}
          </p>
        </button>

        <div className="flex shrink-0 items-center gap-1.5">
          <ActiveToggle faq={faq} />
          <button
            type="button"
            onClick={() => onEdit(faq)}
            title="Sửa"
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(faq)}
            title="Xoá"
            className="rounded-lg p-2 text-red-500 hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </li>
  );
}

// Quản lý kho FAQ/chính sách — nguồn tri thức RAG cho trợ lý AI. Mọi thao tác lưu
// đều được backend embed lại ngay, nên AI dùng nội dung mới ở lượt chat kế tiếp.
export default function FaqManagementPage() {
  const { data: faqs = [], isFetching, error } = useGetAllFaqsQuery();
  const [deleteFaq, { isLoading: isDeleting }] = useDeleteFaqMutation();
  const [reindexFaqs, { isLoading: isReindexing }] = useReindexFaqsMutation();

  const [formState, setFormState] = useState({ open: false, faq: null });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [keyword, setKeyword] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const categories = useMemo(
    () => [...new Set(faqs.map((f) => f.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi')),
    [faqs],
  );

  const activeCount = faqs.filter((f) => f.isActive).length;

  // Lọc rồi gom theo nhóm chủ đề để danh sách dài vẫn dễ đọc.
  const groups = useMemo(() => {
    const needle = normalize(keyword.trim());
    const filtered = faqs.filter((f) => {
      if (statusFilter === 'active' && !f.isActive) return false;
      if (statusFilter === 'hidden' && f.isActive) return false;
      if (categoryFilter !== 'all' && (f.category || UNCATEGORIZED) !== categoryFilter) return false;
      if (needle && !normalize(`${f.question} ${f.answer}`).includes(needle)) return false;
      return true;
    });
    const map = new Map();
    for (const faq of filtered) {
      const key = faq.category || UNCATEGORIZED;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(faq);
    }
    return [...map.entries()];
  }, [faqs, keyword, categoryFilter, statusFilter]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteFaq(deleteTarget.faqId).unwrap();
      toast.success('Đã xoá FAQ');
      setDeleteTarget(null);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Không thể xoá FAQ'));
    }
  };

  const handleReindex = async () => {
    try {
      const result = await reindexFaqs().unwrap();
      if (result.failed > 0) {
        toast.warning(
          `Đã đồng bộ ${result.indexed} FAQ, ${result.failed} FAQ lỗi — thử lại sau ít phút`,
        );
      } else {
        toast.success(
          `Đã đồng bộ ${result.indexed} FAQ cho trợ lý AI (${result.embedded} FAQ vừa được xử lý lại)`,
        );
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Không thể đồng bộ FAQ'));
    }
  };

  const hasFilter = keyword.trim() || categoryFilter !== 'all' || statusFilter !== 'all';

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Câu hỏi thường gặp (FAQ)</h1>
          <p className="mt-1 text-sm text-gray-500">
            Kho kiến thức trợ lý AI dùng để trả lời khách · {activeCount}/{faqs.length} đang hiển thị
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleReindex}
            disabled={isReindexing}
            title="Xử lý lại các FAQ chưa được AI ghi nhận (vd. lần lưu trước bị lỗi mạng)"
            className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-70"
          >
            <RefreshCw size={16} className={isReindexing ? 'animate-spin' : ''} /> Đồng bộ AI
          </button>
          <button
            type="button"
            onClick={() => setFormState({ open: true, faq: null })}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700"
          >
            <Plus size={16} /> Thêm FAQ
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Tìm theo câu hỏi hoặc câu trả lời..."
            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Tất cả nhóm</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
          {faqs.some((f) => !f.category) && <option value={UNCATEGORIZED}>{UNCATEGORIZED}</option>}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {isFetching && faqs.length === 0 && (
        <div className="flex justify-center py-16 text-gray-400">
          <Loader2 className="animate-spin" size={28} />
        </div>
      )}

      {!isFetching && error && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-6 text-center text-sm text-red-600">
          {getErrorMessage(error, 'Không thể tải danh sách FAQ')}
        </div>
      )}

      {!error && !(isFetching && faqs.length === 0) && groups.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-400">
          {hasFilter ? 'Không có FAQ nào khớp bộ lọc.' : 'Chưa có FAQ nào. Bấm "Thêm FAQ" để bắt đầu.'}
        </div>
      )}

      <div className="space-y-5">
        {groups.map(([category, items]) => (
          <section key={category}>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500">
              {category} <span className="font-normal normal-case text-gray-400">({items.length})</span>
            </h2>
            <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              {items.map((faq) => (
                <FaqRow
                  key={faq.faqId}
                  faq={faq}
                  onEdit={(f) => setFormState({ open: true, faq: f })}
                  onDelete={setDeleteTarget}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>

      <FaqFormModal
        open={formState.open}
        faq={formState.faq}
        categories={categories}
        onClose={() => setFormState({ open: false, faq: null })}
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Xoá FAQ"
        message={`Xoá vĩnh viễn câu hỏi "${deleteTarget?.question ?? ''}"? Trợ lý AI sẽ không còn dùng nội dung này. Nếu chỉ muốn tạm ngưng, hãy tắt công tắc hiển thị thay vì xoá.`}
        confirmLabel="Xoá"
        danger
        loading={isDeleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}
