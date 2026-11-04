import { Minus, Plus } from 'lucide-react';
import formatCurrency from '../../../utils/formatCurrency';

// Lưới chọn dịch vụ + số lượng — dùng chung cho Check-out và Thêm dịch vụ khi khách đang ở.
export default function ServiceSection({ icon: Icon, title, hint, services, selected, onSetQty }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
          <Icon size={18} className="text-blue-600" /> {title}
        </h2>
        {hint && <span className="text-xs italic text-gray-400">{hint}</span>}
      </div>
      <div className="grid gap-3 p-5 sm:grid-cols-2">
        {services.map((svc) => {
          const qty = selected[svc.serviceId] || 0;
          const active = qty > 0;
          const free = svc.price === 0;
          return (
            <div
              key={svc.serviceId}
              className={`rounded-xl border p-3 transition-colors ${
                active ? 'border-blue-400 bg-blue-50/50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-800">
                    {svc.name}
                  </p>
                  <p className="mt-0.5 text-xs">
                    {free ? (
                      <span className="font-semibold text-emerald-600">
                        Miễn phí
                      </span>
                    ) : (
                      <span className="text-gray-400">
                        {formatCurrency(svc.price)} / {svc.unit}
                      </span>
                    )}
                  </p>
                </div>
                {!active ? (
                  <button
                    type="button"
                    onClick={() => onSetQty(svc.serviceId, 1)}
                    className="shrink-0 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-600 transition-colors hover:border-blue-300 hover:text-blue-600"
                  >
                    Thêm
                  </button>
                ) : (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onSetQty(svc.serviceId, qty - 1)}
                      className="flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="w-5 text-center text-sm font-bold text-gray-800">
                      {qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => onSetQty(svc.serviceId, qty + 1)}
                      className="flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                )}
              </div>
              {active && !free && (
                <p className="mt-2 text-right text-xs font-semibold text-blue-600">
                  {formatCurrency(svc.price * qty)}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
