import { useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { getGetCurrentUserQueryKey, getGetDashboardSummaryQueryKey, getHealthCheckQueryKey, getListScansQueryKey, setAuthTokenGetter, useCreateScan, useGetCurrentUser, useGetDashboardSummary, useHealthCheck, useListScans, useLogin } from '@workspace/api-client-react';
import type { Scan, ScanInput, User } from '@workspace/api-client-react';
import { Activity, ArrowRight, BarChart3, Bell, Check, ChevronDown, CircleHelp, ClipboardCheck, Clock3, Cloud, Download, FileCheck2, FileImage, Fingerprint, Gauge, Globe2, History, LayoutDashboard, Loader2, LockKeyhole, LogOut, MapPin, Menu, PackageSearch, RefreshCw, ScanLine, Search, Settings2, ShieldCheck, SlidersHorizontal, Sparkles, UploadCloud, UserRound, UsersRound, Wifi, X, Zap } from 'lucide-react';
import { Link, Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import type { ReactNode } from 'react';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

const queryClient = new QueryClient();
setAuthTokenGetter(() => localStorage.getItem('cai_session'));
const categories = [
  { value: 'universal', kh: 'ទូទៅ', en: 'Universal', tint: 'teal' },
  { value: 'wood', kh: 'ឈើ', en: 'Wood', tint: 'orange' },
  { value: 'fruits', kh: 'ផ្លែឈើ', en: 'Fruits', tint: 'coral' },
  { value: 'sugarcane', kh: 'អំពៅ', en: 'Sugarcane', tint: 'olive' },
] as const;

function formatDate(value?: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}
function shortHash(hash?: string) { return hash ? `${hash.slice(0, 10)}…${hash.slice(-8)}` : 'Pending verification'; }
function initials(name?: string) { return (name || 'CAI').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(); }

function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={`flex items-center gap-3 ${compact ? '' : 'px-1'}`}>
    <div className="relative grid h-10 w-10 place-items-center rounded-xl bg-secondary text-secondary-foreground shadow-[0_5px_0_hsl(39_76%_42%)]">
      <ScanLine size={21} strokeWidth={2.5} />
      <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-sidebar" />
    </div>
    <div className="leading-none">
      <div className="text-[15px] font-extrabold tracking-[.18em] text-sidebar-foreground">CAI PRO</div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-[.24em] text-sidebar-foreground/55">Vision / field ops</div>
    </div>
  </div>;
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted ${className}`} />;
}

function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'warm' | 'coral' }) {
  const styles = { neutral: 'bg-muted text-muted-foreground', good: 'bg-primary/10 text-primary', warm: 'bg-secondary/20 text-foreground', coral: 'bg-accent/15 text-foreground' };
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${styles[tone]}`}>{children}</span>;
}

function Sidebar({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [location] = useLocation();
  const items = [
    { href: '/', label: 'ស្កេនថ្មី', sub: 'New scan', icon: ScanLine },
    { href: '/dashboard', label: 'ផ្ទាំងគ្រប់គ្រង', sub: 'Dashboard', icon: LayoutDashboard },
    { href: '/scans', label: 'ប្រវត្តិស្កេន', sub: 'Scan history', icon: History },
    { href: '/settings', label: 'ការកំណត់', sub: 'Settings', icon: Settings2 },
  ];
  return <aside className="hidden min-h-[100dvh] w-[262px] shrink-0 flex-col bg-sidebar px-5 py-6 text-sidebar-foreground md:flex">
    <Brand />
    <div className="mt-12 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-sidebar-foreground/40">Operations</div>
    <nav className="mt-3 space-y-1" aria-label="Primary navigation">
      {items.map(({ href, label, sub, icon: Icon }) => {
        const active = href === '/' ? location === '/' : location.startsWith(href);
        return <Link key={href} href={href} data-testid={`link-nav-${sub.toLowerCase().replace(' ', '-')}`} className={`group flex items-center gap-3 rounded-xl px-3 py-3 transition-colors ${active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/63 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'}`}>
          <Icon size={19} strokeWidth={active ? 2.4 : 1.8} />
          <span className="min-w-0"><span className="block text-[13px] font-bold">{label}</span><span className="mt-0.5 block text-[10px] opacity-50">{sub}</span></span>
          {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-secondary" />}
        </Link>;
      })}
    </nav>
    <div className="mt-auto">
      {user.role === 'admin' && <div className="mb-4 rounded-xl border border-sidebar-border bg-sidebar-accent/60 p-3">
        <div className="flex items-center gap-2 text-secondary"><ShieldCheck size={15} /><span className="text-[11px] font-bold">Admin console</span></div>
        <p className="mt-2 text-[11px] leading-relaxed text-sidebar-foreground/55">Full team visibility and export access enabled.</p>
      </div>}
      <div className="flex items-center gap-3 border-t border-sidebar-border pt-4">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-xs font-extrabold text-secondary-foreground">{initials(user.name)}</div>
        <div className="min-w-0 flex-1"><div className="truncate text-xs font-bold">{user.name}</div><div className="truncate text-[10px] text-sidebar-foreground/50">{user.email}</div></div>
        <button onClick={onLogout} title="Sign out" aria-label="Sign out" data-testid="button-sign-out" className="rounded-lg p-2 text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-secondary"><LogOut size={16} /></button>
      </div>
    </div>
  </aside>;
}

function MobileHeader({ user, onMenu }: { user: User; onMenu: () => void }) {
  return <header className="flex items-center justify-between border-b border-border bg-card/90 px-4 py-3 backdrop-blur md:hidden">
    <button onClick={onMenu} aria-label="Open navigation" data-testid="button-open-navigation" className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><Menu size={20} /></button>
    <Brand compact />
    <div className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-[10px] font-extrabold">{initials(user.name)}</div>
  </header>;
}

function Topbar({ user, title, subtitle, action }: { user: User; title: string; subtitle: string; action?: ReactNode }) {
  return <div className="mb-8 flex items-start justify-between gap-4">
    <div><div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.18em] text-primary"><span className="h-1.5 w-1.5 rounded-full bg-secondary" />{user.role === 'admin' ? 'Admin view' : 'Field operator'}</div><h1 className="text-2xl font-extrabold tracking-[-.04em] text-foreground sm:text-3xl">{title}</h1><p className="mt-1 text-sm text-muted-foreground">{subtitle}</p></div>
    {action}
  </div>;
}

function Shell({ user, children, onLogout }: { user: User; children: ReactNode; onLogout: () => void }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return <div className="min-h-[100dvh] bg-background">
    <div className="flex min-h-[100dvh]">
      <Sidebar user={user} onLogout={onLogout} />
      <div className="min-w-0 flex-1">
        <MobileHeader user={user} onMenu={() => setMobileOpen(true)} />
        {mobileOpen && <div className="fixed inset-0 z-50 flex md:hidden"><button className="absolute inset-0 bg-foreground/30" aria-label="Close navigation" onClick={() => setMobileOpen(false)} /><div className="relative z-10 flex w-[280px] flex-col bg-sidebar p-5 text-sidebar-foreground"><div className="flex items-center justify-between"><Brand /><button onClick={() => setMobileOpen(false)} aria-label="Close navigation" data-testid="button-close-navigation" className="rounded-lg p-2 hover:bg-sidebar-accent"><X size={18} /></button></div><nav className="mt-10 space-y-1">{[{ href: '/', label: 'ស្កេនថ្មី', sub: 'New scan', icon: ScanLine }, { href: '/dashboard', label: 'ផ្ទាំងគ្រប់គ្រង', sub: 'Dashboard', icon: LayoutDashboard }, { href: '/scans', label: 'ប្រវត្តិស្កេន', sub: 'Scan history', icon: History }, { href: '/settings', label: 'ការកំណត់', sub: 'Settings', icon: Settings2 }].map(({ href, label, sub, icon: Icon }) => <Link onClick={() => setMobileOpen(false)} key={href} href={href} data-testid={`mobile-link-${sub.toLowerCase().replace(' ', '-')}`} className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-sidebar-accent"><Icon size={19} /><span><b className="block text-sm">{label}</b><small className="opacity-50">{sub}</small></span></Link>)}</nav><button onClick={onLogout} data-testid="mobile-button-sign-out" className="mt-auto flex items-center gap-3 border-t border-sidebar-border pt-4 text-sm"><LogOut size={18} /> Sign out</button></div></div>}
        <main className="app-grid min-h-[calc(100dvh-57px)] px-4 py-7 sm:px-7 lg:px-10 lg:py-9">{children}</main>
      </div>
    </div>
  </div>;
}

function SignIn({ onSignedIn }: { onSignedIn: (user: User) => void }) {
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const submit = (event: React.FormEvent) => { event.preventDefault(); login.mutate({ data: { email, password } }, { onSuccess: (session) => { localStorage.setItem('cai_session', session.token); onSignedIn(session.user); } }); };
  return <div className="min-h-[100dvh] bg-sidebar text-sidebar-foreground">
    <div className="mx-auto grid min-h-[100dvh] max-w-[1440px] lg:grid-cols-[1.02fr_.98fr]">
      <section className="relative hidden overflow-hidden border-r border-sidebar-border px-12 py-12 lg:flex lg:flex-col">
        <Brand />
        <div className="relative z-10 mt-auto max-w-xl pb-8"><Pill tone="warm"><ShieldCheck size={13} /> Secure field intelligence</Pill><h1 className="mt-7 text-6xl font-extrabold leading-[.98] tracking-[-.07em]">Count what<br /><span className="text-secondary">matters.</span></h1><p className="mt-7 max-w-md text-base leading-relaxed text-sidebar-foreground/60">A calm, verified workspace for the teams moving Cambodia’s resources forward.</p><div className="mt-12 flex items-center gap-8 text-[11px] font-bold uppercase tracking-[.16em] text-sidebar-foreground/45"><span className="flex items-center gap-2"><LockKeyhole size={14} /> Signed records</span><span className="flex items-center gap-2"><Wifi size={14} /> Field ready</span></div></div>
        <div className="absolute -right-24 top-32 h-96 w-96 rounded-full border border-secondary/15" /><div className="absolute -right-4 top-56 h-64 w-64 rounded-full border border-secondary/10" /><div className="absolute bottom-20 left-1/2 h-px w-1/2 bg-gradient-to-r from-transparent via-secondary/30 to-transparent" />
      </section>
      <section className="flex items-center justify-center bg-background px-5 py-10 text-foreground sm:px-10">
        <div className="w-full max-w-[430px] animate-rise">
          <div className="mb-12 lg:hidden"><Brand /></div>
          <div className="mb-10"><p className="mb-3 text-xs font-bold uppercase tracking-[.2em] text-primary">CAI Pro Vision / Access</p><h2 className="text-3xl font-extrabold tracking-[-.05em]">សូមស្វាគមន៍មកវិញ</h2><p className="mt-2 text-sm text-muted-foreground">Welcome back. Sign in to your operations console.</p></div>
          <form onSubmit={submit} className="space-y-5">
            <label className="block"><span className="mb-2 block text-xs font-bold">អ៊ីមែល <span className="font-normal text-muted-foreground">/ Work email</span></span><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="operator@cai.gov.kh" data-testid="input-email" className="h-12 w-full rounded-xl border border-input bg-card px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" /></label>
            <label className="block"><span className="mb-2 block text-xs font-bold">ពាក្យសម្ងាត់ <span className="font-normal text-muted-foreground">/ Password</span></span><div className="relative"><input required minLength={1} type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" data-testid="input-password" className="h-12 w-full rounded-xl border border-input bg-card px-4 pr-20 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" /><button type="button" onClick={() => setShowPassword(!showPassword)} data-testid="button-toggle-password" className="absolute right-3 top-1/2 -translate-y-1/2 px-2 text-[11px] font-bold text-primary">{showPassword ? 'Hide' : 'Show'}</button></div></label>
            {login.isError && <div role="alert" data-testid="status-login-error" className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-xs font-semibold text-destructive">We could not verify those credentials. Check your email and try again.</div>}
            <button type="submit" disabled={login.isPending} data-testid="button-sign-in" className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-extrabold text-primary-foreground shadow-[0_4px_0_hsl(173_57%_25%)] transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60">{login.isPending ? <><Loader2 size={17} className="animate-spin" /> Signing in…</> : <>ចូលប្រើប្រាស់ <ArrowRight size={17} /></>}</button>
          </form>
          <div className="mt-9 flex items-start gap-3 border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground"><LockKeyhole size={15} className="mt-0.5 shrink-0 text-primary" /><span>Your workspace is protected with signed scan records and role-based access.</span></div>
        </div>
      </section>
    </div>
  </div>;
}

function ScanWorkspace({ user, healthStatus }: { user: User; healthStatus?: string }) {
  const createScan = useCreateScan();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [category, setCategory] = useState<ScanInput['category']>('universal');
  const [batchId, setBatchId] = useState('');
  const [count, setCount] = useState('0');
  const [types, setTypes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [aiComplete, setAiComplete] = useState(false);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsState, setGpsState] = useState<'idle' | 'loading' | 'ready' | 'denied'>('idle');
  const [hash, setHash] = useState('');
  const [notice, setNotice] = useState('');
  const [aiError, setAiError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const onFile = async (selected: File | undefined) => {
    if (!selected) return;
    setFile(selected); setAiComplete(false); setNotice(''); setAiError('');
    const objectUrl = URL.createObjectURL(selected);
    setPreview(objectUrl);
    setProcessing(true);
    try {
      const buffer = await selected.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', buffer);
      setHash(Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join(''));
      const image = new Image();
      image.src = objectUrl;
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('image')); });
      const model = await cocoSsd.load();
      const predictions = await model.detect(image);
      const visible = predictions.filter((prediction) => prediction.score >= 0.45);
      setCount(String(visible.length));
      setTypes(Array.from(new Set(visible.map((prediction) => prediction.class))).join(', '));
      setAiComplete(true);
    } catch {
      setAiError('AI detection was unavailable for this image. You can enter the count manually.');
    } finally {
      setProcessing(false);
    }
  };
  const requestGps = () => {
    if (!navigator.geolocation) { setGpsState('denied'); return; }
    setGpsState('loading'); navigator.geolocation.getCurrentPosition((position) => { setGps({ lat: position.coords.latitude, lng: position.coords.longitude }); setGpsState('ready'); }, () => setGpsState('denied'), { enableHighAccuracy: true, timeout: 8000 });
  };
  const reset = () => { setFile(null); setPreview(''); setHash(''); setAiComplete(false); setProcessing(false); setCount('0'); setTypes(''); setBatchId(''); setNotice(''); if (fileInput.current) fileInput.current.value = ''; };
  const save = () => {
    if (!batchId.trim() || Number(count) < 0 || !hash) { setNotice('Add a batch ID, verify an image, and confirm the count before saving.'); return; }
    const data: ScanInput = { category, batchId: batchId.trim(), totalCount: Number(count), detectedTypes: types.split(',').map((item) => item.trim()).filter(Boolean), hashSignature: hash, aiAssisted: aiComplete, latitude: gps?.lat ?? null, longitude: gps?.lng ?? null };
    createScan.mutate({ data }, { onSuccess: () => { setNotice('Scan saved and signed successfully.'); queryClient.invalidateQueries({ queryKey: getListScansQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); window.setTimeout(reset, 1600); }, onError: () => setNotice('The scan could not be saved. Check your connection and retry.') });
  };
  return <div className="mx-auto max-w-[1420px]"><Topbar user={user} title="ស្កេនថ្មី" subtitle="Capture a record, verify it, keep moving." action={<div data-testid="status-system-health" className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-[11px] font-bold text-muted-foreground sm:flex"><span className={`pulse-dot h-2 w-2 rounded-full ${healthStatus === 'ok' ? 'bg-primary' : 'bg-secondary'}`} /> {healthStatus === 'ok' ? 'System online' : 'Checking system'}</div>} />
    {notice && <div data-testid="status-scan-notice" className={`mb-5 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${notice.includes('successfully') ? 'border-primary/20 bg-primary/10 text-primary' : 'border-secondary/40 bg-secondary/15 text-foreground'}`}>{notice.includes('successfully') && <Check size={16} />}{notice}</div>}
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(330px,.7fr)]">
      <section className="rounded-2xl border border-card-border bg-card p-4 shadow-[0_12px_36px_rgba(20,57,63,.05)] sm:p-6">
         <div className="mb-6 flex items-center justify-between"><div><h2 className="text-base font-extrabold">Capture image</h2><p className="mt-1 text-xs text-muted-foreground">Upload a clear field image for assisted detection.</p></div><Pill tone={processing ? 'warm' : aiComplete ? 'good' : 'neutral'}>{processing ? <><Loader2 size={12} className="animate-spin" /> Processing</> : aiComplete ? <><Check size={12} /> Ready</> : <><Sparkles size={12} /> AI assisted</>}</Pill></div>
        <button type="button" onClick={() => fileInput.current?.click()} data-testid="button-upload-image" className={`group relative flex min-h-[280px] w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition ${preview ? 'border-primary/35 bg-sidebar' : 'border-border bg-muted/40 hover:border-primary/50 hover:bg-primary/5'}`}>
          <input ref={fileInput} type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0])} data-testid="input-image-upload" className="hidden" />
          {preview ? <><img src={preview} alt="Selected field scan" className="absolute inset-0 h-full w-full object-contain opacity-85" />{processing && <div className="scan-line absolute left-0 right-0 h-1 bg-secondary shadow-[0_0_18px_hsl(39_76%_57%)]" />}{processing && <div className="absolute inset-0 bg-sidebar/35" />}<div className="absolute bottom-3 left-3 rounded-lg bg-sidebar/90 px-3 py-2 text-left text-xs text-sidebar-foreground backdrop-blur"><div className="font-bold">{file?.name}</div><div className="mt-1 text-sidebar-foreground/60">{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : ''}</div></div><div className="absolute right-3 top-3 rounded-full bg-sidebar/85 p-2 text-sidebar-foreground"><FileImage size={16} /></div></> : <div className="relative z-10 text-center"><div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary transition group-hover:scale-105"><UploadCloud size={26} /></div><div className="text-sm font-extrabold">Tap to upload image</div><div className="mt-1 text-xs text-muted-foreground">JPG, PNG up to 10 MB</div></div>}
        </button>
        <div className="mt-6 grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-xs font-bold">ប្រភេទ <span className="font-normal text-muted-foreground">/ Category</span></span><select value={category} onChange={(e) => setCategory(e.target.value as ScanInput['category'])} data-testid="select-category" className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold outline-none focus:border-primary">{categories.map((item) => <option key={item.value} value={item.value}>{item.kh} · {item.en}</option>)}</select></label><label><span className="mb-2 block text-xs font-bold">លេខបាច់ <span className="font-normal text-muted-foreground">/ Batch ID</span></span><input value={batchId} onChange={(e) => setBatchId(e.target.value)} placeholder="e.g. KHM-24-081" data-testid="input-batch-id" className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary" /></label></div>
      </section>
      <section className="space-y-5">
        <div className="rounded-2xl border border-card-border bg-card p-5 shadow-[0_12px_36px_rgba(20,57,63,.05)]"><div className="mb-5 flex items-center gap-2"><div className="grid h-8 w-8 place-items-center rounded-lg bg-secondary/25 text-foreground"><Gauge size={17} /></div><div><h2 className="text-sm font-extrabold">Review detection</h2><p className="text-[11px] text-muted-foreground">Correct before signing the record.</p></div></div><label className="block"><span className="mb-2 block text-xs font-bold">ចំនួនសរុប <span className="font-normal text-muted-foreground">/ Total count</span></span><input type="number" min="0" value={count} onChange={(e) => setCount(e.target.value)} data-testid="input-total-count" className="h-14 w-full rounded-xl border border-input bg-background px-4 font-mono-ops text-2xl font-bold outline-none focus:border-primary" /></label><label className="mt-4 block"><span className="mb-2 block text-xs font-bold">ប្រភេទដែលរកឃើញ <span className="font-normal text-muted-foreground">/ Detected types</span></span><input value={types} onChange={(e) => setTypes(e.target.value)} placeholder="Separate types with commas" data-testid="input-detected-types" className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary" /></label><div className="mt-4 flex items-center justify-between rounded-xl bg-muted/70 px-3 py-2.5"><span className="text-xs text-muted-foreground">AI suggestion</span><span className={`text-xs font-bold ${aiComplete ? 'text-primary' : 'text-muted-foreground'}`}>{aiComplete ? 'Applied · editable' : 'Waiting for image'}</span></div></div>
        <div className="rounded-2xl border border-card-border bg-card p-5 shadow-[0_12px_36px_rgba(20,57,63,.05)]"><div className="flex items-start gap-3"><div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${gpsState === 'ready' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}><MapPin size={17} /></div><div className="min-w-0 flex-1"><h2 className="text-sm font-extrabold">ទីតាំង GPS <span className="font-normal text-muted-foreground">/ Location</span></h2><p className="mt-1 text-xs text-muted-foreground">{gpsState === 'ready' && gps ? `${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}` : gpsState === 'denied' ? 'Location permission unavailable' : 'Attach your current position to this record.'}</p></div><button onClick={requestGps} disabled={gpsState === 'loading'} data-testid="button-request-gps" className="rounded-lg border border-border px-2.5 py-2 text-[11px] font-bold text-primary hover:bg-primary/5 disabled:opacity-50">{gpsState === 'loading' ? <Loader2 size={14} className="animate-spin" /> : gpsState === 'ready' ? 'Refresh' : 'Enable'}</button></div></div>
         <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5"><div className="flex items-start gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"><Fingerprint size={17} /></div><div className="min-w-0"><h2 className="text-sm font-extrabold">SHA-256 verification</h2><p className="mt-1 text-xs text-muted-foreground">{hash ? 'Image fingerprint generated locally.' : 'Upload an image to generate its fingerprint.'}</p><div data-testid="text-hash-signature" className="mt-3 break-all font-mono-ops text-[10px] leading-relaxed text-primary">{hash || '— — — — — — — —'}</div>{aiError && <p className="mt-3 text-xs font-semibold text-secondary-foreground">{aiError}</p>}</div></div></div>
        <div className="flex gap-3"><button onClick={reset} type="button" data-testid="button-reset-scan" className="h-12 flex-1 rounded-xl border border-border bg-card text-sm font-bold text-muted-foreground hover:bg-muted">Clear</button><button onClick={save} disabled={createScan.isPending} data-testid="button-save-scan" className="flex h-12 flex-[2] items-center justify-center gap-2 rounded-xl bg-primary text-sm font-extrabold text-primary-foreground shadow-[0_4px_0_hsl(173_57%_25%)] transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60">{createScan.isPending ? <><Loader2 size={17} className="animate-spin" /> Signing…</> : <><FileCheck2 size={17} /> Save signed scan</>}</button></div>
      </section>
    </div>
  </div>;
}

function MetricCard({ label, value, sub, icon: Icon, tone = 'teal' }: { label: string; value: string | number; sub: string; icon: typeof Activity; tone?: 'teal' | 'orange' | 'coral' }) {
  const colors = { teal: 'bg-primary/10 text-primary', orange: 'bg-secondary/25 text-foreground', coral: 'bg-accent/15 text-foreground' };
  return <div className="rounded-2xl border border-card-border bg-card p-5 shadow-[0_10px_30px_rgba(20,57,63,.04)]"><div className="flex items-start justify-between"><div className="text-[11px] font-bold uppercase tracking-[.12em] text-muted-foreground">{label}</div><div className={`grid h-9 w-9 place-items-center rounded-xl ${colors[tone]}`}><Icon size={17} /></div></div><div data-testid={`metric-${label.toLowerCase().replaceAll(' ', '-')}`} className="mt-6 font-mono-ops text-3xl font-bold tracking-[-.06em]">{value}</div><div className="mt-2 text-xs text-muted-foreground">{sub}</div></div>;
}

function ScanRow({ scan, index = 0 }: { scan: Scan; index?: number }) {
  const category = categories.find((item) => item.value === scan.category);
  return <div data-testid={`row-scan-${scan.id || index}`} className="flex items-center gap-3 border-b border-border/70 px-1 py-4 last:border-0 sm:gap-4"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><PackageSearch size={17} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="truncate text-sm font-extrabold">{scan.batchId}</span><Pill tone={category?.tint === 'orange' ? 'warm' : category?.tint === 'coral' ? 'coral' : 'good'}>{category?.en || scan.category}</Pill></div><div className="mt-1 truncate text-[11px] text-muted-foreground">{scan.operator} · {formatDate(scan.createdAt)}</div></div><div className="text-right"><div className="font-mono-ops text-base font-bold">{scan.totalCount}</div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">items</div></div><div className="hidden text-primary sm:block"><Check size={16} /></div></div>;
}

function Dashboard({ user }: { user: User }) {
  const summaryQuery = useGetDashboardSummary();
  const summary = summaryQuery.data;
  const [range, setRange] = useState('7 days');
  const categoryEntries = Object.entries(summary?.categoryCounts || {});
  const maxCategory = Math.max(...categoryEntries.map(([, value]) => value), 1);
  return <div className="mx-auto max-w-[1420px]"><Topbar user={user} title="ផ្ទាំងគ្រប់គ្រង" subtitle={user.role === 'admin' ? 'A live read of every team’s field activity.' : 'Your field activity, at a glance.'} action={<button onClick={() => summaryQuery.refetch()} data-testid="button-refresh-dashboard" className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-bold text-muted-foreground hover:bg-muted"><RefreshCw size={14} className={summaryQuery.isFetching ? 'animate-spin' : ''} /> Refresh</button>} />
    {summaryQuery.isError && <div role="alert" data-testid="status-dashboard-error" className="mb-5 flex items-center justify-between rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive"><span>Dashboard data could not be loaded.</span><button onClick={() => summaryQuery.refetch()} data-testid="button-retry-dashboard" className="font-bold underline">Retry</button></div>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{summaryQuery.isLoading ? [1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-[157px]" />) : <><MetricCard label="Total scans" value={summary?.totalScans ?? 0} sub="All signed records" icon={ScanLine} /><MetricCard label="Total items" value={summary?.totalItems ?? 0} sub="Across all categories" icon={PackageSearch} tone="orange" /><MetricCard label="Today’s scans" value={summary?.todayScans ?? 0} sub="Since 00:00 local time" icon={Activity} tone="coral" /><MetricCard label="Verification" value="SHA-256" sub="Every record fingerprinted" icon={ShieldCheck} /></>}</div>
    <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_.9fr]"><section className="rounded-2xl border border-card-border bg-card p-5 sm:p-6"><div className="mb-7 flex items-center justify-between"><div><h2 className="text-base font-extrabold">Scan volume</h2><p className="mt-1 text-xs text-muted-foreground">Category distribution across signed records</p></div><select value={range} onChange={(e) => setRange(e.target.value)} data-testid="select-dashboard-range" className="rounded-lg border border-border bg-background px-2.5 py-2 text-[11px] font-bold outline-none"><option>7 days</option><option>30 days</option><option>All time</option></select></div>{summaryQuery.isLoading ? <Skeleton className="h-48" /> : categoryEntries.length ? <div className="space-y-5">{categoryEntries.map(([key, value]) => { const category = categories.find((item) => item.value === key); return <div key={key}><div className="mb-2 flex items-center justify-between text-xs"><span className="font-bold">{category?.kh || key} <span className="font-normal text-muted-foreground">/ {category?.en || key}</span></span><span className="font-mono-ops text-muted-foreground">{value}</span></div><div className="h-3 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full transition-all duration-700 ${category?.tint === 'orange' ? 'bg-secondary' : category?.tint === 'coral' ? 'bg-accent' : category?.tint === 'olive' ? 'bg-chart-5' : 'bg-primary'}`} style={{ width: `${Math.max((value / maxCategory) * 100, 5)}%` }} /></div></div>})}</div> : <EmptyState icon={BarChart3} title="No scan volume yet" detail="Signed records will appear here after your first field scan." />}</section><section className="rounded-2xl border border-card-border bg-card p-5 sm:p-6"><div className="mb-3 flex items-center justify-between"><div><h2 className="text-base font-extrabold">Recent activity</h2><p className="mt-1 text-xs text-muted-foreground">Latest signed records</p></div><Link href="/scans" data-testid="link-view-all-scans" className="text-xs font-bold text-primary hover:underline">View all <ArrowRight size={13} className="ml-1 inline" /></Link></div>{summaryQuery.isLoading ? <div className="space-y-2">{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-16" />)}</div> : summary?.recentScans?.length ? summary.recentScans.slice(0, 5).map((scan, index) => <ScanRow key={scan.id || index} scan={scan} index={index} />) : <EmptyState icon={History} title="No recent activity" detail="Your most recent scans will be listed here." />}</section></div>
    <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-secondary/35 bg-secondary/10 px-5 py-4"><div className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-secondary-foreground"><Zap size={17} /></div><div className="flex-1"><div className="text-sm font-extrabold">Keep the chain unbroken</div><div className="text-xs text-muted-foreground">Every saved image is fingerprinted before it enters the shared record.</div></div><Pill tone="warm"><LockKeyhole size={12} /> Verified workflow</Pill></div>
  </div>;
}

function EmptyState({ icon: Icon, title, detail }: { icon: typeof Activity; title: string; detail: string }) {
  return <div className="grid min-h-[170px] place-items-center rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center"><div><div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-card text-muted-foreground shadow-sm"><Icon size={19} /></div><div className="mt-3 text-sm font-bold">{title}</div><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div></div>;
}

function ScansPage({ user }: { user: User }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Scan | null>(null);
  const [category, setCategory] = useState('all');
  const scansQuery = useListScans({ limit: 100 });
  const scans = useMemo(() => (scansQuery.data || []).filter((scan) => `${scan.batchId} ${scan.operator} ${scan.category} ${scan.hashSignature}`.toLowerCase().includes(query.toLowerCase()) && (category === 'all' || scan.category === category)), [scansQuery.data, query, category]);
  const exportCsv = () => { const rows = [['id', 'batch_id', 'category', 'operator', 'total_count', 'detected_types', 'hash_signature', 'ai_assisted', 'latitude', 'longitude', 'created_at'], ...scans.map((scan) => [scan.id, scan.batchId, scan.category, scan.operator, String(scan.totalCount), scan.detectedTypes.join('; '), scan.hashSignature, String(scan.aiAssisted), String(scan.latitude ?? ''), String(scan.longitude ?? ''), scan.createdAt])]; const blob = new Blob([rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `cai-pro-vision-scans-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); URL.revokeObjectURL(url); };
  return <div className="mx-auto max-w-[1420px]"><Topbar user={user} title="ប្រវត្តិស្កេន" subtitle="Search, inspect, and export the signed field register." action={<button onClick={exportCsv} disabled={!scans.length} data-testid="button-export-csv" className="flex items-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-xs font-extrabold text-primary-foreground shadow-[0_3px_0_hsl(173_57%_25%)] disabled:opacity-40"><Download size={14} /> Export CSV</button>} />
    <section className="rounded-2xl border border-card-border bg-card p-4 shadow-[0_12px_36px_rgba(20,57,63,.05)] sm:p-6"><div className="flex flex-col gap-3 lg:flex-row"><div className="relative flex-1"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} type="search" placeholder="Search batch ID, operator, category, hash…" data-testid="input-search-scans" className="h-11 w-full rounded-xl border border-input bg-background pl-10 pr-4 text-sm outline-none focus:border-primary" /></div><div className="flex items-center gap-2 overflow-x-auto"><SlidersHorizontal size={15} className="shrink-0 text-muted-foreground" />{['all', ...categories.map((item) => item.value)].map((item) => <button key={item} onClick={() => setCategory(item)} data-testid={`button-filter-${item}`} className={`whitespace-nowrap rounded-lg px-3 py-2 text-[11px] font-bold transition ${category === item ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary'}`}>{item === 'all' ? 'All records' : categories.find((cat) => cat.value === item)?.en}</button>)}</div></div><div className="mt-5 flex items-center justify-between border-b border-border pb-3 text-[11px] font-bold uppercase tracking-[.13em] text-muted-foreground"><span>{scansQuery.isLoading ? 'Loading register' : `${scans.length} visible record${scans.length === 1 ? '' : 's'}`}</span><span className="hidden sm:block">Signed · SHA-256</span></div>{scansQuery.isError ? <div className="py-8 text-center"><div className="text-sm font-bold text-destructive">Unable to load scan history.</div><button onClick={() => scansQuery.refetch()} data-testid="button-retry-scans" className="mt-2 text-xs font-bold text-primary underline">Retry</button></div> : scansQuery.isLoading ? <div className="space-y-3 py-3">{[1, 2, 3, 4, 5].map((item) => <Skeleton key={item} className="h-[67px]" />)}</div> : scans.length ? <div>{scans.map((scan, index) => <button key={scan.id || index} onClick={() => setSelected(scan)} data-testid={`button-open-scan-${scan.id || index}`} className="block w-full text-left transition hover:bg-muted/45"><ScanRow scan={scan} index={index} /></button>)}</div> : <div className="py-5"><EmptyState icon={History} title={query || category !== 'all' ? 'No matching records' : 'Register is empty'} detail={query || category !== 'all' ? 'Try a different search or category filter.' : 'Saved scans will appear in this register.'} /></div>}</section>
    {selected && <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/35 p-0 sm:items-center sm:p-5"><button aria-label="Close scan details" onClick={() => setSelected(null)} className="absolute inset-0" /><section role="dialog" aria-modal="true" className="relative z-10 max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-border bg-card p-5 shadow-2xl sm:rounded-2xl sm:p-7"><div className="flex items-start justify-between"><div><Pill tone="good"><Check size={12} /> Signed record</Pill><h2 className="mt-3 text-xl font-extrabold">{selected.batchId}</h2><p className="mt-1 text-xs text-muted-foreground">{formatDate(selected.createdAt)} · {selected.operator}</p></div><button onClick={() => setSelected(null)} aria-label="Close details" data-testid="button-close-scan-details" className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X size={18} /></button></div><div className="mt-7 grid grid-cols-2 gap-3"><div className="rounded-xl bg-muted/60 p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Category</div><div className="mt-2 text-sm font-bold">{categories.find((item) => item.value === selected.category)?.kh} · {selected.category}</div></div><div className="rounded-xl bg-muted/60 p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total count</div><div className="mt-2 font-mono-ops text-xl font-bold">{selected.totalCount}</div></div></div><div className="mt-3 rounded-xl border border-border p-4"><div className="flex items-center gap-2 text-xs font-bold"><Fingerprint size={15} className="text-primary" /> SHA-256 signature</div><div className="mt-3 break-all font-mono-ops text-[10px] leading-relaxed text-primary">{selected.hashSignature}</div></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-muted/60 p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Detected types</div><div className="mt-2 text-xs font-semibold">{selected.detectedTypes.length ? selected.detectedTypes.join(', ') : 'None recorded'}</div></div><div className="rounded-xl bg-muted/60 p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Coordinates</div><div className="mt-2 font-mono-ops text-[10px]">{selected.latitude != null ? `${selected.latitude.toFixed(5)}, ${selected.longitude?.toFixed(5)}` : 'Not attached'}</div></div></div></section></div>}
  </div>;
}

function SettingsPage({ user }: { user: User }) {
  const [geofence, setGeofence] = useState(() => localStorage.getItem('cai_geofence') !== 'off');
  const [radius, setRadius] = useState(() => localStorage.getItem('cai_geofence_radius') || '250');
  const [saved, setSaved] = useState(false);
  const saveSettings = () => { localStorage.setItem('cai_geofence', geofence ? 'on' : 'off'); localStorage.setItem('cai_geofence_radius', radius); setSaved(true); window.setTimeout(() => setSaved(false), 2400); };
  return <div className="mx-auto max-w-[1060px]"><Topbar user={user} title="ការកំណត់" subtitle="Account controls and field safety settings." action={saved ? <Pill tone="good"><Check size={12} /> Saved</Pill> : undefined} /><div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]"><section className="rounded-2xl border border-card-border bg-card p-5 sm:p-7"><div className="mb-7"><h2 className="text-base font-extrabold">គណនី / Account</h2><p className="mt-1 text-xs text-muted-foreground">Your identity on every signed scan.</p></div><div className="flex items-center gap-4 border-b border-border pb-6"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-lg font-extrabold text-secondary-foreground">{initials(user.name)}</div><div><div className="text-lg font-extrabold">{user.name}</div><div className="mt-1 text-sm text-muted-foreground">{user.email}</div><div className="mt-2"><Pill tone={user.role === 'admin' ? 'warm' : 'good'}>{user.role === 'admin' ? <><ShieldCheck size={12} /> Administrator</> : <><UserRound size={12} /> Field staff</>}</Pill></div></div></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><div className="rounded-xl bg-muted/60 p-4"><div className="flex items-center gap-2 text-xs font-bold"><LockKeyhole size={14} className="text-primary" /> Authentication</div><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Signed in through your organization account. Session cookies are sent securely.</p></div><div className="rounded-xl bg-muted/60 p-4"><div className="flex items-center gap-2 text-xs font-bold"><UsersRound size={14} className="text-primary" /> Access role</div><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{user.role === 'admin' ? 'Team-wide dashboard, register, and export access.' : 'Personal scanning and visible register access.'}</p></div></div></section><section className="rounded-2xl border border-card-border bg-card p-5 sm:p-7"><div className="mb-7"><h2 className="text-base font-extrabold">ទីតាំងសុវត្ថិភាព / Geofence</h2><p className="mt-1 text-xs text-muted-foreground">Keep field records inside the approved working area.</p></div><div className="flex items-center justify-between gap-4 rounded-xl border border-border p-4"><div><div className="text-sm font-extrabold">Require location on scan</div><div className="mt-1 text-xs text-muted-foreground">{geofence ? 'GPS is requested before saving.' : 'Location remains optional.'}</div></div><button role="switch" aria-checked={geofence} onClick={() => setGeofence(!geofence)} data-testid="switch-geofence" className={`relative h-7 w-12 rounded-full transition-colors ${geofence ? 'bg-primary' : 'bg-muted'}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-card shadow transition-transform ${geofence ? 'translate-x-6' : 'translate-x-1'}`} /></button></div><label className="mt-5 block"><span className="mb-2 block text-xs font-bold">Working radius <span className="font-normal text-muted-foreground">/ metres</span></span><div className="relative"><input type="number" min="50" max="5000" value={radius} onChange={(e) => setRadius(e.target.value)} disabled={!geofence} data-testid="input-geofence-radius" className="h-11 w-full rounded-xl border border-input bg-background px-3 pr-16 font-mono-ops text-sm outline-none focus:border-primary disabled:opacity-40" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">m</span></div></label><div className="mt-5 flex items-start gap-2.5 rounded-xl bg-secondary/12 p-3 text-xs leading-relaxed text-muted-foreground"><Globe2 size={15} className="mt-0.5 shrink-0 text-foreground" />Coordinates are attached to the signed record only when permission is granted on the device.</div><button onClick={saveSettings} data-testid="button-save-settings" className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-extrabold text-primary-foreground shadow-[0_3px_0_hsl(173_57%_25%)] hover:-translate-y-0.5"><Check size={16} /> Save settings</button></section></div><section className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-5"><div className="flex items-start gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"><CircleHelp size={17} /></div><div><h2 className="text-sm font-extrabold">Need help in the field?</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Ask your administrator to update team access or the approved operating area. CAI Pro Vision will keep the last saved setting on this device.</p></div></div></section></div>;
}

function AuthenticatedApp({ user, onLogout, healthStatus }: { user: User; onLogout: () => void; healthStatus?: string }) {
  return <Shell user={user} onLogout={onLogout}><Switch><Route path="/" component={() => <ScanWorkspace user={user} healthStatus={healthStatus} />} /><Route path="/dashboard" component={() => <Dashboard user={user} />} /><Route path="/scans" component={() => <ScansPage user={user} />} /><Route path="/settings" component={() => <SettingsPage user={user} />} /><Route component={NotFound} /></Switch></Shell>;
}

function NotFound() { return <div className="mx-auto max-w-lg py-20 text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-secondary-foreground"><FileCheck2 size={24} /></div><h1 className="mt-5 text-2xl font-extrabold">Page not found</h1><p className="mt-2 text-sm text-muted-foreground">This route is not part of the operations console.</p><Link href="/" data-testid="link-back-home" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground">Return to scanning <ArrowRight size={16} /></Link></div>; }

function Router() {
  const currentUser = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey(), retry: false } });
  const health = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), retry: false, refetchInterval: 30000 } });
  const [localUser, setLocalUser] = useState<User | null>(null);
  const user = localUser || currentUser.data || null;
  const logout = () => { localStorage.removeItem('cai_session'); setLocalUser(null); queryClient.removeQueries({ queryKey: getGetCurrentUserQueryKey() }); };
  if (currentUser.isLoading && !localUser) return <div className="grid min-h-[100dvh] place-items-center bg-background p-6"><div className="w-full max-w-sm"><Brand compact /><Skeleton className="mt-16 h-12 w-40" /><Skeleton className="mt-4 h-5 w-64" /><Skeleton className="mt-10 h-12 w-full" /><Skeleton className="mt-3 h-12 w-full" /></div></div>;
  return user ? <AuthenticatedApp user={user} onLogout={logout} healthStatus={health.data?.status} /> : <SignIn onSignedIn={setLocalUser} />;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><ErrorBoundary><Router /></ErrorBoundary></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;
