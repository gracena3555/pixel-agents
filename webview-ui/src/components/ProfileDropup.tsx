import { useState } from 'react';

import type { AgentProfile } from '../hooks/useExtensionMessages.js';
import { CharacterPreview } from './CharacterPreview.js';

interface ProfileDropupProps {
  profiles: AgentProfile[];
  onSelectProfile: (profile: AgentProfile) => void;
  onEditProfile: (profile: AgentProfile) => void;
  onAddProfile: () => void;
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  width: '100%',
  padding: '5px 8px',
  fontSize: '22px',
  color: 'var(--pixel-text)',
  background: 'transparent',
  border: 'none',
  borderRadius: 0,
  cursor: 'pointer',
  textAlign: 'left',
};

export function ProfileDropup({
  profiles,
  onSelectProfile,
  onEditProfile,
  onAddProfile,
}: ProfileDropupProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [hoveredEdit, setHoveredEdit] = useState<number | null>(null);
  const [hoveredAdd, setHoveredAdd] = useState(false);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '100%',
        left: 0,
        marginBottom: 4,
        background: 'var(--pixel-bg)',
        border: '2px solid var(--pixel-border)',
        borderRadius: 0,
        boxShadow: 'var(--pixel-shadow)',
        minWidth: 180,
        maxHeight: 300,
        overflowY: 'auto',
        zIndex: 'var(--pixel-controls-z)',
      }}
    >
      {profiles.map((profile, i) => (
        <div
          key={profile.id}
          style={{
            ...rowStyle,
            background: hoveredIdx === i ? 'var(--pixel-btn-hover-bg)' : 'transparent',
            justifyContent: 'space-between',
          }}
          onMouseEnter={() => setHoveredIdx(i)}
          onMouseLeave={() => setHoveredIdx(null)}
          onClick={() => onSelectProfile(profile)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
            <div style={{ flexShrink: 0 }}>
              <CharacterPreview palette={profile.palette} hueShift={profile.hueShift} size={2} />
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div
                style={{
                  fontSize: '22px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {profile.name}
              </div>
              {profile.role && (
                <div
                  style={{
                    fontSize: '16px',
                    color: 'var(--pixel-text-dim)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {profile.role}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEditProfile(profile);
            }}
            onMouseEnter={() => setHoveredEdit(i)}
            onMouseLeave={() => setHoveredEdit(null)}
            style={{
              background: hoveredEdit === i ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
              border: 'none',
              color: 'var(--pixel-text-dim)',
              cursor: 'pointer',
              padding: '2px 4px',
              fontSize: '18px',
              flexShrink: 0,
            }}
            title="Edit profile"
          >
            Edit
          </button>
        </div>
      ))}
      <button
        onClick={onAddProfile}
        onMouseEnter={() => setHoveredAdd(true)}
        onMouseLeave={() => setHoveredAdd(false)}
        style={{
          ...rowStyle,
          background: hoveredAdd ? 'var(--pixel-btn-hover-bg)' : 'transparent',
          borderTop: profiles.length > 0 ? '1px solid var(--pixel-border)' : 'none',
          color: 'var(--pixel-accent)',
          justifyContent: 'center',
        }}
      >
        + Add Profile
      </button>
    </div>
  );
}
