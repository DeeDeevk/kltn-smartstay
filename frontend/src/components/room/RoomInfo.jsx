export default function RoomInfo({ description }) {
  const defaultDescription = "Tận hưởng kỳ nghỉ dưỡng đẳng cấp, nơi sự sang trọng hiện đại hòa quyện cùng vẻ đẹp thiên nhiên. Không gian được thiết kế tinh tế để mang lại sự thoải mái tối đa cho quý khách.";

  return (
    <div className="h-fit rounded-xl border border-gray-200 bg-white flex flex-col p-6 shadow-sm">
      <div className="flex mb-4">
        <h1 className="font-bold text-xl text-gray-900">Giới thiệu về phòng này</h1>
      </div>
      <div className="flex flex-col gap-3 text-sm text-gray-600 leading-relaxed">
        {description ? (
          <p>{description}</p>
        ) : (
          <>
            <span>{defaultDescription}</span>
            <span>Trang thiết bị hiện đại, tầm nhìn tuyệt đẹp và dịch vụ chu đáo sẽ làm hài lòng những vị khách khó tính nhất.</span>
          </>
        )}
      </div>
    </div>
  );
}
