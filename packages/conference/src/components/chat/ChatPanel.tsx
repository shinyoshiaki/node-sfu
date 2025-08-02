import { useSnapshot } from "valtio";
import type { ChatMessage } from "../../types/chat.js";
import { ChatInput } from "./ChatInput.js";
import { MessageList } from "./MessageList.js";

interface ChatPanelProps {
  isVisible: boolean;
  messages: ChatMessage[];
  unreadCount: number;
  currentMemberId: string;
  onSendMessage: (message: string) => void;
  onClose: () => void;
}

export function ChatPanel({
  isVisible,
  messages,
  unreadCount,
  currentMemberId,
  onSendMessage,
  onClose,
}: ChatPanelProps) {
  if (!isVisible) return null;

  return (
    <div
      data-testid="chat-panel"
      className="fixed right-0 top-0 h-full w-80 bg-white shadow-lg border-l z-50 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <h3 className="font-semibold text-gray-800">Chat</h3>
        <button
          data-testid="chat-close-button"
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 p-1"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Message List */}
      <MessageList messages={messages} currentMemberId={currentMemberId} />

      {/* Input */}
      <ChatInput onSendMessage={onSendMessage} />
    </div>
  );
}
