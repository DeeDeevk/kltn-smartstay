import { useEffect, useState } from "react";
import { Pencil, Plus, Search, SearchX } from "lucide-react";
import { toast } from "react-toastify";
import EmptyState from "../../common/EmptyState";
import { Skeleton } from "../../common/Skeleton";
import ServiceFormModal from "./ServiceFormModal";
import { getErrorMessage } from "../promotions/PromotionFormModal";
import formatCurrency from "../../../utils/formatCurrency";
import {
  useGetAdminServicesQuery,
  useUpdateServiceMutation,
} from "../../../services/booking";
import Pagination from "../../common/Pagination";

const CATEGORY_LABELS = { MINIBAR: "Minibar", SERVICE: "Dịch vụ khác" };
const PAGE_SIZE = 10;

// Tắt = ngưng bán (soft delete): không hiện ở Check-out / Thêm dịch vụ nữa, nhưng các
// đơn cũ đã ghi dịch vụ này vẫn giữ nguyên.
function ActiveToggle({ service }) {
  const [updateService, { isLoading }] = useUpdateServiceMutation();
  const active = service.isActive;

  const handleToggle = async () => {
    try {
      await updateService({
        serviceId: service.serviceId,
        data: { isActive: !active },
      }).unwrap();
      toast.success(
        active ? "Đã ngưng cung cấp dịch vụ" : "Đã bật lại dịch vụ",
      );
    } catch (err) {
      toast.error(getErrorMessage(err, "Không thể đổi trạng thái"));
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={active ? "Ngưng cung cấp" : "Bật lại"}
      onClick={handleToggle}
      disabled={isLoading}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-40 ${
        active ? "bg-green-500" : "bg-gray-300"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
          active ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export default function ServiceManagementPage() {
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [formState, setFormState] = useState({ open: false, service: null });

  // Lọc + phân trang ở backend (GET /services/admin trả { data, total }).
  const { data, isFetching } = useGetAdminServicesQuery({
    page,
    limit: PAGE_SIZE,
    search: keyword.trim() || undefined,
    category: category === "all" ? undefined : category,
  });
  const services = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Trang đang xem bị trống (VD vừa lọc bớt) -> lùi về trang cuối còn dữ liệu.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  const hasFilter = Boolean(keyword.trim()) || category !== "all";

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dịch vụ</h1>
          <p className="mt-1 text-sm text-gray-500">
            Minibar và dịch vụ tính thêm khi khách lưu trú · {total} dịch vụ
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormState({ open: true, service: null })}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700"
        >
          <Plus size={16} /> Thêm dịch vụ
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              setPage(1);
            }}
            placeholder="Tìm theo tên dịch vụ..."
            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Tất cả nhóm</option>
          <option value="MINIBAR">Minibar</option>
          <option value="SERVICE">Dịch vụ khác</option>
        </select>
      </div>

      {isFetching && services.length === 0 ? (
        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      ) : services.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={
            hasFilter
              ? "Không có dịch vụ nào khớp bộ lọc"
              : "Chưa có dịch vụ nào"
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-xs font-bold uppercase text-gray-400">
              <tr>
                <th className="px-4 py-3">Tên dịch vụ</th>
                <th className="px-4 py-3">Nhóm</th>
                <th className="px-4 py-3 text-right">Giá</th>
                <th className="px-4 py-3 text-center">Đang cung cấp</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {services.map((s) => (
                <tr
                  key={s.serviceId}
                  className={s.isActive ? "" : "bg-gray-50/70 text-gray-400"}
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-800">{s.name}</p>
                    {s.description && (
                      <p className="mt-0.5 text-xs text-gray-400">
                        {s.description}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {CATEGORY_LABELS[s.category] ?? s.category}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {s.price === 0
                      ? "Miễn phí"
                      : `${formatCurrency(s.price)} / ${s.unit}`}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <ActiveToggle service={s} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setFormState({ open: true, service: s })}
                      aria-label={`Sửa ${s.name}`}
                      className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-blue-600"
                    >
                      <Pencil size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            page={page}
            totalPages={totalPages}
            onChange={setPage}
            summary={`Trang ${page}/${totalPages} · ${total} dịch vụ`}
          />
        </div>
      )}

      <ServiceFormModal
        open={formState.open}
        service={formState.service}
        onClose={() => setFormState({ open: false, service: null })}
      />
    </>
  );
}
