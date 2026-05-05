import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SetupScreen } from './SetupScreen';

describe('SetupScreen', () => {
  it('normalizes and saves a pasted server URL', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<SetupScreen onSave={onSave} />);

    await userEvent.type(screen.getByLabelText(/chat server/i), 'chat.example.com/');
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(onSave).toHaveBeenCalledWith('https://chat.example.com');
  });
});
