export interface ChatMessage {
  id: string;
  type: "chat";
  memberId: string;
  memberName?: string;
  content: string;
  timestamp: number;
}

export interface ChatState {
  messages: ChatMessage[];
  isVisible: boolean;
  unreadCount: number;
}
