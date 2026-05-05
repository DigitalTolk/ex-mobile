import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Hash, LogOut, MessageCircle, RefreshCcw, Send, Server, UsersRound } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { formatMessageTime } from '../lib/format';
import type { Message, PaginatedResponse, Space, User, UserChannel, UserConversation } from '../types';

interface ChatShellProps {
  serverUrl: string;
  accessToken: string;
  user: User;
  onLogout: () => void;
  onChangeServer: () => void;
}

export function ChatShell({ serverUrl, accessToken, user, onLogout, onChangeServer }: ChatShellProps) {
  const [channels, setChannels] = useState<UserChannel[]>([]);
  const [conversations, setConversations] = useState<UserConversation[]>([]);
  const [selected, setSelected] = useState<Space | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const spaces = useMemo<Space[]>(
    () => [
      ...channels.map((channel) => ({
        kind: 'channel' as const,
        id: channel.channelID,
        name: channel.channelName,
      })),
      ...conversations.map((conversation) => ({
        kind: 'conversation' as const,
        id: conversation.conversationID,
        name: conversation.displayName,
      })),
    ],
    [channels, conversations],
  );

  const refreshMessages = useCallback(
    async (space = selected) => {
      if (!space) return;
      setLoading(true);
      setError(null);
      try {
        const path =
          space.kind === 'channel'
            ? `/api/v1/channels/${encodeURIComponent(space.id)}/messages`
            : `/api/v1/conversations/${encodeURIComponent(space.id)}/messages`;
        const page = await apiFetch<PaginatedResponse<Message>>(serverUrl, accessToken, path);
        setMessages([...page.items].reverse());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load messages.');
      } finally {
        setLoading(false);
      }
    },
    [accessToken, selected, serverUrl],
  );

  const refreshSpaces = useCallback(async () => {
    setError(null);
    const [nextChannels, nextConversations] = await Promise.all([
      apiFetch<UserChannel[]>(serverUrl, accessToken, '/api/v1/channels'),
      apiFetch<UserConversation[]>(serverUrl, accessToken, '/api/v1/conversations'),
    ]);
    setChannels(nextChannels);
    setConversations(nextConversations);
    setSelected((current) => current ?? spaceFromLists(nextChannels, nextConversations));
  }, [accessToken, serverUrl]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !draft.trim()) return;
    const path =
      selected.kind === 'channel'
        ? `/api/v1/channels/${encodeURIComponent(selected.id)}/messages`
        : `/api/v1/conversations/${encodeURIComponent(selected.id)}/messages`;
    const optimisticBody = draft.trim();
    setDraft('');
    const message = await apiFetch<Message>(serverUrl, accessToken, path, {
      method: 'POST',
      body: JSON.stringify({ body: optimisticBody }),
    });
    setMessages((current) => [...current, message]);
  }

  useEffect(() => {
    refreshSpaces().catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load workspace.');
    });
  }, [refreshSpaces]);

  useEffect(() => {
    refreshMessages().catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load messages.');
    });
  }, [refreshMessages]);

  return (
    <main className="chat-shell">
      <aside className="spaces">
        <div className="spaces-header">
          <div>
            <strong>{user.displayName}</strong>
            <span>{user.email}</span>
          </div>
          <button type="button" className="icon-button" aria-label="Refresh" onClick={() => void refreshSpaces()}>
            <RefreshCcw size={18} />
          </button>
        </div>
        <nav aria-label="Workspace">
          {spaces.map((space) => (
            <button
              type="button"
              key={`${space.kind}:${space.id}`}
              className={selected?.kind === space.kind && selected.id === space.id ? 'active' : ''}
              onClick={() => setSelected(space)}
            >
              {space.kind === 'channel' ? <Hash size={17} /> : <UsersRound size={17} />}
              <span>{space.name}</span>
            </button>
          ))}
        </nav>
        <div className="spaces-actions">
          <button type="button" className="secondary-button" onClick={onChangeServer}>
            <Server size={17} />
            Server
          </button>
          <button type="button" className="secondary-button" onClick={onLogout}>
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </aside>

      <section className="messages-pane">
        <header>
          <div>
            <span className="space-kicker">{selected?.kind === 'channel' ? 'Channel' : 'Conversation'}</span>
            <h1>{selected?.name ?? 'No conversations yet'}</h1>
          </div>
          <MessageCircle size={24} />
        </header>
        {error && <p className="form-error inline">{error}</p>}
        <div className="message-list" aria-live="polite">
          {loading && <p className="empty-state">Loading messages...</p>}
          {!loading && messages.length === 0 && <p className="empty-state">No messages.</p>}
          {messages.map((message) => (
            <article key={message.id} className={message.authorID === user.id ? 'message own' : 'message'}>
              <div className="message-meta">
                <strong>{message.authorID === user.id ? user.displayName : message.authorID}</strong>
                <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
              </div>
              <p>{message.deleted ? 'Message deleted' : message.body}</p>
            </article>
          ))}
        </div>
        <form className="composer" onSubmit={sendMessage}>
          <input
            aria-label="Message"
            placeholder={selected ? `Message ${selected.name}` : 'Select a conversation'}
            value={draft}
            disabled={!selected}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="submit" aria-label="Send message" disabled={!selected || !draft.trim()}>
            <Send size={19} />
          </button>
        </form>
      </section>
    </main>
  );
}

function spaceFromLists(channels: UserChannel[], conversations: UserConversation[]): Space | null {
  const firstChannel = channels[0];
  if (firstChannel) return { kind: 'channel', id: firstChannel.channelID, name: firstChannel.channelName };
  const firstConversation = conversations[0];
  if (firstConversation) {
    return { kind: 'conversation', id: firstConversation.conversationID, name: firstConversation.displayName };
  }
  return null;
}
