import { proxy } from "valtio";
import type { ChatMessage, ChatState } from "../types/chat.js";

export const chatState = proxy<ChatState>({
  messages: [],
  isVisible: false,
  unreadCount: 0,
});

function generateUniqueId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2)}`;
}

export const chatActions = {
  toggleVisibility: () => {
    chatState.isVisible = !chatState.isVisible;
    if (chatState.isVisible) {
      chatState.unreadCount = 0;
    }
  },

  addMessage: (message: ChatMessage) => {
    chatState.messages.push(message);
    if (!chatState.isVisible) {
      chatState.unreadCount++;
    }
  },

  createMessage: (
    content: string,
    memberId: string,
    memberName?: string,
  ): ChatMessage => {
    return {
      id: generateUniqueId(),
      type: "chat",
      memberId,
      memberName,
      content,
      timestamp: Date.now(),
    };
  },
};

export type { ChatMessage };
