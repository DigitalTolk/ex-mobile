export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarURL?: string;
  systemRole?: 'admin' | 'member' | 'guest';
  authProvider?: 'oidc' | 'guest';
  status?: string;
  online?: boolean;
}

export interface UserChannel {
  channelID: string;
  channelName: string;
  channelType: 'public' | 'private';
  muted?: boolean;
  favorite?: boolean;
}

export interface UserConversation {
  conversationID: string;
  type: 'dm' | 'group';
  displayName: string;
  unread?: boolean;
  favorite?: boolean;
}

export interface Message {
  id: string;
  parentID: string;
  parentType?: 'channel' | 'conversation';
  authorID: string;
  body: string;
  system?: boolean;
  createdAt: string;
  deleted?: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  hasMore: boolean;
  nextCursor?: string;
}

export type Space =
  | { kind: 'channel'; id: string; name: string }
  | { kind: 'conversation'; id: string; name: string };
