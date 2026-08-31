import React from 'react';

type ProjectType = 'ksv' | 'cai';

interface ProjectSwitcherProps {
  activeProject: ProjectType;
  onChange: (project: ProjectType) => void;
}

export default function ProjectSwitcher({
  activeProject,
  onChange,
}: ProjectSwitcherProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        padding: 12,
        background: '#111827',
        borderBottom: '1px solid #374151',
      }}
    >
      <button
        onClick={() => onChange('ksv')}
        style={{
          padding: '10px 22px',
          border: 0,
          borderRadius: 8,
          cursor: 'pointer',
          color: '#fff',
          background: activeProject === 'ksv' ? '#2563eb' : '#374151',
        }}
      >
        KSV
      </button>

      <button
        onClick={() => onChange('cai')}
        style={{
          padding: '10px 22px',
          border: 0,
          borderRadius: 8,
          cursor: 'pointer',
          color: '#fff',
          background: activeProject === 'cai' ? '#16a34a' : '#374151',
        }}
      >
        CAI
      </button>
    </div>
  );
}
