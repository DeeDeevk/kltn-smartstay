import { useCallback, useEffect, useRef, useState } from "react";

const STOP_AFTER_MS = 3000;
const HIDE_AFTER_MS = 5000;

export default function useChatTyping(socket, conversationId) {
  const [typingUserId, setTypingUserId] = useState(null);
  const isTypingRef = useRef(false);
  const stopTimeRef = useRef(null);
  const hideTimeRef = useRef(null);

  const emitTyping = useCallback(
    (isTyping) => {
      isTypingRef.current = isTyping;
      socket.emit("chat:typing", {
        conversationId,
        isTyping,
      });
    },
    [socket, conversationId],
  );

  const stopTyping = useCallback(() => {
    clearTimeout(stopTimeRef.current);
    if (isTypingRef.current) emitTyping(false);
  }, [emitTyping]);

  const notifyTyping = useCallback(() => {
    if (!conversationId) return;
    if (!isTypingRef.current) emitTyping(true);
    clearTimeout(stopTimeRef.current);
    stopTimeRef.current = setTimeout(() => emitTyping(false), STOP_AFTER_MS);
  }, [conversationId, emitTyping]);

  useEffect(() => {
    if (!conversationId) return;
    const hide = () => {
      clearTimeout(hideTimeRef.current);
      setTypingUserId(null);
    };
    const handleTyping = (payload) => {
      if (payload.conversationId !== conversationId) return;
      if (!payload.isTyping) return hide();
      setTypingUserId(payload.userId);
      clearTimeout(hideTimeRef.current);
      hideTimeRef.current = setTimeout(hide, HIDE_AFTER_MS);
    };
    const handleMessage = (message) => {
      if (message.conversationId !== conversationId) return;
      setTypingUserId((current) =>
        current === message.senderId ? null : current,
      );
    };
    socket.on("chat:typing", handleTyping);
    socket.on("chat:message", handleMessage);
    return () => {
      socket.off("chat:typing", handleTyping);
      socket.off("chat:message", handleMessage);
      hide();
      stopTyping();
    };
  }, [socket, conversationId, stopTyping]);

  return { isOtherTyping: typingUserId !== null, notifyTyping, stopTyping };
}
