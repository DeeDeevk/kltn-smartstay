import { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { Loader2, Sparkles, Wine } from 'lucide-react';
import Modal from '../../common/Modal';
import ServiceSection from './ServiceSection';
import formatCurrency from '../../../utils/formatCurrency';
import {
  useAddBookingServicesMutation,
  useGetServicesQuery,
} from '../../../services/booking';

// Lễ tân ghi dịch vụ / minibar khách dùng trong lúc ở — cộng thẳng vào hoá đơn, đến lúc
// trả phòng đã có sẵn trong mục "Dịch vụ đã ghi nhận".
export default function AddServiceModal({ booking, open, onClose }) {
  const { data: services = [] } = useGetServicesQuery();
  const [addServices, { isLoading }] = useAddBookingServicesMutation();
  const [selected, setSelected] = useState({}); // serviceId -> quantity

  const servicesById = useMemo(
    () => Object.fromEntries(services.map((s) => [s.serviceId, s])),
    [services],
  );
  const minibar = useMemo(
    () => services.filter((s) => s.category === 'MINIBAR'),
    [services],
  );
  const others = useMemo(
    () => services.filter((s) => s.category !== 'MINIBAR'),
    [services],
  );
  const newServicesSum = useMemo(
    () =>
      Object.entries(selected).reduce(
        (sum, [id, qty]) => sum + qty * (servicesById[id]?.price ?? 0),
        0,
      ),
    [selected, servicesById],
  );

  if (!booking) return null;

  const setQty = (id, qty) =>
    setSelected((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });

  const handleClose = () => {
    setSelected({});
    onClose();
  };

  const handleSave = async () => {
    try {
      await addServices({
        bookingId: booking.bookingId,
        items: Object.entries(selected).map(([serviceId, quantity]) => ({
          serviceId,
          quantity,
        })),
      }).unwrap();
      toast.success('Đã ghi nhận dịch vụ cho khách');
      handleClose();
    } catch (err) {
      toast.error(err?.data?.message || 'Không thể thêm dịch vụ');
    }
  };

  const nothingSelected = Object.keys(selected).length === 0;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Thêm dịch vụ"
      size="lg"
      footer={
        <>
          <span className="mr-auto self-center text-sm text-gray-500">
            Tạm tính:{' '}
            <span className="font-bold text-gray-900">
              {formatCurrency(newServicesSum)}
            </span>
          </span>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isLoading || nothingSelected}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            {isLoading && <Loader2 size={15} className="animate-spin" />}
            Lưu
          </button>
        </>
      }
    >
      <p className="mb-4 text-sm text-gray-500">
        Phòng {booking.room?.roomNumber ?? '—'} ·{' '}
        {booking.guestInfo?.fullName || '—'}
      </p>
      <div className="space-y-4">
        {minibar.length > 0 && (
          <ServiceSection
            icon={Wine}
            title="Minibar"
            hint="Ghi nhận tiêu thụ tại phòng"
            services={minibar}
            selected={selected}
            onSetQty={setQty}
          />
        )}
        {others.length > 0 && (
          <ServiceSection
            icon={Sparkles}
            title="Dịch vụ khác"
            services={others}
            selected={selected}
            onSetQty={setQty}
          />
        )}
      </div>
    </Modal>
  );
}
