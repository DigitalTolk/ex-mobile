import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../lib/api';
import type { Message, User } from '../types';
import { ChatShell } from './ChatShell';

vi.mock('../lib/api', () => ({
  apiFetch: vi.fn(),
}));

const user: User = {
  id: 'u-me',
  email: 'me@example.com',
  displayName: 'Me',
};

function message(overrides: Partial<Message> = {}): Message {
  return {
    id: 'm-1',
    parentID: 'ch-1',
    authorID: 'u-other',
    body: 'hello',
    createdAt: '2026-05-05T10:00:00Z',
    ...overrides,
  };
}

function renderShell(props: Partial<Parameters<typeof ChatShell>[0]> = {}) {
  return render(
    <ChatShell
      serverUrl="https://chat.example.com"
      accessToken="token-1"
      user={user}
      onLogout={vi.fn()}
      onChangeServer={vi.fn()}
      {...props}
    />,
  );
}

describe('ChatShell', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it('loads spaces, selects the first channel, loads messages, and sends a message', async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce([{ channelID: 'ch-1', channelName: 'general', channelType: 'public' }])
      .mockResolvedValueOnce([{ conversationID: 'dm-1', displayName: 'Alice', type: 'dm' }])
      .mockResolvedValueOnce({
        items: [
          message({ id: 'old', body: 'oldest', createdAt: '2026-05-05T09:00:00Z' }),
          message({ id: 'new', authorID: 'u-me', body: 'newest' }),
        ],
        hasMore: false,
      })
      .mockResolvedValueOnce(message({ id: 'sent', authorID: 'u-me', body: 'sent text' }));

    renderShell();

    expect(await screen.findByRole('button', { name: /general/i })).toBeInTheDocument();
    expect(await screen.findByText('newest')).toBeInTheDocument();
    expect(screen.getByText('oldest')).toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox', { name: 'Message' }), 'sent text');
    await userEvent.click(screen.getByRole('button', { name: /send message/i }));

    expect(await screen.findByText('sent text')).toBeInTheDocument();
    expect(apiFetch).toHaveBeenLastCalledWith(
      'https://chat.example.com',
      'token-1',
      '/api/v1/channels/ch-1/messages',
      { method: 'POST', body: JSON.stringify({ body: 'sent text' }) },
    );
  });

  it('loads a conversation when there are no channels and handles deleted messages', async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ conversationID: 'dm-1', displayName: 'Alice', type: 'dm' }])
      .mockResolvedValueOnce({
        items: [message({ id: 'deleted', parentID: 'dm-1', deleted: true })],
        hasMore: false,
      });

    renderShell();

    expect(await screen.findByRole('heading', { name: 'Alice' })).toBeInTheDocument();
    expect(screen.getByText('Conversation')).toBeInTheDocument();
    expect(await screen.findByText('Message deleted')).toBeInTheDocument();
    expect(apiFetch).toHaveBeenLastCalledWith('https://chat.example.com', 'token-1', '/api/v1/conversations/dm-1/messages');
  });

  it('switches spaces, refreshes, and calls secondary actions', async () => {
    const onLogout = vi.fn();
    const onChangeServer = vi.fn();
    vi.mocked(apiFetch)
      .mockResolvedValueOnce([{ channelID: 'ch-1', channelName: 'general', channelType: 'public' }])
      .mockResolvedValueOnce([{ conversationID: 'dm-1', displayName: 'Alice', type: 'dm' }])
      .mockResolvedValueOnce({ items: [], hasMore: false })
      .mockResolvedValueOnce({ items: [message({ id: 'dm-msg', parentID: 'dm-1', body: 'dm body' })], hasMore: false })
      .mockResolvedValueOnce([{ channelID: 'ch-1', channelName: 'general', channelType: 'public' }])
      .mockResolvedValueOnce([]);

    renderShell({ onLogout, onChangeServer });

    const workspace = screen.getByRole('navigation', { name: /workspace/i });
    await userEvent.click(await within(workspace).findByRole('button', { name: /alice/i }));
    expect(await screen.findByText('dm body')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /refresh/i }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('https://chat.example.com', 'token-1', '/api/v1/conversations'));

    await userEvent.click(screen.getByRole('button', { name: /server/i }));
    await userEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(onChangeServer).toHaveBeenCalledTimes(1);
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('shows workspace and message errors', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('workspace down'));
    renderShell();

    expect(await screen.findByText('workspace down')).toBeInTheDocument();

    vi.mocked(apiFetch)
      .mockReset()
      .mockResolvedValueOnce([{ channelID: 'ch-1', channelName: 'general', channelType: 'public' }])
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce('bad response');
    renderShell();

    expect(await screen.findByText('Failed to load messages.')).toBeInTheDocument();
  });

  it('keeps the composer disabled until a space is selected', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    renderShell();

    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('heading', { name: 'No conversations yet' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeDisabled();
  });
});
