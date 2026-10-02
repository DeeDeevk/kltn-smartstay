import { useCallback, useRef, useState } from 'react';

// Hook dùng chung cho các nút chat nổi (Chatbot, AiChatbot): cho phép kéo-thả nút đi
// khắp màn hình, đồng thời bấm (không kéo) vào nút sẽ đóng/mở bảng chat. Bảng chat
// luôn được tính vị trí bám sát nút, tự lật lên/xuống và ép trong màn hình để không
// bao giờ tràn ra ngoài hay đè lên header như khi dùng offset cố định trước đây.
const BUTTON_SIZE = 64;
const EDGE_MARGIN = 16;
const PANEL_GAP = 12;
const CLICK_TOLERANCE = 5;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export default function useDraggableWidget({
    initialBottom,
    initialRight,
    panelWidth = 380,
    panelMaxHeight = 550,
}) {
    const [pos, setPos] = useState(() => ({
        x: clamp(
            window.innerWidth - BUTTON_SIZE - initialRight,
            EDGE_MARGIN,
            window.innerWidth - BUTTON_SIZE - EDGE_MARGIN,
        ),
        y: clamp(
            window.innerHeight - BUTTON_SIZE - initialBottom,
            EDGE_MARGIN,
            window.innerHeight - BUTTON_SIZE - EDGE_MARGIN,
        ),
    }));
    const dragRef = useRef(null);

    const handlePointerDown = useCallback(
        (e) => {
            dragRef.current = {
                startX: e.clientX,
                startY: e.clientY,
                originX: pos.x,
                originY: pos.y,
                moved: false,
            };
            e.currentTarget.setPointerCapture(e.pointerId);
        },
        [pos],
    );

    const handlePointerMove = useCallback((e) => {
        const drag = dragRef.current;
        if (!drag) return;
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        if (Math.abs(dx) > CLICK_TOLERANCE || Math.abs(dy) > CLICK_TOLERANCE) {
            drag.moved = true;
        }
        setPos({
            x: clamp(drag.originX + dx, EDGE_MARGIN, window.innerWidth - BUTTON_SIZE - EDGE_MARGIN),
            y: clamp(drag.originY + dy, EDGE_MARGIN, window.innerHeight - BUTTON_SIZE - EDGE_MARGIN),
        });
    }, []);

    const handlePointerUp = useCallback((e, onToggle) => {
        const drag = dragRef.current;
        dragRef.current = null;
        if (drag && !drag.moved) onToggle();
    }, []);

    const panelHeight = Math.min(panelMaxHeight, window.innerHeight * 0.7);
    const spaceAbove = pos.y - PANEL_GAP;
    const spaceBelow = window.innerHeight - (pos.y + BUTTON_SIZE) - PANEL_GAP;
    const openUpward = spaceAbove >= panelHeight || spaceAbove >= spaceBelow;
    const panelTop = openUpward
        ? clamp(pos.y - PANEL_GAP - panelHeight, EDGE_MARGIN, window.innerHeight - panelHeight - EDGE_MARGIN)
        : clamp(pos.y + BUTTON_SIZE + PANEL_GAP, EDGE_MARGIN, window.innerHeight - panelHeight - EDGE_MARGIN);
    const panelLeft = clamp(
        pos.x + BUTTON_SIZE - panelWidth,
        EDGE_MARGIN,
        window.innerWidth - panelWidth - EDGE_MARGIN,
    );

    return {
        buttonStyle: { left: pos.x, top: pos.y, touchAction: 'none' },
        panelStyle: { top: panelTop, left: panelLeft, width: panelWidth, height: panelHeight },
        dragHandlers: {
            onPointerDown: handlePointerDown,
            onPointerMove: handlePointerMove,
            onPointerUp: handlePointerUp,
        },
    };
}
