import { useEffect, useRef, useState } from 'react';

import type { AgentProfile, WorkspaceFolder } from '../hooks/useExtensionMessages.js';
import { vscode } from '../vscodeApi.js';
import { ProfileDropup } from './ProfileDropup.js';
import { SettingsModal } from './SettingsModal.js';

interface BottomToolbarProps {
  isEditMode: boolean;
  onOpenClaude: () => void;
  onToggleEditMode: () => void;
  isDebugMode: boolean;
  onToggleDebugMode: () => void;
  alwaysShowOverlay: boolean;
  onToggleAlwaysShowOverlay: () => void;
  workspaceFolders: WorkspaceFolder[];
  profiles: AgentProfile[];
  onOpenProfileModal: (profile?: AgentProfile) => void;
}

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 10,
  left: 10,
  zIndex: 'var(--pixel-controls-z)',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  background: 'var(--pixel-bg)',
  border: '2px solid var(--pixel-border)',
  borderRadius: 0,
  padding: '4px 6px',
  boxShadow: 'var(--pixel-shadow)',
};

const btnBase: React.CSSProperties = {
  padding: '5px 10px',
  fontSize: '24px',
  color: 'var(--pixel-text)',
  background: 'var(--pixel-btn-bg)',
  border: '2px solid transparent',
  borderRadius: 0,
  cursor: 'pointer',
};

const btnActive: React.CSSProperties = {
  ...btnBase,
  background: 'var(--pixel-active-bg)',
  border: '2px solid var(--pixel-accent)',
};

export function BottomToolbar({
  isEditMode,
  onOpenClaude,
  onToggleEditMode,
  isDebugMode,
  onToggleDebugMode,
  alwaysShowOverlay,
  onToggleAlwaysShowOverlay,
  workspaceFolders,
  profiles,
  onOpenProfileModal,
}: BottomToolbarProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFolderPickerOpen, setIsFolderPickerOpen] = useState(false);
  const [hoveredFolder, setHoveredFolder] = useState<number | null>(null);
  const [showDropup, setShowDropup] = useState(false);
  const [pendingProfileId, setPendingProfileId] = useState<string | null>(null);
  const folderPickerRef = useRef<HTMLDivElement>(null);
  const dropupRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<number>(0);
  const hideTimerRef = useRef<number>(0);

  // Close folder picker on outside click
  useEffect(() => {
    if (!isFolderPickerOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (folderPickerRef.current && !folderPickerRef.current.contains(e.target as Node)) {
        setIsFolderPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isFolderPickerOpen]);

  const hasMultipleFolders = workspaceFolders.length > 1;

  const handleAgentClick = () => {
    if (hasMultipleFolders) {
      setPendingProfileId(null);
      setIsFolderPickerOpen((v) => !v);
    } else {
      onOpenClaude();
    }
  };

  const handleFolderSelect = (folder: WorkspaceFolder) => {
    setIsFolderPickerOpen(false);
    if (pendingProfileId) {
      vscode.postMessage({
        type: 'openClaude',
        folderPath: folder.path,
        profileId: pendingProfileId,
      });
      setPendingProfileId(null);
    } else {
      vscode.postMessage({ type: 'openClaude', folderPath: folder.path });
    }
  };

  const handleProfileSelect = (profile: AgentProfile) => {
    setShowDropup(false);
    if (hasMultipleFolders) {
      setPendingProfileId(profile.id);
      setIsFolderPickerOpen(true);
    } else {
      vscode.postMessage({ type: 'openClaude', profileId: profile.id });
    }
  };

  const handleDropupEnter = () => {
    clearTimeout(hideTimerRef.current);
    clearTimeout(hoverTimerRef.current);
    if (!showDropup) {
      hoverTimerRef.current = window.setTimeout(() => setShowDropup(true), 150);
    }
  };

  const handleDropupLeave = () => {
    clearTimeout(hoverTimerRef.current);
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => setShowDropup(false), 300);
  };

  return (
    <div style={panelStyle}>
      <div
        ref={dropupRef}
        style={{ position: 'relative' }}
        onMouseEnter={handleDropupEnter}
        onMouseLeave={handleDropupLeave}
      >
        <div ref={folderPickerRef} style={{ position: 'relative' }}>
          <button
            onClick={handleAgentClick}
            onMouseEnter={() => setHovered('agent')}
            onMouseLeave={() => setHovered(null)}
            style={{
              ...btnBase,
              padding: '5px 12px',
              background:
                hovered === 'agent' || isFolderPickerOpen
                  ? 'var(--pixel-agent-hover-bg)'
                  : 'var(--pixel-agent-bg)',
              border: '2px solid var(--pixel-agent-border)',
              color: 'var(--pixel-agent-text)',
            }}
          >
            + Agent
          </button>
          {isFolderPickerOpen && (
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
                minWidth: 160,
                zIndex: 'var(--pixel-controls-z)',
              }}
            >
              {workspaceFolders.map((folder, i) => (
                <button
                  key={folder.path}
                  onClick={() => handleFolderSelect(folder)}
                  onMouseEnter={() => setHoveredFolder(i)}
                  onMouseLeave={() => setHoveredFolder(null)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '6px 10px',
                    fontSize: '22px',
                    color: 'var(--pixel-text)',
                    background: hoveredFolder === i ? 'var(--pixel-btn-hover-bg)' : 'transparent',
                    border: 'none',
                    borderRadius: 0,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {folder.name}
                </button>
              ))}
            </div>
          )}
        </div>
        {showDropup && !isFolderPickerOpen && (
          <ProfileDropup
            profiles={profiles}
            onSelectProfile={handleProfileSelect}
            onEditProfile={(p) => {
              setShowDropup(false);
              onOpenProfileModal(p);
            }}
            onAddProfile={() => {
              setShowDropup(false);
              onOpenProfileModal();
            }}
          />
        )}
      </div>
      <button
        onClick={onToggleEditMode}
        onMouseEnter={() => setHovered('edit')}
        onMouseLeave={() => setHovered(null)}
        style={
          isEditMode
            ? { ...btnActive }
            : {
                ...btnBase,
                background: hovered === 'edit' ? 'var(--pixel-btn-hover-bg)' : btnBase.background,
              }
        }
        title="Edit office layout"
      >
        Layout
      </button>
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setIsSettingsOpen((v) => !v)}
          onMouseEnter={() => setHovered('settings')}
          onMouseLeave={() => setHovered(null)}
          style={
            isSettingsOpen
              ? { ...btnActive }
              : {
                  ...btnBase,
                  background:
                    hovered === 'settings' ? 'var(--pixel-btn-hover-bg)' : btnBase.background,
                }
          }
          title="Settings"
        >
          Settings
        </button>
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          isDebugMode={isDebugMode}
          onToggleDebugMode={onToggleDebugMode}
          alwaysShowOverlay={alwaysShowOverlay}
          onToggleAlwaysShowOverlay={onToggleAlwaysShowOverlay}
        />
      </div>
    </div>
  );
}
