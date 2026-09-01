import React from 'react';

type ProjectType = 'ksv' | 'cai';

interface ProjectSwitcherProps {
  activeProject?: ProjectType; // ប្រើសញ្ញា ? ដើម្បីកុំឱ្យវា Error ក្នុង App.tsx ចាស់
  current?: 'KSV' | 'CAI';     // គាំទ្រ Props ចាស់របស់បង
}

export default function ProjectSwitcher({ activeProject, current }: ProjectSwitcherProps) {
  // កំណត់ថាបច្ចុប្បន្នជា KSV ឬ CAI
  const isKSV = activeProject === 'ksv' || current === 'KSV';
  
  // កំណត់ Link គោលដៅ
  const targetUrl = isKSV ? 'http://localhost:5174' : 'http://localhost:5173';
  const buttonLabel = isKSV ? '👉 ចូលទៅកាន់ CAI ' : '👈 ត្រឡប់ទៅ KSV ';
  const buttonColor = isKSV ? '#2563eb' : '#16a34a';

  return (
    <div style={{ padding: '12px' }}>
      <a
        href={targetUrl}
        style={{
          display: 'block',
          width: '100%',
          padding: '10px 22px',
          borderRadius: '8px',
          color: '#fff',
          background: buttonColor,
          textAlign: 'center',
          textDecoration: 'none',
          fontWeight: 'bold',
          fontSize: '14px'
        }}
      >
        {buttonLabel}
      </a>
    </div>
  );
          }
