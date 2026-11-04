import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import Modal from "../../common/Modal";
import { getErrorMessage } from "../promotions/PromotionFormModal";
import {
  useCreateServiceMutation,
  useUpdateServiceMutation,
} from "../../../services/booking";

const EMPTY_FORM = {
  name: "",
  category: "SERVICE",
  price: "",
  unit: "",
  description: "",
};

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition-colors hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";
const labelClass = "mb-1.5 block text-xs font-semibold text-gray-600";

// service = null -> thêm mới, có giá trị -> sửa.
export default function ServiceFormModal({ open, service, onClose }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [createService, { isLoading: creating }] = useCreateServiceMutation();
  const [updateService, { isLoading: updating }] = useUpdateServiceMutation();
  const saving = creating || updating;
  const isEdit = Boolean(service);

  useEffect(() => {
    if (!open) return;
    setForm(
      service
        ? {
            name: service.name,
            category: service.category,
            price: String(service.price),
            unit: service.unit,
            description: service.description ?? "",
          }
        : EMPTY_FORM,
    );
  }, [open, service]);

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const price = Number(form.price);
    if (!form.name.trim() || !form.unit.trim()) {
      toast.error("Vui lòng nhập tên và đơn vị tính");
      return;
    }
    if (!Number.isInteger(price) || price < 0) {
      toast.error("Giá phải là số nguyên không âm");
      return;
    }
    const data = {
      name: form.name.trim(),
      category: form.category,
      price,
      unit: form.unit.trim(),
      description: form.description.trim() || undefined,
    };
    try {
      if (isEdit) {
        await updateService({ serviceId: service.serviceId, data }).unwrap();
        toast.success("Đã cập nhật dịch vụ");
      } else {
        await createService(data).unwrap();
        toast.success("Đã thêm dịch vụ");
      }
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, "Không thể lưu dịch vụ"));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Sửa dịch vụ" : "Thêm dịch vụ"}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            Huỷ
          </button>
          <button
            type="submit"
            form="service-form"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            Lưu
          </button>
        </>
      }
    >
      <form id="service-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass} htmlFor="svc-name">
            Tên dịch vụ
          </label>
          <input
            id="svc-name"
            value={form.name}
            onChange={(e) => update({ name: e.target.value })}
            maxLength={100}
            placeholder="VD: Giặt ủi"
            className={inputClass}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass} htmlFor="svc-category">
              Nhóm
            </label>
            <select
              id="svc-category"
              value={form.category}
              onChange={(e) => update({ category: e.target.value })}
              className={inputClass}
            >
              <option value="SERVICE">Dịch vụ khác</option>
              <option value="MINIBAR">Minibar</option>
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="svc-unit">
              Đơn vị tính
            </label>
            <input
              id="svc-unit"
              value={form.unit}
              onChange={(e) => update({ unit: e.target.value })}
              maxLength={30}
              placeholder="VD: lần, chai, kg"
              className={inputClass}
            />
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor="svc-price">
            Giá (VNĐ, 0 = miễn phí)
          </label>
          <input
            id="svc-price"
            type="number"
            min={0}
            step={1000}
            value={form.price}
            onChange={(e) => update({ price: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="svc-desc">
            Mô tả (tuỳ chọn)
          </label>
          <textarea
            id="svc-desc"
            rows={3}
            value={form.description}
            onChange={(e) => update({ description: e.target.value })}
            className={inputClass}
          />
        </div>
      </form>
    </Modal>
  );
}
