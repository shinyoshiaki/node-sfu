import { useEffect, useRef } from "react";
import type { ChatMessage } from "../../types/chat.js";
import { MessageItem } from "./MessageItem.js";

interface MessageListProps {
  messages: ChatMessage[];
  currentMemberId: string;
}

export function MessageList({ messages, currentMemberId }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
      {messages.length === 0 ? (
        <div className="text-center text-gray-500 mt-8">
          No messages yet. Start the conversation!
        </div>
      ) : (
        messages.map((message) => (
          <MessageItem
            key={message.id}
            message={message}
            isOwn={message.memberId === currentMemberId}
          />
        ))
      )}
    </div>
  );
}
