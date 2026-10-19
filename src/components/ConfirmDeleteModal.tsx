import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  scriptName?: string;
  itemName?: string;
  title?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  scriptName,
  itemName,
  title = 'Delete Script',
  onConfirm,
  onCancel,
  isDeleting = false
}) => {
  if (!isOpen) return null;
  const nameToDisplay = itemName || scriptName || 'item';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDeleting) onCancel();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: '#0f172a',
          borderRadius: '14px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          overflow: 'hidden',
          border: '1px solid rgba(239, 68, 68, 0.3)'
        }}
      >
        <div style={{ padding: '24px', display: 'flex', gap: '16px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.18)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <AlertTriangle size={22} />
          </div>

          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#f8fafc', margin: '0 0 6px 0' }}>
              {title}
            </h3>
            <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: '1.5', margin: 0 }}>
              Are you sure you want to delete <strong style={{ color: '#fca5a5' }}>&quot;{nameToDisplay}&quot;</strong>? This action cannot be undone and it will be permanently removed.
            </p>
          </div>
        </div>

        <div
          style={{
            padding: '14px 20px',
            backgroundColor: '#111827',
            borderTop: '1px solid #1e293b',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px'
          }}
        >
          <button
            type="button"
            className="bb-btn bb-btn-secondary"
            onClick={onCancel}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="bb-btn bb-btn-danger"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            <Trash2 size={15} />
            {isDeleting ? 'Deleting...' : title}
          </button>
        </div>
      </div>
    </div>
  );
};
