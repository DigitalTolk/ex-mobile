import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LoginScreen } from './LoginScreen';

describe('LoginScreen', () => {
  it('opens SSO from the primary action', async () => {
    const onLogin = vi.fn();
    render(
      <LoginScreen
        serverUrl="https://chat.example.com"
        user={null}
        busy={false}
        error={null}
        onLogin={onLogin}
        onChangeServer={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /sign in with sso/i }));

    expect(onLogin).toHaveBeenCalledTimes(1);
  });
});
