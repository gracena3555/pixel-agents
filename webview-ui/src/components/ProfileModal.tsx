import { useEffect, useState } from 'react';

import { PALETTE_COUNT } from '../constants.js';
import type { AgentProfile, SkillInfo } from '../hooks/useExtensionMessages.js';
import { CharacterPreview } from './CharacterPreview.js';

const MODEL_OPTIONS = [
  { value: '', label: 'Default' },
  { value: 'opus', label: 'Opus' },
  { value: 'sonnet', label: 'Sonnet' },
  { value: 'haiku', label: 'Haiku' },
];

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (profile: AgentProfile) => void;
  onDelete?: (id: string) => void;
  profile: AgentProfile | null;
  mcpServers: string[];
  skills: SkillInfo[];
}

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  background: 'rgba(0, 0, 0, 0.5)',
  zIndex: 49,
};

const modalStyle: React.CSSProperties = {
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  zIndex: 50,
  background: 'var(--pixel-bg)',
  border: '2px solid var(--pixel-border)',
  borderRadius: 0,
  padding: '12px 16px',
  boxShadow: 'var(--pixel-shadow)',
  minWidth: 340,
  maxWidth: 440,
  maxHeight: '90vh',
  overflowY: 'auto',
};

const labelStyle: React.CSSProperties = {
  fontSize: '22px',
  color: 'rgba(255, 255, 255, 0.7)',
  marginBottom: 2,
  display: 'block',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '4px 6px',
  fontSize: '22px',
  background: 'var(--pixel-btn-bg)',
  color: 'var(--pixel-text)',
  border: '2px solid var(--pixel-border)',
  borderRadius: 0,
  boxSizing: 'border-box',
};

const sectionStyle: React.CSSProperties = {
  marginBottom: 10,
};

const btnStyle: React.CSSProperties = {
  padding: '5px 14px',
  fontSize: '22px',
  background: 'var(--pixel-btn-bg)',
  color: 'var(--pixel-text)',
  border: '2px solid var(--pixel-border)',
  borderRadius: 0,
  cursor: 'pointer',
};

const checkboxWrapStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  marginRight: 10,
  marginBottom: 4,
  fontSize: '20px',
  color: 'rgba(255, 255, 255, 0.8)',
  cursor: 'pointer',
};

const checkboxStyle: React.CSSProperties = {
  width: 14,
  height: 14,
  border: '2px solid rgba(255, 255, 255, 0.5)',
  borderRadius: 0,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '12px',
  lineHeight: 1,
  color: '#fff',
  cursor: 'pointer',
};

function createEmptyProfile(): AgentProfile {
  return {
    id: crypto.randomUUID(),
    name: '',
    role: '',
    palette: 0,
    hueShift: 0,
    systemPrompt: '',
    allowedTools: [],
    model: undefined,
  };
}

export function ProfileModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  profile,
  mcpServers,
  skills,
}: ProfileModalProps) {
  const [form, setForm] = useState<AgentProfile>(createEmptyProfile);
  const [customHue, setCustomHue] = useState(false);
  const [showSkinEditor, setShowSkinEditor] = useState(false);
  // MCP servers enabled (checked) by the user — all checked by default
  const [enabledMcp, setEnabledMcp] = useState<Set<string>>(new Set());

  const isEditing = !!profile;

  useEffect(() => {
    if (isOpen) {
      if (profile) {
        setForm(profile);
        setCustomHue(profile.hueShift > 0);
        setShowSkinEditor(false);
        // Reconstruct enabled MCP set from allowedTools
        if (profile.allowedTools.length > 0) {
          const enabled = new Set<string>();
          for (const tool of profile.allowedTools) {
            const match = /^mcp__(.+)__\*$/.exec(tool);
            if (match) {
              enabled.add(match[1]);
            }
          }
          setEnabledMcp(enabled);
        } else {
          // No restrictions — all servers enabled
          setEnabledMcp(new Set(mcpServers));
        }
      } else {
        const empty = createEmptyProfile();
        setForm(empty);
        setCustomHue(false);
        setShowSkinEditor(false);
        // Default: all MCP servers enabled
        setEnabledMcp(new Set(mcpServers));
      }
    }
  }, [isOpen, profile, mcpServers]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!form.name.trim()) return;
    // Build allowedTools from enabled MCP servers
    // If all servers are checked → empty array (no flag = full access)
    const allChecked = mcpServers.every((s) => enabledMcp.has(s));
    const allowedTools = allChecked
      ? []
      : mcpServers.filter((s) => enabledMcp.has(s)).map((s) => `mcp__${s}__*`);
    onSave({
      ...form,
      name: form.name.trim(),
      role: form.role.trim(),
      allowedTools,
    });
    onClose();
  };

  const toggleMcpServer = (server: string) => {
    setEnabledMcp((prev) => {
      const next = new Set(prev);
      if (next.has(server)) {
        next.delete(server);
      } else {
        next.add(server);
      }
      return next;
    });
  };

  return (
    <>
      <div onClick={onClose} style={backdropStyle} />
      <div style={modalStyle}>
        {showSkinEditor ? (
          <>
            {/* ── Skin editor view ── */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10,
                borderBottom: '1px solid var(--pixel-border)',
                paddingBottom: 6,
              }}
            >
              <span style={{ fontSize: '24px', color: 'rgba(255, 255, 255, 0.9)' }}>
                Choose Skin
              </span>
              <button
                onClick={() => setShowSkinEditor(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '0 4px',
                  lineHeight: 1,
                }}
              >
                X
              </button>
            </div>

            {/* Large preview */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <CharacterPreview
                palette={form.palette}
                hueShift={customHue ? form.hueShift : 0}
                size={5}
              />
            </div>

            {/* Palette thumbnails */}
            <div
              style={{
                display: 'flex',
                gap: 6,
                flexWrap: 'wrap',
                justifyContent: 'center',
                marginBottom: 12,
              }}
            >
              {Array.from({ length: PALETTE_COUNT }, (_, i) => (
                <div
                  key={i}
                  onClick={() => setForm((f) => ({ ...f, palette: i }))}
                  style={{
                    border:
                      form.palette === i
                        ? '2px solid var(--pixel-accent)'
                        : '2px solid var(--pixel-border)',
                    cursor: 'pointer',
                    padding: 2,
                    borderRadius: 0,
                  }}
                >
                  <CharacterPreview palette={i} hueShift={customHue ? form.hueShift : 0} size={2} />
                </div>
              ))}
            </div>

            {/* Custom hue */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 12,
              }}
            >
              <label
                style={checkboxWrapStyle}
                onClick={() => {
                  setCustomHue((prev) => {
                    if (prev) setForm((f) => ({ ...f, hueShift: 0 }));
                    else if (form.hueShift === 0) setForm((f) => ({ ...f, hueShift: 45 }));
                    return !prev;
                  });
                }}
              >
                <span
                  style={{
                    ...checkboxStyle,
                    background: customHue ? 'rgba(90, 140, 255, 0.8)' : 'transparent',
                  }}
                >
                  {customHue ? 'X' : ''}
                </span>
                Custom hue
              </label>
              {customHue && (
                <input
                  type="range"
                  min={45}
                  max={315}
                  value={form.hueShift || 45}
                  onChange={(e) => setForm((f) => ({ ...f, hueShift: Number(e.target.value) }))}
                  style={{ flex: 1 }}
                />
              )}
            </div>

            {/* Done button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowSkinEditor(false)}
                style={{ ...btnStyle, background: 'var(--pixel-accent)', color: '#fff' }}
              >
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            {/* ── Main profile form ── */}
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10,
                borderBottom: '1px solid var(--pixel-border)',
                paddingBottom: 6,
              }}
            >
              <span style={{ fontSize: '24px', color: 'rgba(255, 255, 255, 0.9)' }}>
                {isEditing ? 'Edit Profile' : 'New Agent Profile'}
              </span>
              <button
                onClick={onClose}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '0 4px',
                  lineHeight: 1,
                }}
              >
                X
              </button>
            </div>

            {/* Character preview + name/role */}
            <div style={{ ...sectionStyle, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  margin: '0 8px',
                }}
              >
                <CharacterPreview
                  palette={form.palette}
                  hueShift={customHue ? form.hueShift : 0}
                  size={3}
                />
                <button
                  onClick={() => setShowSkinEditor(true)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--pixel-accent)',
                    fontSize: '18px',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Edit
                </button>
              </div>
              <div style={{ flex: 1 }}>
                <span style={labelStyle}>Name</span>
                <input
                  style={inputStyle}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Agent name"
                  autoFocus
                />
                <span style={{ ...labelStyle, marginTop: 6 }}>Role</span>
                <input
                  style={inputStyle}
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  placeholder="Short description"
                />
              </div>
            </div>

            {/* Model */}
            <div style={sectionStyle}>
              <span style={labelStyle}>Model</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {MODEL_OPTIONS.map((opt) => {
                  const isActive = (form.model || '') === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setForm((f) => ({ ...f, model: opt.value || undefined }))}
                      style={{
                        padding: '4px 10px',
                        fontSize: '20px',
                        background: isActive ? 'var(--pixel-accent)' : 'var(--pixel-btn-bg)',
                        color: isActive ? '#fff' : 'var(--pixel-text)',
                        border: isActive
                          ? '2px solid var(--pixel-accent)'
                          : '2px solid var(--pixel-border)',
                        borderRadius: 0,
                        cursor: 'pointer',
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* System Prompt */}
            <div style={sectionStyle}>
              <span style={labelStyle}>System Prompt</span>
              <textarea
                style={{
                  ...inputStyle,
                  minHeight: 90,
                  maxHeight: 160,
                  resize: 'vertical',
                }}
                value={form.systemPrompt}
                onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))}
                placeholder="Custom instructions..."
              />
            </div>

            {/* MCP Servers + Skills */}
            <div style={sectionStyle}>
              {mcpServers.length > 0 && (
                <>
                  <div
                    style={{
                      fontSize: '22px',
                      color: 'rgba(255, 255, 255, 0.7)',
                      marginBottom: 4,
                      borderTop: '1px solid var(--pixel-border)',
                      paddingTop: 6,
                    }}
                  >
                    MCP Servers
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                    {mcpServers.map((server) => {
                      const enabled = enabledMcp.has(server);
                      return (
                        <label
                          key={server}
                          style={checkboxWrapStyle}
                          onClick={() => toggleMcpServer(server)}
                        >
                          <span
                            style={{
                              ...checkboxStyle,
                              background: enabled ? 'rgba(90, 140, 255, 0.8)' : 'transparent',
                            }}
                          >
                            {enabled ? 'X' : ''}
                          </span>
                          {server}
                        </label>
                      );
                    })}
                  </div>
                </>
              )}
              {skills.length > 0 && (
                <>
                  <div
                    style={{
                      fontSize: '22px',
                      color: 'rgba(255, 255, 255, 0.7)',
                      marginBottom: 4,
                      marginTop: mcpServers.length > 0 ? 8 : 0,
                      borderTop: mcpServers.length > 0 ? 'none' : '1px solid var(--pixel-border)',
                      paddingTop: mcpServers.length > 0 ? 0 : 6,
                    }}
                  >
                    Available Skills
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {skills.map((skill) => (
                      <div
                        key={`${skill.source}:${skill.name}`}
                        style={{
                          fontSize: '18px',
                          color: 'rgba(255, 255, 255, 0.5)',
                          display: 'flex',
                          gap: 6,
                        }}
                      >
                        <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>/{skill.name}</span>
                        {skill.description && (
                          <span style={{ color: 'rgba(255, 255, 255, 0.4)' }}>
                            {skill.description}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Footer buttons */}
            <div
              style={{
                display: 'flex',
                justifyContent: isEditing ? 'space-between' : 'flex-end',
                gap: 6,
                borderTop: '1px solid var(--pixel-border)',
                paddingTop: 8,
              }}
            >
              {isEditing && onDelete && (
                <button
                  onClick={() => {
                    onDelete(form.id);
                    onClose();
                  }}
                  style={{
                    ...btnStyle,
                    background: 'var(--pixel-danger-bg, #c0392b)',
                    color: '#fff',
                  }}
                >
                  Delete
                </button>
              )}
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={onClose} style={btnStyle}>
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  style={{
                    ...btnStyle,
                    background: form.name.trim() ? 'var(--pixel-accent)' : 'var(--pixel-btn-bg)',
                    color: form.name.trim() ? '#fff' : 'var(--pixel-text-dim)',
                    cursor: form.name.trim() ? 'pointer' : 'default',
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
