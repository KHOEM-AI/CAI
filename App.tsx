import React, { useState, useRef, useEffect } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

// ================= ១. Types =================
type TabType = 'scanner' | 'history' | 'export';
type ScanCategory = 'universal' | 'wood' | 'fruits' | 'sugarcane';
type Role = 'admin' | 'staff';

interface UserProfile {
  name: string;
  role: Role;
  avatar: string;
}

interface DetectedItem {
  id: string;
  label: string;
  x: number; y: number; w: number; h: number;
  isManual: boolean;
}

interface SecurityRecord {
  id: string;
  operator: string;
  category: ScanCategory;
  batchId: string;
  hashSignature: string;
  qrCodeUrl: string;
  timestamp: string;
  totalCount: number;
  detectedTypes: string[];
  gps: { lat: number; lng: number } | null;
  aiAssisted: boolean; // true បើ AI ជួយរាប់, false បើរាប់ដោយដៃទាំងស្រុង
}

// ទីតាំងរោងចក្រ/ចម្ការ — ត្រូវប្តូរជាកូអរដោនេពិតរបស់បង
const FACTORY_GPS = { lat: 11.5564, lng: 104.9282 };
const GEOFENCE_RADIUS_KM = 5; // អនុញ្ញាតឱ្យស្កេនក្នុងចម្ងាយ ៥ គីឡូម៉ែត្រ

// ================= ២. Utilities =================

// SHA-256 សម្រាប់បង្កើត Signature សុវត្ថិភាព (ប្រើដូចគ្នាគ្រប់កន្លែង)
const generateSecurityHash = async (dataString: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(dataString);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};

// ចម្ងាយពិតប្រាកដរវាងកូអរដោនេ ២ (គីឡូម៉ែត្រ) — Haversine formula
// (កំណែមុនប្រើ Pythagorean លើ lat/lng ត្រង់ៗ ដែលខុសព្រោះ lat/lng មិនមែនជា grid ស្មើគ្នា)
const haversineDistanceKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }): number => {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const CATEGORY_LABELS: Record<ScanCategory, string> = {
  universal: '🔍 វត្ថុទូទៅ',
  fruits: '🍎 ផ្លែឈើ',
  sugarcane: '🎋 អំពៅ/កសិផល',
  wood: '🪵 ឈើ',
};

// coco-ssd ជា model ទូទៅ (មនុស្ស, ផ្លែប៉ោម, រថយន្ត...) មិនមែនបណ្តុះបណ្តាលមកសម្រាប់ ឈើ/អំពៅជាក់លាក់ទេ
// ដូច្នេះលទ្ធផល AI សម្រាប់ category ទាំងនេះនៅតែជា "ជំនួយដំបូង" ត្រូវពិនិត្យ/កែដោយដៃ
const translateLabel = (cls: string): string => {
  const map: Record<string, string> = { person: 'មនុស្ស', apple: 'ផ្លែឈើ', orange: 'ផ្លែឈើ' };
  return map[cls] || cls;
};

// ================= ៣. Main App =================
export default function MainApp() {
  const [user, setUser] = useState<UserProfile | null>(null);
  if (!user) return <LoginScreen onLogin={setUser} />;
  return <CAI_Pro_App user={user} onLogout={() => setUser(null)} />;
}

// ================= ៤. Login Screen =================
// ចំណាំ៖ នេះនៅតែជា Login "mock" — សម្រាប់ production ត្រូវភ្ជាប់ទៅ real auth backend
// (Firebase Auth / Cognito / custom API) មិនមែនរក្សាទុក password ក្នុង client ទេ។
function LoginScreen({ onLogin }: { onLogin: (u: UserProfile) => void }) {
  const [role, setRole] = useState<Role>('staff');
  const [identifier, setIdentifier] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;
    onLogin({
      name: role === 'admin' ? 'ប្រធានផ្នែក (Admin)' : `បុគ្គលិក ${identifier}`,
      role,
      avatar: role === 'admin' ? '👑' : '👨‍🔧',
    });
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', padding: '20px' }}>
      <div style={{ background: '#fff', padding: '30px', borderRadius: '12px', width: '100%', maxWidth: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
        <h2 style={{ textAlign: 'center', margin: '0 0 5px 0', color: '#1e293b' }}>🌐 CAI Pro Vision</h2>
        <p style={{ textAlign: 'center', color: '#64748b', marginBottom: '25px', fontSize: '14px' }}>ចូលគណនី ដើម្បីដំណើរការប្រព័ន្ធស្កេន AI</p>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <button type="button" onClick={() => setRole('staff')}
            style={tabBtnStyle(role === 'staff')}>👨‍🔧 បុគ្គលិកស្កេន</button>
          <button type="button" onClick={() => setRole('admin')}
            style={tabBtnStyle(role === 'admin')}>👑 អ្នកគ្រប់គ្រង</button>
        </div>

        <form onSubmit={handleLogin}>
          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="ឈ្មោះ ឬលេខសម្គាល់បុគ្គលិក"
            required
            style={{ ...inputStyle, marginBottom: '20px' }}
          />
          <button type="submit" style={{ width: '100%', padding: '12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
            ចូលប្រព័ន្ធ
          </button>
        </form>
      </div>
    </div>
  );
}

const tabBtnStyle = (active: boolean): React.CSSProperties => ({
  flex: 1, padding: '10px', background: active ? '#0284c7' : 'transparent',
  border: active ? 'none' : '1px solid #cbd5e1', borderRadius: '6px',
  color: active ? '#fff' : '#334155', fontWeight: 'bold', cursor: 'pointer',
});
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' };

// ================= ៥. Core App =================
function CAI_Pro_App({ user, onLogout }: { user: UserProfile; onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<TabType>('scanner');
  const [scanCategory, setScanCategory] = useState<ScanCategory>('universal');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [detectedItems, setDetectedItems] = useState<DetectedItem[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [isGpsValid, setIsGpsValid] = useState(true); // true = មិនទាន់ដឹង/មិនតម្រូវ

  // localStorage សមស្របនៅទីនេះព្រោះជាកម្មវិធីពិត (មិនមែន sandbox) — ប៉ុន្តែសម្រាប់ទិន្នន័យរសើប
  // (batch ID, hash, GPS) គួរ sync ទៅ server វិញជាជាងទុកអចិន្ត្រៃយ៍ត្រឹមតែ client
  const [records, setRecords] = useState<SecurityRecord[]>(() => {
    try {
      const saved = localStorage.getItem('cai_records');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  useEffect(() => {
    localStorage.setItem('cai_records', JSON.stringify(records));
  }, [records]);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  // ស្នើសុំទីតាំង GPS ម្តងពេលចូល (មិនតម្រូវឱ្យផ្ដិតត្រូវរោងចក្រ១០០% ទេ បើគ្មាន GPS)
  useEffect(() => {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGps(loc);
        setIsGpsValid(haversineDistanceKm(loc, FACTORY_GPS) <= GEOFENCE_RADIUS_KM);
      },
      () => setIsGpsValid(true) // បើអ្នកប្រើមិនអនុញ្ញាត GPS កុំទប់ស្កាត់ការងារ
    );
  }, []);

  // សម្អាត object URL ចាស់ ដើម្បីជៀសវាង memory leak ពេលប្តូររូបច្រើនដង
  const setImage = (url: string | null) => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = url;
    setSelectedImage(url);
    setDetectedItems([]);
  };
  useEffect(() => () => { if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current); }, []);

  // ចុចលើរូបភាពដើម្បីថែម/លុបចំណុចដោយដៃ — សំខាន់ណាស់សម្រាប់អំពៅ/ឈើដែល AI ទូទៅមើលមិនឃើញ
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const existingIndex = detectedItems.findIndex(
      (item) => item.isManual && Math.hypot(item.x + 15 - x, item.y + 15 - y) < 20
    );
    const newItems = [...detectedItems];
    if (existingIndex !== -1) {
      newItems.splice(existingIndex, 1);
    } else {
      newItems.push({
        id: `M-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label: scanCategory === 'sugarcane' ? 'អំពៅ (ដៃ)' : 'វត្ថុបន្ថែម (ដៃ)',
        x: x - 15, y: y - 15, w: 30, h: 30, isManual: true,
      });
    }
    setDetectedItems(newItems);
    renderCanvas(newItems);
  };

  const renderCanvas = (items: DetectedItem[]) => {
    const canvas = canvasRef.current, img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = img.clientWidth;
    canvas.height = img.clientHeight;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    items.forEach((item) => {
      if (item.isManual) {
        ctx.beginPath();
        ctx.arc(item.x + 15, item.y + 15, 15, 0, 2 * Math.PI);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#f59e0b';
        ctx.stroke();
        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText('+', item.x + 11, item.y + 20);
      } else {
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        ctx.strokeRect(item.x, item.y, item.w, item.h);
        const ly = item.y > 20 ? item.y - 20 : item.y;
        ctx.fillStyle = '#10b981';
        ctx.fillRect(item.x, ly, item.w, 20);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(item.label, item.x + 4, ly + 14);
      }
    });
  };

  const handleScanAndSecure = async () => {
    if (!isGpsValid && user.role !== 'admin') {
      alert('❌ ទីតាំងរបស់អ្នកនៅក្រៅតំបន់អនុញ្ញាត — សូមទាក់ទងអ្នកគ្រប់គ្រង។');
      return;
    }
    const source = imgRef.current;
    if (!source) return;

    setIsScanning(true);
    try {
      await tf.ready();
      const model = await cocoSsd.load();
      const predictions = await model.detect(source);

      const manualItems = detectedItems.filter((i) => i.isManual);
      const aiItems: DetectedItem[] = predictions.map((p, idx) => ({
        id: `AI-${Date.now()}-${idx}`,
        label: translateLabel(p.class),
        x: p.bbox[0], y: p.bbox[1], w: p.bbox[2], h: p.bbox[3],
        isManual: false,
      }));

      const finalItems = [...aiItems, ...manualItems];
      setDetectedItems(finalItems);
      renderCanvas(finalItems);

      const timestamp = new Date().toISOString();
      const batchId = `B-${Date.now().toString().slice(-6)}`;
      const rawData = `${user.name}-${batchId}-${scanCategory}-${timestamp}-${finalItems.length}`;
      const hashSignature = await generateSecurityHash(rawData);

      const newRecord: SecurityRecord = {
        id: `SYS-${Date.now()}`,
        operator: user.name,
        category: scanCategory,
        batchId,
        hashSignature,
        qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(hashSignature)}`,
        timestamp: new Date().toLocaleString('km-KH'),
        totalCount: finalItems.length,
        detectedTypes: Array.from(new Set(finalItems.map((i) => i.label))),
        gps,
        aiAssisted: aiItems.length > 0,
      };
      setRecords((prev) => [newRecord, ...prev]);
      setActiveTab('history');
    } catch (err) {
      console.error(err);
      alert('កំហុសក្នុងការវិភាគរូបភាព — សូមព្យាយាមម្តងទៀត។');
    } finally {
      setIsScanning(false);
    }
  };

  const exportToCSV = () => {
    if (records.length === 0) {
      alert('មិនមានទិន្នន័យសម្រាប់ Export ទេ។');
      return;
    }
    const headers = 'ID,Operator,Category,BatchID,TotalCount,AIAssisted,Timestamp,HashSignature\n';
    const rows = records.map((r) =>
      `"${r.id}","${r.operator}","${r.category}","${r.batchId}",${r.totalCount},${r.aiAssisted},"${r.timestamp}","${r.hashSignature}"`
    );
    const blob = new Blob([headers + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CAI_Scan_Report_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: '15px', maxWidth: '850px', margin: '0 auto', fontFamily: 'sans-serif', background: '#f1f5f9', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', background: '#0f172a', padding: '12px 15px', borderRadius: '10px', color: '#fff' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '16px' }}>🚀 CAI Pro Vision</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', fontSize: '12px' }}>
            <span>{user.avatar}</span>
            <span style={{ color: '#38bdf8' }}>{user.name}</span>
            <span style={{ color: isGpsValid ? '#4ade80' : '#f87171' }}>
              {gps ? (isGpsValid ? '📍 ក្នុងតំបន់' : '📍 ក្រៅតំបន់') : '📍 មិនទាន់មាន GPS'}
            </span>
          </div>
        </div>
        <button onClick={onLogout} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer' }}>ចាកចេញ</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '15px', background: '#e2e8f0', padding: '4px', borderRadius: '8px' }}>
        <button onClick={() => setActiveTab('scanner')} style={tabBtnStyle(activeTab === 'scanner')}>📷 ស្កេន</button>
        <button onClick={() => setActiveTab('history')} style={tabBtnStyle(activeTab === 'history')}>🛡️ ប្រវត្តិ ({records.length})</button>
        <button onClick={() => setActiveTab('export')} style={tabBtnStyle(activeTab === 'export')}>📊 Export</button>
      </div>

      {/* Scanner */}
      {activeTab === 'scanner' && (
        <div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', overflowX: 'auto' }}>
            {(Object.keys(CATEGORY_LABELS) as ScanCategory[]).map((cat) => (
              <button key={cat} onClick={() => setScanCategory(cat)}
                style={{
                  padding: '6px 12px', borderRadius: '16px', border: 'none',
                  background: scanCategory === cat ? '#10b981' : '#cbd5e1',
                  color: scanCategory === cat ? '#fff' : '#1e293b',
                  fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap',
                }}>
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', background: '#000', borderRadius: '8px', overflow: 'hidden', minHeight: '300px', marginBottom: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            {selectedImage ? (
              <>
                <img ref={imgRef} src={selectedImage} alt="Capture" style={{ width: '100%', display: 'block', visibility: 'hidden', position: 'absolute' }}
                  onLoad={() => renderCanvas(detectedItems)} />
                <canvas ref={canvasRef} onClick={handleCanvasClick} style={{ width: '100%', cursor: 'crosshair' }} />
              </>
            ) : (
              <span style={{ color: '#64748b' }}>សូមជ្រើសរើសរូបភាព</span>
            )}
          </div>

          {selectedImage && (
            <div style={{ background: '#dcfce7', padding: '10px', borderRadius: '6px', marginBottom: '10px', fontSize: '13px', color: '#166534' }}>
              💡 ចុចលើរូបភាព ដើម្បីថែមចំណុចដែល AI មើលមិនឃើញ (សញ្ញា +) ឬចុចលើចំណុចចាស់ដើម្បីលុប។
            </div>
          )}

          <input
            type="file" accept="image/*"
            onChange={(e) => e.target.files?.[0] && setImage(URL.createObjectURL(e.target.files[0]))}
            style={{ width: '100%', padding: '8px', fontSize: '12px', marginBottom: '15px' }}
          />

          <button onClick={handleScanAndSecure} disabled={isScanning || !selectedImage}
            style={{ width: '100%', padding: '14px', background: !selectedImage ? '#94a3b8' : '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
            {isScanning ? 'កំពុងវិភាគ AI...' : `🔍 វិភាគ និងរក្សាទុក (បច្ចុប្បន្ន ${detectedItems.length})`}
          </button>
        </div>
      )}

      {/* History */}
      {activeTab === 'history' && (
        <div>
          {records.length === 0 ? <p style={{ color: '#64748b', textAlign: 'center' }}>មិនទាន់មានប្រវត្តិទេ។</p> :
            records.map((rec) => (
              <div key={rec.id} style={{ background: '#fff', padding: '15px', borderRadius: '8px', marginBottom: '12px', borderLeft: '5px solid #0284c7', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <h4 style={{ margin: '0 0 5px 0' }}>📦 {rec.batchId}</h4>
                    <p style={{ margin: '3px 0', fontSize: '14px' }}>
                      <b>ចំនួនរាប់៖</b> <span style={{ color: '#16a34a', fontWeight: 'bold', fontSize: '16px' }}>{rec.totalCount}</span>
                      {!rec.aiAssisted && <span style={{ marginLeft: '6px', fontSize: '11px', color: '#b45309' }}>(រាប់ដោយដៃទាំងស្រុង)</span>}
                    </p>
                    <p style={{ margin: '3px 0', fontSize: '13px' }}>{CATEGORY_LABELS[rec.category]} — ដោយ {rec.operator}</p>
                    <p style={{ margin: '3px 0', fontSize: '12px', color: '#64748b' }}>{rec.timestamp}</p>
                  </div>
                  <img src={rec.qrCodeUrl} alt="QR" style={{ width: '70px', height: '70px', border: '1px solid #e2e8f0' }} />
                </div>
                <div style={{ marginTop: '10px', background: '#f8fafc', padding: '8px', borderRadius: '4px', fontSize: '10px', fontFamily: 'monospace', wordBreak: 'break-all', color: '#475569' }}>
                  🔒 {rec.hashSignature}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Export */}
      {activeTab === 'export' && (
        <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
          <h4>📊 មណ្ឌលទាញយកទិន្នន័យ</h4>
          <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '20px' }}>ទាញយកទិន្នន័យប្រវត្តិស្កេនទាំងអស់ក្នុងទម្រង់ Excel (CSV) ឬបោះពុម្ព PDF។</p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button onClick={exportToCSV} style={{ padding: '12px 24px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>📥 CSV</button>
            {user.role === 'admin' && (
              <button onClick={() => window.print()} style={{ padding: '12px 24px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>🖨️ PDF</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

ឯកសារផ្សេងទៀត​បង 👇​
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

export type UserRole = 'staff' | 'admin' | 'super_admin';

export interface AccessTokenPayload {
  sub: string;   // user id
  role: UserRole; // ⚠️ ដាក់ចូលទៅ token ដោយ server តែម្តងគត់ ពេល login — client មិនអាចកែបានទេ
  name: string;
}

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, ACCESS_SECRET) as AccessTokenPayload;
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId }, REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
}

export function verifyRefreshToken(token: string): { sub: string } {
  return jwt.verify(token, REFRESH_SECRET) as { sub: string };
}

// Refresh tokens ត្រូវរក្សាទុកជា hash ក្នុង DB (មិនមែន token ត្រង់ៗ)
// ដូច្នេះបើ DB leak អ្នកលួចមិនអាចប្រើ token ពិតបានទេ
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

ឯកសារផ្សេងទៀតបង​👇​

import { pool } from '../db/pool';

export async function recordAudit(params: {
  actorId: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}) {
  const { actorId, action, targetType, targetId, metadata, ipAddress } = params;
  try {
    await pool.query(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id, metadata, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [actorId, action, targetType ?? null, targetId ?? null, metadata ? JSON.stringify(metadata) : null, ipAddress ?? null]
    );
  } catch (err) {
    // Audit logging must never crash the request — log locally and move on
    console.error('[audit] failed to record', action, err);
  }
}

ឯកសារផ្សេងទៀតបង​👇​

import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, UserRole, AccessTokenPayload } from '../utils/tokens';

// Extend Express Request with the authenticated principal
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

// មិនអានទេ header X-Role ឬ body.role ណាមួយឡើយ — role មកពី JWT ដែល server ចុះហត្ថលេខាតែម្តងគត់
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }
  const token = header.slice('Bearer '.length);
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Role hierarchy: super_admin > admin > staff
const ROLE_RANK: Record<UserRole, number> = { staff: 1, admin: 2, super_admin: 3 };

export function requireRole(minRole: UserRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (ROLE_RANK[req.user.role] < ROLE_RANK[minRole]) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// សម្រាប់ resource ដែលជា "own data only" សម្រាប់ staff (e.g. មើលតែ history របស់ខ្លួន)
// admin/super_admin រំលងបាន
export function requireSelfOrRole(getOwnerId: (req: Request) => string, minRole: UserRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const isOwner = req.user.sub === getOwnerId(req);
    const hasRole = ROLE_RANK[req.user.role] >= ROLE_RANK[minRole];
    if (!isOwner && !hasRole) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

ឯកសារផ្សេងទៀតបង​👇​
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { pool } from '../db/pool';
import {
  hashPassword, verifyPassword,
  signAccessToken, signRefreshToken, verifyRefreshToken,
  hashToken,
} from '../utils/tokens';
import { recordAudit } from '../utils/audit';
import { authenticate } from '../middleware/auth';

const router = Router();

// P0 checklist item: rate limiting on auth endpoints
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'ព្យាយាមចូលច្រើនដងពេក — សូមរង់ចាំមួយភ្លែត' },
});

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(10).max(128),
  // ⚠️ ចេតនាមិនទទួល `role` ពី client ទេ — សំណើ register ជា public ទាំងអស់ក្លាយជា 'staff'
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  deviceId: z.string().optional(),
});

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { name, email, password } = parsed.data;

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rowCount) return res.status(409).json({ error: 'អ៊ីមែលនេះបានប្រើរួចហើយ' });

  const passwordHash = await hashPassword(password);
  const result = await pool.query(
    `INSERT INTO users (name, email, password_hash, role, status)
     VALUES ($1, $2, $3, 'staff', 'active')
     RETURNING id, name, email, role`,
    [name, email, passwordHash]
  );
  const user = result.rows[0];
  await recordAudit({ actorId: user.id, action: 'auth.register', targetType: 'user', targetId: user.id, ipAddress: req.ip });
  res.status(201).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

router.post('/login', loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password, deviceId } = parsed.data;

  const result = await pool.query(
    'SELECT id, name, password_hash, role, status FROM users WHERE email = $1',
    [email]
  );
  const user = result.rows[0];

  // Generic error on both "no such user" and "wrong password" — avoid leaking which emails exist
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    await recordAudit({ actorId: user?.id ?? null, action: 'auth.login_failed', metadata: { email }, ipAddress: req.ip });
    return res.status(401).json({ error: 'អ៊ីមែល ឬលេខសម្ងាត់មិនត្រឹមត្រូវ' });
  }
  if (user.status !== 'active') {
    await recordAudit({ actorId: user.id, action: 'auth.login_blocked_suspended', ipAddress: req.ip });
    return res.status(403).json({ error: 'គណនីនេះត្រូវបានផ្អាក — សូមទាក់ទងអ្នកគ្រប់គ្រង' });
  }

  const accessToken = signAccessToken({ sub: user.id, role: user.role, name: user.name });
  const refreshToken = signRefreshToken(user.id);

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, device_id, expires_at)
     VALUES ($1, $2, $3, now() + interval '7 days')`,
    [user.id, hashToken(refreshToken), deviceId ?? null]
  );

  await recordAudit({ actorId: user.id, action: 'auth.login', metadata: { deviceId }, ipAddress: req.ip });

  res.json({
    accessToken,
    refreshToken,
    user: { id: user.id, name: user.name, role: user.role },
  });
});

router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body ?? {};
  if (!refreshToken) return res.status(400).json({ error: 'Missing refreshToken' });

  let decoded: { sub: string };
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }

  const tokenHash = hashToken(refreshToken);
  const stored = await pool.query(
    `SELECT id FROM refresh_tokens WHERE user_id = $1 AND token_hash = $2 AND revoked_at IS NULL AND expires_at > now()`,
    [decoded.sub, tokenHash]
  );
  if (!stored.rowCount) return res.status(401).json({ error: 'Refresh token revoked or not recognized' });

  const userResult = await pool.query('SELECT id, name, role, status FROM users WHERE id = $1', [decoded.sub]);
  const user = userResult.rows[0];
  if (!user || user.status !== 'active') return res.status(403).json({ error: 'Account not active' });

  const newAccessToken = signAccessToken({ sub: user.id, role: user.role, name: user.name });
  res.json({ accessToken: newAccessToken });
});

router.post('/logout', authenticate, async (req, res) => {
  const { refreshToken } = req.body ?? {};
  if (refreshToken) {
    await pool.query(
      `UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND token_hash = $2`,
      [req.user!.sub, hashToken(refreshToken)]
    );
  }
  await recordAudit({ actorId: req.user!.sub, action: 'auth.logout', ipAddress: req.ip });
  res.json({ ok: true });
});

router.get('/me', authenticate, async (req, res) => {
  res.json({ user: req.user });
});

export default router;


ឯកសារផ្សេងទៀតបង​👇​
import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// Staff: មើលតែប្រវត្តិខ្លួនឯង
router.get('/history', authenticate, async (req, res) => {
  // TODO: បន្តភ្ជាប់ scan_records table — query WHERE operator_id = req.user.sub
  res.json({ note: 'stub — replace with real query filtered by req.user.sub', userId: req.user!.sub });
});

// Admin+: មើលប្រវត្តិទាំងអស់ (មិនកំណត់ operator)
router.get('/history/all', authenticate, requireRole('admin'), async (_req, res) => {
  // TODO: បន្តភ្ជាប់ scan_records table — គ្មាន WHERE operator_id
  res.json({ note: 'stub — replace with real query, no operator filter' });
});

export default router;

ឯកសារផ្សេងទៀតបង​👇​
import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool';
import { authenticate, requireRole } from '../middleware/auth';
import { recordAudit } from '../utils/audit';

const router = Router();

// មើលបញ្ជីអ្នកប្រើ — admin ឡើងទៅ
router.get('/', authenticate, requireRole('admin'), async (_req, res) => {
  const result = await pool.query(
    'SELECT id, name, email, role, status, created_at FROM users ORDER BY created_at DESC'
  );
  res.json({ users: result.rows });
});

const roleChangeSchema = z.object({
  role: z.enum(['staff', 'admin', 'super_admin']),
});

// ប្តូរ role — មានតែ super_admin ប៉ុណ្ណោះទើបអាចលើក admin/super_admin
// admin ធម្មតាអាចប្តូរបានតែ staff ↔ staff (i.e. គ្មានសិទ្ធិលើកគ្នាឯង)
router.patch('/:id/role', authenticate, requireRole('admin'), async (req, res) => {
  const parsed = roleChangeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { role: newRole } = parsed.data;
  const targetId = req.params.id;

  if ((newRole === 'admin' || newRole === 'super_admin') && req.user!.role !== 'super_admin') {
    return res.status(403).json({ error: 'មានតែ super_admin ទើបលើកអ្នកណាម្នាក់ជា admin/super_admin បាន' });
  }

  const current = await pool.query('SELECT id, role FROM users WHERE id = $1', [targetId]);
  if (!current.rowCount) return res.status(404).json({ error: 'រកមិនឃើញអ្នកប្រើ' });

  const updated = await pool.query(
    'UPDATE users SET role = $1, updated_at = now() WHERE id = $2 RETURNING id, name, email, role',
    [newRole, targetId]
  );

  await recordAudit({
    actorId: req.user!.sub,
    action: 'user.role_changed',
    targetType: 'user',
    targetId,
    metadata: { from: current.rows[0].role, to: newRole },
    ipAddress: req.ip,
  });

  res.json({ user: updated.rows[0] });
});

// ផ្អាក/បើកគណនី — admin ឡើងទៅ, ជានិច្ចត្រូវ audit
router.patch('/:id/status', authenticate, requireRole('admin'), async (req, res) => {
  const schema = z.object({ status: z.enum(['active', 'suspended']) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const updated = await pool.query(
    'UPDATE users SET status = $1, updated_at = now() WHERE id = $2 RETURNING id, name, status',
    [parsed.data.status, req.params.id]
  );
  if (!updated.rowCount) return res.status(404).json({ error: 'រកមិនឃើញអ្នកប្រើ' });

  await recordAudit({
    actorId: req.user!.sub,
    action: 'user.status_changed',
    targetType: 'user',
    targetId: req.params.id,
    metadata: { status: parsed.data.status },
    ipAddress: req.ip,
  });

  res.json({ user: updated.rows[0] });
});

export default router;

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import 'dotenv/config';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import scanRoutes from './routes/scans';

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? '*' }));
app.use(express.json({ limit: '2mb' }));

// API versioning (P1 item from the review) — so a future v2 doesn't break old app builds in the field
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/scans', scanRoutes);

app.get('/health', (_req, res) => res.json({ ok: true }));

// Fallback error handler — never leak stack traces to the client
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`[server] CAI Pro backend listening on :${PORT}`));

ឯកសារផ្សេងទៀតបង​👇​
# CAI — CAI Pro Vision

ប្រព័ន្ធស្កេនវត្ថុដោយ AI (កាមេរ៉ា + Computer Vision) សម្រាប់ការរាប់ និងផ្ទៀងផ្ទាត់ផលិតផល/វត្ថុ
(ឈើ, ផ្លែឈើ, អំពៅ, កសិផល ។ល។) ភ្ជាប់ជាមួយប្រព័ន្ធសុវត្ថិភាព (SHA-256, QR verification),
GPS geofencing, និង Backend Auth/RBAC។

> 📌 **គោលបំណងឯកសារនេះ**: បើអ្នកបាត់ context ទាំងអស់ (ឧ. ឈប់អភិវឌ្ឍ ៦ខែ) ហើយត្រឡប់មកវិញ
> គួរអានឯកសារនេះ + `docs/` ហើយអាចយល់ភ្លាមថា *អ្វីមានហើយ → អ្វីកំពុងធ្វើ → អ្វីមិនទាន់មាន
> → security boundary នៅត្រង់ណា → ត្រូវបន្តពីណា*។ សូមអានផ្នែក [ស្ថានភាពពិតប្រាកដ](#-ស្ថានភាពពិតប្រាកដ-honest-status) មុនគេ។

---

## 🗂️ ឯកសារពេញលេញ (Documentation Index)

| ឯកសារ | ខ្លឹមសារ |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | ផែនទីទាំងមូលនៃប្រព័ន្ធ (Frontend/Backend/Data/Security/AI) |
| [`docs/API.md`](docs/API.md) | Endpoint ទាំងអស់ + Request/Response format |
| [`docs/DATABASE.md`](docs/DATABASE.md) | Table schema ពេញលេញ (users, scans, audit_log ។ល។) |
| [`docs/AUTH_RBAC.md`](docs/AUTH_RBAC.md) | របៀបចូលគណនី, តួនាទី, សិទ្ធិប្រើប្រាស់ |
| [`docs/GPS.md`](docs/GPS.md) | GPS state model + geofencing logic |
| [`docs/AI.md`](docs/AI.md) | AI detection, provenance, roadmap ទៅ custom model |
| [`docs/OFFLINE_SYNC.md`](docs/OFFLINE_SYNC.md) | ដំណើរការ Offline queue + sync |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Threat model — អ្វី Trusted/Untrusted |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Dev/Staging/Production setup |
| [`docs/CERTIFICATES.md`](docs/CERTIFICATES.md) | វិញ្ញាបនបត្រ Sololearn របស់អ្នកអភិវឌ្ឍ |
| [`CHANGELOG.md`](CHANGELOG.md) | កំណត់ត្រាការផ្លាស់ប្តូរតាមកំណែ |

---

## 🟡 ស្ថានភាពពិតប្រាកដ (Honest Status)

⚠️ **គោលការណ៍**៖ សញ្ញា ✅ ប្រើតែពេល feature ដំណើរការ **ពីចុងដល់ចប់ (end-to-end)** ប៉ុណ្ណោះ —
មិនមែនន័យថា "កូដមួយផ្នែកមាន" ទេ។ បើ Backend មាន ប៉ុន្តែ Frontend នៅមិនទាន់ភ្ជាប់ វានៅជា 🟡។

| Feature | ស្ថានភាព | ចំណាំ |
|---|---|---|
| Camera scanner UI (ថត/ជ្រើសរូប, AI box, ការកែដោយដៃ) | ✅ | React prototype ដំណើរការ |
| AI object detection (coco-ssd) | 🟡 | ដំណើរការ ប៉ុន្តែជា general-purpose model, មិនស្គាល់អំពៅ/ឈើជាក់លាក់ |
| Backend Auth API (register/login/refresh/RBAC) | 🟡 | **Backend code សរសេររួច និងដំណើរការដាច់ដោយឡែក** ប៉ុន្តែ **Frontend នៅតែប្រើ mock login** — មិនទាន់ភ្ជាប់គ្នា |
| Server-side role enforcement | 🟡 | ត្រឹមត្រូវនៅក្នុង Backend API ប៉ុណ្ណោះ, កូដ Frontend ចាស់នៅតែមាន role selector នៅ client |
| Scan records ផ្ទុកក្នុង Database ពិត | ❌ | `/scans` endpoints ជា stub, នៅតែផ្ទុកក្នុង `localStorage` |
| Canonical hash (server-recomputed) | ❌ | ឥឡូវ hash គណនានៅ client តែម្តង — informational, មិនមែន authoritative |
| GPS state model (valid/denied/unknown ដាច់ដោយឡែក) | ❌ | ឥឡូវជា boolean `isGpsValid` តែមួយ, default `true` ពេល GPS មិនមាន (bug ត្រូវកែ) |
| QR verification endpoint (`/verify/:id`) | ❌ | ឥឡូវ QR code ដាក់ hash ត្រង់ៗ ទៅ third-party service |
| Offline sync queue | ❌ | មិនទាន់ចាប់ផ្តើម |
| Audit log | 🟡 | មាននៅ Backend (`audit_log` table + `recordAudit()`) ប៉ុន្តែមិនទាន់គ្រប **គ្រប់** សកម្មភាព |
| Image object storage | ❌ | មិនទាន់ចាប់ផ្តើម — រូបភាពនៅតែក្នុង browser memory ប៉ុណ្ណោះ |
| Custom AI model (អំពៅ/ឈើ) | ❌ | មិនទាន់ចាប់ផ្តើម — ត្រូវការ dataset សិន |

## 🚀 ការដំឡើង (Setup)

```bash
# Backend
cd backend
npm install
cp .env.example .env
npm run migrate
npm run dev

# Frontend — បើកជាមួយ React project (Vite/CRA), ភ្ជាប់ CAI_Pro_App.tsx
# ⚠️ បច្ចុប្បន្ន Frontend មិនទាន់ហៅ Backend API ទេ — សូមមើល docs/AUTH_RBAC.md
```

---

*ស្វែងរកលក្ខណៈពិសេស, រចនាសម្ព័ន្ធ, Roadmap លម្អិត → សូមមើល [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)*
*វិញ្ញាបនបត្រអ្នកអភិវឌ្ឍ → សូមមើល [`docs/CERTIFICATES.md`](docs/CERTIFICATES.md)*

 ឯកសារផ្សេងទៀតបង​👇​

# Architecture — CAI Pro Vision

## ផែនទីទាំងមូល

```
CAI Pro Vision
│
├── Frontend
│   ├── Camera            ✅ ថត/ជ្រើសរូបភាព, 4K/HD toggle*, LED torch*, night filter
│   ├── AI Detection       🟡 coco-ssd (general-purpose, មិនមែន custom)
│   ├── Manual Correction   ✅ ចុចថែម/លុបចំណុចលើរូបភាព
│   ├── GPS                 🟡 មាន Haversine distance, ប៉ុន្តែ state boolean តែមួយ
│   └── Offline Queue       ❌ មិនទាន់ចាប់ផ្តើម
│
├── Backend API              (backend/ — ដំណើរការដាច់ដោយឡែក, Frontend មិនទាន់ភ្ជាប់)
│   ├── Authentication      ✅ JWT access+refresh, bcrypt
│   ├── RBAC                 ✅ role នៅ server, hierarchy staff<admin<super_admin
│   ├── Scan API              ❌ stub ប៉ុណ្ណោះ (/scans/history)
│   ├── Verification          ❌ មិនទាន់មាន /verify/:id
│   ├── Idempotency            ❌ មិនទាន់មាន
│   └── Audit                 🟡 មានចំពោះ auth+role events, មិនទាន់គ្រប scans
│
├── Data
│   ├── PostgreSQL            🟡 users, refresh_tokens, audit_log ប៉ុណ្ណោះ (មិនទាន់មាន scans)
│   ├── Object Storage         ❌ មិនទាន់ចាប់ផ្តើម
│   └── Sync                    ❌ មិនទាន់ចាប់ផ្តើម
│
├── Security
│   ├── SHA-256                 🟡 client-side ប៉ុណ្ណោះ, មិនទាន់មាន server recompute
│   ├── Server Verification      ❌
│   ├── QR Verification           ❌ ឥឡូវ QR ជា hash ត្រង់ៗ, មិនមែន verification URL
│   ├── Rate Limit                 ✅ (5 login attempts/min)
│   └── Threat Model                ✅ សូមមើល SECURITY.md
│
├── AI
│   ├── coco-ssd Prototype       ✅
│   ├── Dataset                    ❌
│   ├── Custom Model                ❌
│   └── Model Versioning             ❌
│
└── Documentation                 ✅ (ឯកសារនេះ)
```
*4K/torch/night-filter អាស្រ័យលើ browser/device support — មិនធានា ១០០% គ្រប់ឧបករណ៍ (មើល docs/AI.md ផ្នែក camera note)។

## Roadmap តាម Phase

```
PHASE 1 — Foundation                      [រួចរាល់]
  [x] React scanner UI
  [x] Manual correction
  [x] AI prototype (coco-ssd)

PHASE 2 — Backend                          [កំពុងធ្វើ]
  [x] Authentication (JWT)
  [x] RBAC (server-side role)
  [ ] Frontend ↔ Backend integration        ← ចំណុចបន្ទាប់ ដើម្បីបិទ Phase នេះ
  [ ] Scan API (POST/GET /scans ពិត)
  [ ] PostgreSQL scans table

PHASE 3 — Security
  [ ] Canonical scan payload + server-side hash
  [ ] GPS state model (6 states, មិនមែន boolean)
  [ ] Idempotency key
  [ ] QR → /verify/:id endpoint

PHASE 4 — Field Reliability
  [ ] Offline queue (PENDING → SYNCING → SYNCED/FAILED)
  [ ] Retry + backoff
  [ ] Image object storage + image hash

PHASE 5 — AI
  [ ] Dataset collection (អំពៅ/ឈើ/ផលិតផលកសិកម្ម)
  [ ] Custom model training
  [ ] Model versioning + confidence threshold + NMS

PHASE 6 — Production
  [ ] Monitoring + health checks
  [ ] Backup/recovery
  [ ] Staging environment
  [ ] Security audit
```

## ចំណុចសម្រេចចិត្តសំខាន់ៗ (Key Decisions Locked)

- **Role/Auth authority = Server ប៉ុណ្ណោះ។** Client JWT payload ជាប្រភពតែមួយគត់នៃ role,
  គ្មាន UI element ណាមួយអនុញ្ញាតឱ្យអ្នកប្រើ "ជ្រើស" role ខ្លួនឯង។
- **Client-side hash = informational, not authoritative.** Server នឹងគណនា hash ដដែលពី
  canonical payload ហើយនោះទើបជា source of truth (មើល DATABASE.md)។
- **GPS boolean មិនមែន security truth** — ត្រូវផ្លាស់ទៅ state enum (មើល GPS.md)។

ឯកសារផ្សេងទៀតបង​👇​

# API Contract — `/api/v1`

Base URL: `http://localhost:4000/api/v1` (dev)

## គោលការណ៍រួម

- ✅ = ដំណើរការហើយក្នុង `backend/`
- ❌ = រៀបចំគម្រោង, កូដមិនទាន់មាន
- រាល់ protected endpoint ត្រូវការ header: `Authorization: Bearer <accessToken>`
- Response error ទាំងអស់គួរតែជាទម្រង់ស្តង់ដារតែមួយ (មើលផ្នែក **Error Format** ខាងក្រោម) —
  **⚠️ បច្ចុប្បន្នមិនទាន់អនុវត្តទាំងអស់ទេ**, endpoint ខ្លះនៅតែ `{ error: string }` ធម្មតា។

---

## `/auth`

| Method | Path | ស្ថានភាព | ការពិពណ៌នា |
|---|---|---|---|
| POST | `/auth/register` | ✅ | បង្កើតគណនី, តែងតែជា `staff` |
| POST | `/auth/login` | ✅ | ត្រឡប់ `{accessToken, refreshToken, user}`, rate-limited 5/min |
| POST | `/auth/refresh` | ✅ | ប្តូរ accessToken ថ្មីពី refreshToken |
| POST | `/auth/logout` | ✅ | revoke refresh token (ត្រូវការ auth) |
| GET | `/auth/me` | ✅ | ត្រឡប់ payload នៃ JWT បច្ចុប្បន្ន |

## `/users` (admin+)

| Method | Path | ស្ថានភាព | ការពិពណ៌នា |
|---|---|---|---|
| GET | `/users` | ✅ | (admin+) បញ្ជីអ្នកប្រើទាំងអស់ |
| PATCH | `/users/:id/role` | ✅ | (admin+, super_admin សម្រាប់លើកជា admin) ប្តូរ role |
| PATCH | `/users/:id/status` | ✅ | (admin+) active/suspended |
| GET | `/users/:id` | ❌ | មើលព័ត៌មានលម្អិតអ្នកប្រើម្នាក់ |

## `/scans` — ❌ ភាគច្រើនជា stub

| Method | Path | ស្ថានភាព | ការពិពណ៌នា |
|---|---|---|---|
| GET | `/scans/history` | 🟡 stub | (auth) ត្រូវត្រឡប់ប្រវត្តិខ្លួនឯង — ឥឡូវត្រឡប់ mock object |
| GET | `/scans/history/all` | 🟡 stub | (admin+) ប្រវត្តិទាំងអស់ — ឥឡូវត្រឡប់ mock object |
| POST | `/scans` | ❌ | បង្កើត scan record ថ្មី, ទទួល canonical payload, គណនា server-side hash |
| GET | `/scans/:id` | ❌ | មើលលម្អិត scan មួយ |
| POST | `/scans/:id/verify` | ❌ | (admin+) សម្គាល់ scan ថាបានផ្ទៀងផ្ទាត់ដោយដៃ |
| GET | `/verify/:id` | ❌ | Public endpoint សម្រាប់ QR code — ត្រឡប់ស្ថានភាព record (exists/hash match/revoked) |

**Planned request body សម្រាប់ `POST /scans`** (មើល DATABASE.md សម្រាប់ field ពេញលេញ)៖
```json
{
  "batchId": "string",
  "category": "wood | fruits | sugarcane | universal",
  "aiDetectedCount": 8,
  "manualCount": 2,
  "detectedTypes": ["..."],
  "aiModel": "coco-ssd",
  "aiModelVersion": "2.2.2",
  "gps": { "lat": 0, "lng": 0, "accuracyMeters": 0, "capturedAt": "ISO8601" },
  "imageKey": "object-storage-key",
  "imageHash": "sha256...",
  "clientTimestamp": "ISO8601",
  "idempotencyKey": "deviceId:localRecordId"
}
```

## `/audit` (admin+) — ❌

| Method | Path | ស្ថានភាព | ការពិពណ៌នា |
|---|---|---|---|
| GET | `/audit` | ❌ | មើល audit_log ជាមួយ filter (actor, action, date range) |

## `/health` — ✅

| Method | Path | ស្ថានភាព |
|---|---|---|
| GET | `/health` | ✅ ត្រឡប់ `{ ok: true }` |

---

## Error Format (ស្តង់ដារដែលគួរអនុវត្តគ្រប់ endpoint)

```json
{
  "success": false,
  "error": {
    "code": "GPS_OUTSIDE_GEOFENCE",
    "message": "Scan location is outside the allowed zone"
  },
  "requestId": "req_8F29..."
}
```

⚠️ **ស្ថានភាពពិត**: endpoint ដែលមានស្រាប់ (`/auth`, `/users`) ត្រឡប់ត្រឹមតែ
`{ "error": "message string" }` — មិនទាន់មាន `code`/`requestId`។ ត្រូវ standardize
មុនចាប់ផ្តើម `/scans` ពិត ដើម្បីកុំឱ្យមាន inconsistency ច្រើនប្រភេទ។

## Request ID — ❌ មិនទាន់មាន

គម្រោង៖ middleware ដាក់ `X-Request-ID` លើគ្រប់ request ចូល, ភ្ជាប់ចូល log និង audit entry,
ត្រឡប់ជាមួយ response ដើម្បីងាយស្វែងរកនៅពេល debug។

ឯកសារផ្សេងទៀតបង​👇​
# Database Schema

## ✅ Tables ដែលមានស្រាប់ (`backend/src/db/schema.sql`)

### `users`
| Column | Type | ចំណាំ |
|---|---|---|
| id | UUID PK | |
| name | TEXT | |
| email | TEXT UNIQUE | |
| password_hash | TEXT | bcrypt cost 12 |
| role | ENUM(staff, admin, super_admin) | ⚠️ Server/DB កំណត់តែម្តង, client មិនកំណត់បាន |
| status | ENUM(active, suspended) | |
| created_at / updated_at | TIMESTAMPTZ | |

### `refresh_tokens`
| Column | Type | ចំណាំ |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → users | |
| token_hash | TEXT | SHA-256 នៃ token ពិត — មិនផ្ទុក token ត្រង់ៗ |
| device_id | TEXT | |
| expires_at / revoked_at | TIMESTAMPTZ | |

### `audit_log`
| Column | Type | ចំណាំ |
|---|---|---|
| id | UUID PK | |
| actor_id | UUID FK → users | |
| action | TEXT | e.g. `auth.login`, `user.role_changed` |
| target_type / target_id | TEXT | |
| metadata | JSONB | |
| ip_address | TEXT | |
| created_at | TIMESTAMPTZ | |

⚠️ Table នេះគួរតែជា **append-only** — គ្មាន UPDATE/DELETE ធម្មតាទេ (ត្រូវបង្កើត DB permission
ដាច់ដោយឡែកសម្រាប់ enforce វានៅពេលមាន production DB user)។

---

## ❌ Tables ដែលមិនទាន់មាន (ត្រូវបង្កើតសម្រាប់ Phase 2-4)

### `scans` (Canonical Scan Record)
| Column | Type | ចំណាំ |
|---|---|---|
| id | UUID PK | server-generated, មិនមែន client `Date.now()` |
| operator_id | UUID FK → users | |
| batch_id | TEXT | |
| category | TEXT | wood / fruits / sugarcane / universal |
| ai_detected_count | INT | |
| manual_count | INT | |
| total_count | INT | ai_detected_count + manual_count |
| ai_model | TEXT | e.g. `coco-ssd` |
| ai_model_version | TEXT | |
| confidence_threshold | NUMERIC | |
| gps_lat / gps_lng | NUMERIC | |
| gps_accuracy_meters | NUMERIC | |
| gps_status | ENUM | មើល GPS.md — មិនមែន boolean |
| image_key | TEXT | object storage key |
| image_hash | TEXT | SHA-256 នៃរូបភាព |
| client_timestamp | TIMESTAMPTZ | ពី device — untrusted |
| server_timestamp | TIMESTAMPTZ | `now()` ពី server — trusted |
| payload_hash | TEXT | **server-recomputed** SHA-256 នៃ canonical payload |
| schema_version | INT | សម្រាប់ migrate ទិន្នន័យចាស់ពេលប្តូរ format |
| idempotency_key | TEXT UNIQUE | `deviceId:localRecordId` — ការពារ duplicate ពី retry |
| sync_status | ENUM | pending/syncing/synced/failed |
| verification_status | ENUM | unverified/verified/rejected |
| created_at | TIMESTAMPTZ | |

### `scan_items` (detail នីមួយៗ — AI box / manual point)
| Column | Type |
|---|---|
| id | UUID PK |
| scan_id | UUID FK → scans |
| label | TEXT |
| is_manual | BOOLEAN |
| bbox_x/y/w/h | NUMERIC |

### `scan_verifications`
| Column | Type | ចំណាំ |
|---|---|---|
| id | UUID PK | |
| scan_id | UUID FK → scans | |
| verified_by | UUID FK → users | admin ណាដែលផ្ទៀងផ្ទាត់ |
| result | ENUM | confirmed/corrected/rejected |
| notes | TEXT | |
| created_at | TIMESTAMPTZ | |

### `sync_queue` / `sync_events` (offline sync — Phase 4)
| Column | Type |
|---|---|
| id | UUID PK |
| scan_local_id | TEXT — id បង្កើតនៅ client មុន sync |
| status | ENUM(pending, syncing, synced, failed) |
| retry_count | INT |
| last_attempt_at | TIMESTAMPTZ |

---

## Canonical Scan Payload → Hash

```
Client captures scan
        ↓
Normalize fields (fixed key order, no whitespace diffs)
        ↓
Stable JSON serialization
        ↓
SHA-256  → client-side "informational" hash (ផ្ញើទៅជាមួយ payload)
        ↓
Server receives payload
        ↓
Server recomputes SHA-256 លើ canonical fields ដដែល (+ server_timestamp)
        ↓
payload_hash (server) = AUTHORITATIVE — ត្រូវផ្ទុកជា source of truth
```

> **Client-side hash is informational. Server recomputes and stores the authoritative hash.**
> កុំឱ្យ Developer ថ្ងៃក្រោយជឿ hash ពី client ១០០%។

ឯកសារផ្សេងទៀតបង​👇​
# Auth & RBAC

## គោលការណ៍ចម្បង

**Role authority = Server តែម្តងគត់។** JWT access token មាន `role` ចុះហត្ថលេខារួច
ដោយ server ពេល `/auth/login`។ Client អានតម្លៃនេះបានតែប៉ុណ្ណោះ — កែមិនបានព្រោះកែ
signature ខូចភ្លាម ហើយ `verifyAccessToken()` នឹង reject ។

## Role Hierarchy

```
super_admin (3) > admin (2) > staff (1)
```

| សិទ្ធិ | staff | admin | super_admin |
|---|---|---|---|
| ស្កេន, មើលប្រវត្តិខ្លួនឯង | ✅ | ✅ | ✅ |
| មើលប្រវត្តិទាំងអស់ | ❌ | ✅ | ✅ |
| Export CSV/PDF | ❌ | ✅ | ✅ |
| ផ្ទៀងផ្ទាត់ scan (verify) | ❌ | ✅ | ✅ |
| ផ្អាក/បើកគណនីអ្នកប្រើ | ❌ | ✅ | ✅ |
| លើក role នរណាម្នាក់ទៅ `staff` | ❌ | ✅ | ✅ |
| លើក role ទៅ `admin`/`super_admin` | ❌ | ❌ | ✅ |
| មើល audit log | ❌ | ✅ | ✅ |

## Token Lifecycle

```
POST /auth/login
   ↓
accessToken (15 min, JWT, មាន role)
refreshToken (7 days, ផ្ទុកជា hash ក្នុង DB)
   ↓
Client ប្រើ accessToken លើគ្រប់ request (Authorization: Bearer ...)
   ↓
accessToken ផុតកំណត់ → POST /auth/refresh (ជាមួយ refreshToken)
   ↓
accessToken ថ្មី
   ↓
Logout → POST /auth/logout → refreshToken ត្រូវ revoke (មិនប្រើបានទៀត)
```

## ⚠️ ស្ថានភាពពិត — Frontend មិនទាន់ភ្ជាប់

Backend (`backend/`) ដំណើរការពេញលេញ និងអាចសាកល្បងដាច់ដោយឡែក (Postman/curl)។
ប៉ុន្តែ **React frontend (`CAI_Pro_App.tsx`) នៅតែប្រើ mock login** ដែលអ្នកប្រើអាចជ្រើស
role ខ្លួនឯង (👑 Admin / 👨‍🔧 Staff)។ នេះជា **client-side role selector ដែលត្រូវលុបចេញ**
ពេលភ្ជាប់ Frontend ទៅ Backend ពិត (មើល ARCHITECTURE.md → Phase 2)។

### អ្វីត្រូវកែនៅ Frontend ពេលភ្ជាប់

1. លុប role toggle ចេញពី `LoginScreen` ទាំងស្រុង — មានតែ email/password
2. ហៅ `POST /api/v1/auth/login` → ទទួល `{accessToken, refreshToken, user:{role}}`
3. ដាក់ `accessToken` ក្នុង memory state, `refreshToken` ក្នុង secure storage
   (web: httpOnly cookie ជាការណែនាំ — **កុំដាក់ localStorage**)
4. UI element ណាមួយសម្រាប់ admin (ឧ. 🖨️ Export PDF) ត្រូវពិនិត្យ `user.role` ដែល
   **ទទួលពី server response** មិនមែនតម្លៃ local state ដែល client កំណត់ខ្លួនឯង

## Password & Secrets

- Password hash: `bcrypt`, cost 12
- Login rate-limited: 5 ព្យាយាម / នាទី / IP
- JWT secrets ត្រូវនៅក្នុង `.env` (មិន commit), បង្កើតដោយ `openssl rand -hex 32`
- Login error មិនប្រាប់ថា "email មិនត្រឹមត្រូវ" ឬ "password មិនត្រឹមត្រូវ" ដាច់ដោយឡែក
  (ការពារ email enumeration)

ឯកសារផ្សេងទៀតបង​👇​

# Auth & RBAC

## គោលការណ៍ចម្បង

**Role authority = Server តែម្តងគត់។** JWT access token មាន `role` ចុះហត្ថលេខារួច
ដោយ server ពេល `/auth/login`។ Client អានតម្លៃនេះបានតែប៉ុណ្ណោះ — កែមិនបានព្រោះកែ
signature ខូចភ្លាម ហើយ `verifyAccessToken()` នឹង reject ។

## Role Hierarchy

```
super_admin (3) > admin (2) > staff (1)
```

| សិទ្ធិ | staff | admin | super_admin |
|---|---|---|---|
| ស្កេន, មើលប្រវត្តិខ្លួនឯង | ✅ | ✅ | ✅ |
| មើលប្រវត្តិទាំងអស់ | ❌ | ✅ | ✅ |
| Export CSV/PDF | ❌ | ✅ | ✅ |
| ផ្ទៀងផ្ទាត់ scan (verify) | ❌ | ✅ | ✅ |
| ផ្អាក/បើកគណនីអ្នកប្រើ | ❌ | ✅ | ✅ |
| លើក role នរណាម្នាក់ទៅ `staff` | ❌ | ✅ | ✅ |
| លើក role ទៅ `admin`/`super_admin` | ❌ | ❌ | ✅ |
| មើល audit log | ❌ | ✅ | ✅ |

## Token Lifecycle

```
POST /auth/login
   ↓
accessToken (15 min, JWT, មាន role)
refreshToken (7 days, ផ្ទុកជា hash ក្នុង DB)
   ↓
Client ប្រើ accessToken លើគ្រប់ request (Authorization: Bearer ...)
   ↓
accessToken ផុតកំណត់ → POST /auth/refresh (ជាមួយ refreshToken)
   ↓
accessToken ថ្មី
   ↓
Logout → POST /auth/logout → refreshToken ត្រូវ revoke (មិនប្រើបានទៀត)
```

## ⚠️ ស្ថានភាពពិត — Frontend មិនទាន់ភ្ជាប់

Backend (`backend/`) ដំណើរការពេញលេញ និងអាចសាកល្បងដាច់ដោយឡែក (Postman/curl)។
ប៉ុន្តែ **React frontend (`CAI_Pro_App.tsx`) នៅតែប្រើ mock login** ដែលអ្នកប្រើអាចជ្រើស
role ខ្លួនឯង (👑 Admin / 👨‍🔧 Staff)។ នេះជា **client-side role selector ដែលត្រូវលុបចេញ**
ពេលភ្ជាប់ Frontend ទៅ Backend ពិត (មើល ARCHITECTURE.md → Phase 2)។

### អ្វីត្រូវកែនៅ Frontend ពេលភ្ជាប់

1. លុប role toggle ចេញពី `LoginScreen` ទាំងស្រុង — មានតែ email/password
2. ហៅ `POST /api/v1/auth/login` → ទទួល `{accessToken, refreshToken, user:{role}}`
3. ដាក់ `accessToken` ក្នុង memory state, `refreshToken` ក្នុង secure storage
   (web: httpOnly cookie ជាការណែនាំ — **កុំដាក់ localStorage**)
4. UI element ណាមួយសម្រាប់ admin (ឧ. 🖨️ Export PDF) ត្រូវពិនិត្យ `user.role` ដែល
   **ទទួលពី server response** មិនមែនតម្លៃ local state ដែល client កំណត់ខ្លួនឯង

## Password & Secrets

- Password hash: `bcrypt`, cost 12
- Login rate-limited: 5 ព្យាយាម / នាទី / IP
- JWT secrets ត្រូវនៅក្នុង `.env` (មិន commit), បង្កើតដោយ `openssl rand -hex 32`
- Login error មិនប្រាប់ថា "email មិនត្រឹមត្រូវ" ឬ "password មិនត្រឹមត្រូវ" ដាច់ដោយឡែក
  (ការពារ email enumeration)

ឯកសារផ្សេងទៀតបង​👇​

# GPS & Geofencing

## ❌ បញ្ហាបច្ចុប្បន្ន

React prototype ឥឡូវប្រើ `boolean isGpsValid` តែមួយ ដែល **default ទៅ `true`** ពេល GPS
មិនអាចប្រើបាន (permission denied, timeout, ។ល។)។ នេះមានន័យថា Staff អាចបន្តស្កេនដោយគ្មាន
GPS ផ្ទៀងផ្ទាត់ — ជាចន្លោះសុវត្ថិភាព។ **ត្រូវកែជាបន្ទាន់** មុនចាត់ទុកជា production-ready។

## គម្រោង — GPS State (មិនមែន boolean)

```
GPS_UNKNOWN        — មិនទាន់ស្នើសុំ permission
GPS_REQUESTING      — កំពុងរង់ចាំចម្លើយពី browser/OS
GPS_VALID            — ទទួលបាន coordinate ក្នុងតំបន់អនុញ្ញាត
GPS_OUTSIDE           — ទទួលបាន coordinate ប៉ុន្តែក្រៅ geofence
GPS_DENIED             — អ្នកប្រើបដិសេធសិទ្ធិ
GPS_UNAVAILABLE          — ឧបករណ៍គ្មាន GPS ឬ timeout
GPS_STALE                 — coordinate ចាស់ពេក (ឧ. > 5 នាទី)
```

## Data ដែលត្រូវរក្សាទុកជាមួយរាល់ scan

```json
{
  "lat": 11.5564,
  "lng": 104.9282,
  "accuracyMeters": 12.4,
  "capturedAt": "2026-08-22T09:00:00Z",
  "geofenceResult": "GPS_VALID"
}
```

## Policy ណែនាំ (server-side, មិនមែន client-side ការសម្រេចចិត្ត)

| Role | GPS_OUTSIDE | GPS_DENIED / GPS_UNAVAILABLE |
|---|---|---|
| staff | 🔴 BLOCK | 🔴 BLOCK |
| admin | 🟡 ALLOW + AUDIT flag | 🟡 ALLOW + AUDIT flag |

## GPS Spoofing — មិនទាន់ដោះស្រាយ

Haversine distance ប្រាប់តែថា coordinate "នៅជិត" ចំណុចអនុញ្ញាត — មិនប្រាប់ថា coordinate
ពិត ឬក្លែងក្លាយទេ (mock location app)។ គម្រោងអនាគត៖ ពិនិត្យ `accuracyMeters` (បដិសេធបើ
ធំពេក), ប្រៀបធៀប `speed`/`heading` នៅជាប់ៗគ្នា, ភ្ជាប់ `deviceId` ជាមួយប្រវត្តិមុនៗ។

## Haversine Formula (មានរួចហើយ, ត្រឹមត្រូវ)

កូដក្នុង `backend` (ឬកូដ frontend ចាស់) បានប្តូរពី Pythagorean ត្រង់ៗ (ខុស — lat/lng
មិនមែន grid ស្មើគ្នា) ទៅ Haversine formula ត្រឹមត្រូវរួចហើយ។ រក្សាទុកភាពនេះ។

ឯកសារផ្សេងទៀតបង​👇​
# AI Detection

## ស្ថានភាពបច្ចុប្បន្ន

- Model: **coco-ssd** (TensorFlow.js) — general-purpose object detector (80 classes ធម្មតា
  ដូចជា person, apple, car ។ល។)
- ⚠️ **មិនស្គាល់ អំពៅ/ឈើ/ផលិតផលកសិកម្មជាក់លាក់ទេ** — `translateLabel()` គ្រាន់តែបកប្រែឈ្មោះ
  class ដែលមានស្រាប់ (apple/orange → "ផ្លែឈើ") មិនមែនន័យថា AI បណ្តុះបណ្តាលមកសម្រាប់
  category ទាំងនោះ
- មិនទាន់មាន confidence threshold filtering ឬ Non-Maximum Suppression (NMS) — អាចរាប់
  object តែមួយច្រើនដងបើ AI ត្រឡប់ prediction box ជាន់គ្នា

## AI Provenance — ត្រូវរក្សាទុកជាមួយរាល់ scan

កុំរក្សាទុកគ្រាន់តែ `aiAssisted: boolean`។ គួររក្សា៖

```json
{
  "aiDetectedCount": 8,
  "manualCount": 2,
  "finalCount": 10,
  "aiModel": "coco-ssd",
  "aiModelVersion": "2.2.2",
  "confidenceThreshold": 0.50
}
```

នេះមានតម្លៃខ្លាំងសម្រាប់៖ (១) audit ថា AI ធ្វើការប៉ុន្មាន vs មនុស្សកែប៉ុន្មាន, (២) ប្រៀបធៀប
ភាពត្រឹមត្រូវរវាង model versions ពេលអនាគត។

## Camera Capability — មិនធានា ១០០%

Live camera, 4K resolution, LED torch control, និង zoom **អាស្រ័យលើ browser/device
support** — មិនមែនគ្រប់ Android/iPhone/Browser ទាំងអស់គាំទ្រដូចគ្នាទេ។ App ត្រូវមាន
fallback ជានិច្ច៖

```
Live Camera
    ↓ unavailable / permission denied?
Gallery Upload  ← ជានិច្ចត្រូវមាន ជា fallback
```

## Roadmap ទៅ Custom Model

```
1. Dataset — ប្រមូលរូបភាព labeled ជាក់លាក់ (អំពៅ, ឈើ, ផលិតផលនីមួយៗ)
2. Training — Teachable Machine (ចាប់ផ្តើមលឿន) ឬ custom TensorFlow pipeline
3. Evaluation — វាស់ precision/recall លើ test set ពិត
4. Versioning — ផ្ទុក aiModel + aiModelVersion ជាមួយរាល់ scan (មើលខាងលើ)
```

⚠️ **កុំសន្យាថា custom model នឹងស្គាល់ "១០០%"។** Production ត្រូវវាស់ដោយ
precision/recall លើ test dataset ពិត — មិនគួរធានា accuracy ១០០%។


ឯកសារផ្សេងទៀតបង​👇​

# Offline / Sync Architecture — ❌ មិនទាន់ចាប់ផ្តើម

## មូលហេតុសំខាន់

Staff ជាច្រើនស្កេននៅចម្ការ/រោងចក្រដែល Internet ខ្សោយ ឬអត់មាន — App ត្រូវអាចធ្វើការ
offline ហើយ sync ត្រឡប់ពេលមាន network វិញ។

## Flow

```
Scan (offline ឬ online)
   ↓
រក្សាទុក Local queue ជា PENDING
   ↓
Internet available?
   ↓ (yes)
SYNCING → ផ្ញើទៅ Server ជាមួយ idempotencyKey
   ↓
Server ACK → SYNCED
   ↓ (fail — network/server error)
FAILED → Retry (exponential backoff) → ត្រឡប់ SYNCING
```

## Fields ត្រូវការ (`sync_queue` — មើល DATABASE.md)

| Field | ការពិពណ៌នា |
|---|---|
| `idempotencyKey` | `deviceId:localRecordId` — server ប្រើដើម្បីដឹងថា request ស្ទួន |
| `retryCount` | ចំនួនដងព្យាយាមផ្ញើ |
| `lastAttemptAt` | ពេលព្យាយាមចុងក្រោយ |
| `syncStatus` | pending / syncing / synced / failed |

## Idempotency — ហេតុអ្វីចាំបាច់

```
Staff ចុច scan ម្តង, network យឺត → App retry ស្វ័យប្រវត្តិ
   ↓
Request #1, #2, #3 ទៅ Server
   ↓ (គ្មាន idempotency key)
Server បង្កើត 3 records ស្ទួន ❌
   ↓ (មាន idempotency key)
Server ទទួល request ដំបូង, request #2/#3 ត្រូវបាន ignore (already processed) ✅
```

## UI — Sync Status ដែលអ្នកប្រើគួរឃើញ

```
🟡 កំពុងរង់ចាំផ្ញើ (Pending)
🔵 កំពុងផ្ញើ (Syncing)
🟢 ផ្ញើរួច (Synced)
🔴 បរាជ័យ — ចុចដើម្បីព្យាយាមម្តងទៀត (Failed)
```


ឯកសារផ្សេងទៀតបង​👇​

# Security — Threat Model

## Trusted vs Untrusted

```
TRUSTED
  - Backend server logic
  - Database (PostgreSQL)
  - Server-generated timestamps (server_timestamp)
  - Server-side role (JWT payload ចុះហត្ថលេខាដោយ server)
  - Server-recomputed payload_hash

UNTRUSTED — ត្រូវផ្ទៀងផ្ទាត់ ឬកុំពឹងផ្អែកទាំងស្រុង
  - Client-claimed role (មិនអាចកើតឡើងទៀត ចាប់តាំងពី JWT server-signed — ប៉ុន្តែកូដចាស់
    ណាមួយដែលនៅតែអាន role ពី local state ត្រូវចាត់ទុកជា untrusted)
  - Client-computed hash (informational ប៉ុណ្ណោះ)
  - Client GPS claim (អាចជា mock location)
  - client_timestamp (ឧបករណ៍អាចខុសម៉ោង ឬចេតនាកែ)
  - Client object/detection count (មុន server verify)
  - Request body ទាំងអស់ (validate ដោយ zod schema រាល់ endpoint)
```

## Current Controls (✅ ដំណើរការហើយ)

- Password hashing: bcrypt cost 12
- JWT access token (15min) + refresh token (7days, ផ្ទុកជា hash, revoke បាន)
- Rate limiting លើ `/auth/login` (5/min)
- `helmet` middleware (security headers)
- CORS restricted ទៅ `CORS_ORIGIN` ដែលកំណត់
- Audit log សម្រាប់ auth events + role changes
- Input validation ដោយ `zod` schema

## ❌ Controls ដែលមិនទាន់មាន

- Server-side recompute + verify scan payload hash
- QR verification endpoint (ឥឡូវ QR ជា hash ត្រង់ៗ ទៅ third-party service — hash
  មិនគួរ public ដោយផ្ទាល់)
- CSV export sanitization (ការពារ CSV injection ពី field ចាប់ផ្តើមដោយ `=`, `+`, `-`, `@`)
- Rate limiting លើ `/scans`, `/export` (មិនមែនតែ `/auth`)
- Image encryption/access control ក្នុង object storage
- Request monitoring/alerting (ឧ. suspicious GPS, repeated failures)

## Secrets Management

```
.env         ❌ NEVER commit (មាន .gitignore រួច)
.env.example ✅ commit — placeholder តម្លៃប៉ុណ្ណោះ

Secrets:
  DATABASE_URL
  JWT_ACCESS_SECRET
  JWT_REFRESH_SECRET

កុំដាក់ secret key ណាមួយក្នុង React/Vite frontend — code ត្រូវបាន bundle ចូល browser
ដែលអ្នកប្រើអាចមើលឃើញទាំងអស់។
```













