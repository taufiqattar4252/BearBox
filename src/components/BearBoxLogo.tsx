import React from 'react';
import { BEARBOX_ICON_128, BEARBOX_ICON_32 } from './logoData';

interface BearBoxLogoProps {
  size?: number;
  className?: string;
  animate?: boolean;
}

export const BearBoxLogo: React.FC<BearBoxLogoProps> = ({
  size = 32,
  className = '',
  animate = false
}) => {
  // Use embedded high-resolution base64 icon data URI to guarantee 100% reliable rendering
  // in all extension contexts (unpacked root, dist, options page, popup, web preview)
  // with zero network latency, zero path resolution issues, and zero 404 errors.
  const iconSrc = size <= 32 ? BEARBOX_ICON_32 : BEARBOX_ICON_128;

  return (
    <div
      className={`bearbox-logo-wrapper ${animate ? 'animate-pulse' : ''} ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        flexShrink: 0
      }}
    >
      <img
        src={iconSrc}
        alt="BearBox Logo"
        width={size}
        height={size}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          borderRadius: `${Math.round(size * 0.22)}px`,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.35)',
          userSelect: 'none'
        }}
        onError={(e) => {
          // If for any unforeseen reason data URI fails, fall back to chrome.runtime.getURL
          const target = e.currentTarget;
          if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
            target.src = chrome.runtime.getURL('icons/icon-128.png');
          }
        }}
      />
    </div>
  );
};
