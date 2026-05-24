import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import PublishModal from '@/components/PublishModal';
import AccessManager from '@/components/AccessManager';
import CloudLibrary from '@/components/CloudLibrary';
import ReviewPanel from '@/components/ReviewPanel';

describe('PublishModal', () => {
  it('renders correctly when isOpen is true', () => {
    const handleClose = vi.fn();
    const handlePublish = vi.fn();
    
    render(
      <PublishModal 
        isOpen={true} 
        onClose={handleClose} 
        onPublish={handlePublish} 
      />
    );
    
    expect(screen.getByText('Publish Package')).toBeInTheDocument();
    expect(screen.getByText('Generate Publish Link')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(<PublishModal isOpen={false} onClose={vi.fn()} onPublish={vi.fn()} />);
    expect(screen.queryByText('Publish Package')).not.toBeInTheDocument();
  });
});

describe('AccessManager', () => {
  it('renders correctly when isOpen is true', () => {
    render(<AccessManager isOpen={true} onClose={vi.fn()} activeLinks={[]} onRevoke={vi.fn()} />);
    expect(screen.getByText('Access & Links')).toBeInTheDocument();
    expect(screen.getByText('No active links for this version.')).toBeInTheDocument();
  });
});

describe('CloudLibrary', () => {
  it('renders correctly when isOpen is true', () => {
    render(
      <CloudLibrary 
        isOpen={true} 
        onClose={vi.fn()} 
        activePlaylistId={null}
        cloudProject={null}
        onSaveCloudVersion={vi.fn()}
        onLoadSharedProject={vi.fn()}
        onViewPublishLinks={vi.fn()}
        onPublishVersion={vi.fn()}
      />
    );
    expect(screen.getByText('Cloud Library & Versions')).toBeInTheDocument();
  });
});

describe('ReviewPanel', () => {
  it('renders correctly when isOpen is true', () => {
    render(
      <ReviewPanel 
        isOpen={true} 
        onClose={vi.fn()} 
        comments={[]}
        onAddComment={vi.fn()}
        onResolveComment={vi.fn()}
        currentVersionId={1}
      />
    );
    expect(screen.getByText('Review Comments')).toBeInTheDocument();
  });
});
