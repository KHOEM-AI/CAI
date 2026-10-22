import React from 'react';

type ProjectType = 'ksv' | 'cai' | 'ai';

interface ProjectSwitcherProps {
  activeProject?: ProjectType;
  current?: 'KSV' | 'CAI' | 'AI';
}

const PROJECTS: Record<ProjectType, { url: string; label: string; color: string }> = {
  ksv: { url: 'http://localhost:5173', label: 'KSV',   color: '#16a34a' },
  cai: { url: 'http://localhost:5174', label: 'CAI',   color: '#2563eb' },
  ai:  { url: 'http://localhost:5175', label: 'AI TV', color: '#9333ea' },
};

export default function ProjectSwitcher({ activeProject, current }: ProjectSwitcherProps) {
  const normalized: ProjectType =
    activeProject ?? (current ? (current.toLowerCase() as ProjectType) : 'ksv');

  const others = (Object.keys(PROJECTS) as ProjectType[]).filter((key) => key !== normalized);

  return (
    <div style={{ padding: '12px', display: 'flex', gap: '8px' }}>
      {others.map((key) => (
        <a
          key={key}
          href={PROJECTS[key].url}
          style={{
            flex: 1,
            padding: '10px 16px',
            borderRadius: '8px',
            color: '#fff',
            background: PROJECTS[key].color,
            textAlign: 'center',
            textDecoration: 'none',
            fontWeight: 'bold',
            fontSize: '13px',
          }}
        >
          → {PROJECTS[key].label}
        </a>
      ))}
    </div>
  );
}
