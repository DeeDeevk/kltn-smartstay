export default function TypingBubble() {
  return (
    <div
      className="flex justify-start"
      role="status"
      aria-label="Đối phương đang nhập tin nhắn"
    >
      <div className="flex items-center gap-1 rounded-2xl bg-gray-100 px-4 py-3">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
