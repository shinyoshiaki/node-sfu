import type { ChatMessage } from "../../types/chat.js";

interface MessageItemProps {
  message: ChatMessage;
  isOwn: boolean;
}

export function MessageItem({ message, isOwn }: MessageItemProps) {
  const formattedTime = new Date(message.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      data-testid="message-item"
      className={`flex flex-col mb-3 ${isOwn ? "items-end" : "items-start"}`}
    >
      <div
        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
          isOwn ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-800"
        }`}
      >
        {!isOwn && message.memberName && (
          <div className="text-xs font-semibold mb-1">{message.memberName}</div>
        )}
        <div className="break-words">{message.content}</div>
      </div>
      <div className="text-xs text-gray-500 mt-1">{formattedTime}</div>
    </div>
  );
}
