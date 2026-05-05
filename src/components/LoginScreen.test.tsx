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

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /sign in with sso/i }));

    expect(onLogin).toHaveBeenCalledTimes(1);
  });

  it('renders restored user, busy, and error states', () => {
    render(
      <LoginScreen
        serverUrl="https://chat.example.com"
        user={{ id: 'u-1', email: 'me@example.com', displayName: 'Me' }}
        busy={true}
        error="SSO failed"
        onLogin={vi.fn()}
        onChangeServer={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Welcome, Me' })).toBeInTheDocument();
    expect(screen.getByText('SSO failed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /opening sso/i })).toBeDisabled();
  });
});
