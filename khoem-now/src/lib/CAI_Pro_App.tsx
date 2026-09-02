
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
