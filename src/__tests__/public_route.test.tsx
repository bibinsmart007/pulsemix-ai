import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import PublicPlaybackView from '@/app/public/[token]/page';

// Mock useParams from next/navigation
vi.mock('next/navigation', () => ({
  useParams: () => ({ token: 'mock-token-123' })
}));

describe('PublicPlaybackView', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders loading state initially', () => {
    // Mock fetch to not resolve immediately
    global.fetch = vi.fn(() => new Promise(() => {}));
    const { container } = render(<PublicPlaybackView />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders needs_password when package requires password', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: false, needs_password: true })
    });

    render(<PublicPlaybackView />);
    
    await waitFor(() => {
      expect(screen.getByText('Protected Package')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter password')).toBeInTheDocument();
    });
  });

  it('renders revoked message when package is revoked', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: false, error: 'revoked' })
    });

    render(<PublicPlaybackView />);
    
    await waitFor(() => {
      expect(screen.getByText('This link has been revoked by the creator.')).toBeInTheDocument();
    });
  });

  it('renders expired message when package is expired', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: false, error: 'expired' })
    });

    render(<PublicPlaybackView />);
    
    await waitFor(() => {
      expect(screen.getByText('This link has expired.')).toBeInTheDocument();
    });
  });

  it('renders package data when fetch is successful', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ 
        success: true, 
        project_name: 'Test Project',
        package_type: 'shared_release',
        allow_download: 1,
        manifest: {
          tracks: [
            { title: 'Track 1', artist: 'Artist 1' }
          ]
        }
      })
    });

    render(<PublicPlaybackView />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument();
      expect(screen.getByText('Track 1')).toBeInTheDocument();
      expect(screen.getByText('Download Audio')).toBeInTheDocument();
    });
  });
});
