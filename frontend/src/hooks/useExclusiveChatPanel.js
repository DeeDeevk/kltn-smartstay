import { useCallback, useEffect, useState } from 'react';

const OPEN_EVENT = 'chat-widget:open';

// Trạng thái đóng/mở cho các khung chat nổi (trợ lý AI, lễ tân): tại 1 thời điểm chỉ
// mở 1 khung — mở khung này thì khung kia tự đóng, tránh 2 bảng chat đè lên nhau.
export default function useExclusiveChatPanel(widgetId) {
    const [isOpen, setIsOpenState] = useState(false);

    useEffect(() => {
        const handleOtherOpened = (e) => {
            if (e.detail !== widgetId) setIsOpenState(false);
        };
        window.addEventListener(OPEN_EVENT, handleOtherOpened);
        return () => window.removeEventListener(OPEN_EVENT, handleOtherOpened);
    }, [widgetId]);

    // Nhận giá trị hoặc hàm cập nhật giống setState thường.
    const setIsOpen = useCallback(
        (next) => {
            setIsOpenState((prev) => {
                const value = typeof next === 'function' ? next(prev) : next;
                if (value && !prev) {
                    // Bắn sự kiện sau khi render xong, không dispatch trong updater.
                    queueMicrotask(() =>
                        window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: widgetId })),
                    );
                }
                return value;
            });
        },
        [widgetId],
    );

    return [isOpen, setIsOpen];
}
