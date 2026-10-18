// Messaging (apps/messaging): direct and group conversations between users.
// These views answer the serializer data as is (no { success, data } envelope).

export type ChatUser = { id: string; username: string; first_name: string; last_name: string; avatar_url: string };

/** ConversationListSerializer */
export type Conversation = {
  id: string;
  conversation_type: 'direct' | 'group';
  title: string | null;
  community_id: string | null;
  last_message_at: string;
  participants: { id: string; user: ChatUser; role: string; joined_at: string; last_read_at: string }[];
  last_message: { id: string; sender_username: string; content: string; created_at: string } | null;
  unread_count: number;
  created_at: string;
};

/** MessageSerializer (a deleted message keeps its place: "[Ce message a été supprimé]") */
export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender: ChatUser;
  content: string;
  is_edited: boolean;
  is_deleted: boolean;
  is_pinned: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};
