import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
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

/* ===================== i18n ===================== */

type LangCode =
  | 'km' | 'en' | 'zh' | 'ja' | 'ko' | 'th' | 'vi' | 'lo' | 'my' | 'id' | 'ms' | 'tl'
  | 'hi' | 'bn' | 'fr' | 'de' | 'es' | 'it' | 'pt' | 'ru' | 'nl' | 'pl' | 'tr' | 'uk';

const LANGUAGES: { code: LangCode; native: string; flag: string }[] = [
  { code: 'km', native: 'ខ្មែរ', flag: '🇰🇭' },
  { code: 'en', native: 'English', flag: '🇬🇧' },
  { code: 'zh', native: '中文', flag: '🇨🇳' },
  { code: 'ja', native: '日本語', flag: '🇯🇵' },
  { code: 'ko', native: '한국어', flag: '🇰🇷' },
  { code: 'th', native: 'ไทย', flag: '🇹🇭' },
  { code: 'vi', native: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'lo', native: 'ລາວ', flag: '🇱🇦' },
  { code: 'my', native: 'မြန်မာ', flag: '🇲🇲' },
  { code: 'id', native: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'ms', native: 'Bahasa Melayu', flag: '🇲🇾' },
  { code: 'tl', native: 'Filipino', flag: '🇵🇭' },
  { code: 'hi', native: 'हिन्दी', flag: '🇮🇳' },
  { code: 'bn', native: 'বাংলা', flag: '🇧🇩' },
  { code: 'fr', native: 'Français', flag: '🇫🇷' },
  { code: 'de', native: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', native: 'Español', flag: '🇪🇸' },
  { code: 'it', native: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', native: 'Português', flag: '🇵🇹' },
  { code: 'ru', native: 'Русский', flag: '🇷🇺' },
  { code: 'nl', native: 'Nederlands', flag: '🇳🇱' },
  { code: 'pl', native: 'Polski', flag: '🇵🇱' },
  { code: 'tr', native: 'Türkçe', flag: '🇹🇷' },
  { code: 'uk', native: 'Українська', flag: '🇺🇦' },
];

const translations: Record<LangCode, Record<string, string>> = {
  en: {
    navScan: 'New scan', navScanSub: 'Capture a record',
    navDashboard: 'Dashboard', navDashboardSub: 'Overview',
    navHistory: 'Scan history', navHistorySub: 'Past records',
    navSettings: 'Settings', navSettingsSub: 'Preferences',
    signOut: 'Sign out', fieldOperator: 'Field operator', adminView: 'Admin view',
    welcomeBack: 'Welcome back', welcomeSub: 'Sign in to your operations console.',
    emailLabel: 'Work email', passwordLabel: 'Password',
    signInButton: 'Sign in', signingIn: 'Signing in…',
    captureImageTitle: 'Capture image', uploadPrompt: 'Tap to upload image',
    categoryLabel: 'Category', batchIdLabel: 'Batch ID',
    reviewDetectionTitle: 'Review detection', totalCountLabel: 'Total count', detectedTypesLabel: 'Detected types',
    gpsTitle: 'Location', gpsEnable: 'Enable', gpsRefresh: 'Refresh',
    hashTitle: 'SHA-256 verification',
    clearButton: 'Clear', saveButton: 'Save signed scan', signing: 'Signing…',
    saveSuccess: 'Scan saved and signed successfully.',
    saveError: 'The scan could not be saved. Check your connection and retry.',
    saveValidation: 'Add a batch ID, verify an image, and confirm the count before saving.',
    dashboardTitle: 'Dashboard', refresh: 'Refresh',
    totalScans: 'Total scans', totalItems: 'Total items', todaysScans: 'Today’s scans', verification: 'Verification',
    historyTitle: 'Scan history', exportCsv: 'Export CSV',
    searchPlaceholder: 'Search batch ID, operator, category, hash…', allRecords: 'All records',
    settingsTitle: 'Settings', saveSettings: 'Save settings', saved: 'Saved',
    languageLabel: 'Language', systemOnline: 'System online', checkingSystem: 'Checking system',
  },
  km: {
    navScan: 'ស្កេនថ្មី', navScanSub: 'ថតកំណត់ត្រា',
    navDashboard: 'ផ្ទាំងគ្រប់គ្រង', navDashboardSub: 'ទិដ្ឋភាពទូទៅ',
    navHistory: 'ប្រវត្តិស្កេន', navHistorySub: 'កំណត់ត្រាមុន',
    navSettings: 'ការកំណត់', navSettingsSub: 'ចំណូលចិត្ត',
    signOut: 'ចេញ', fieldOperator: 'បុគ្គលិកវាល', adminView: 'ទិដ្ឋភាពអ្នកគ្រប់គ្រង',
    welcomeBack: 'សូមស្វាគមន៍មកវិញ', welcomeSub: 'ចូលប្រើប្រាស់កម្មវិធីប្រតិបត្តិការរបស់អ្នក។',
    emailLabel: 'អ៊ីមែលការងារ', passwordLabel: 'ពាក្យសម្ងាត់',
    signInButton: 'ចូលប្រើប្រាស់', signingIn: 'កំពុងចូល…',
    captureImageTitle: 'ថតរូបភាព', uploadPrompt: 'ចុចដើម្បីបញ្ចូលរូបភាព',
    categoryLabel: 'ប្រភេទ', batchIdLabel: 'លេខបាច់',
    reviewDetectionTitle: 'ពិនិត្យការរកឃើញ', totalCountLabel: 'ចំនួនសរុប', detectedTypesLabel: 'ប្រភេទដែលរកឃើញ',
    gpsTitle: 'ទីតាំង', gpsEnable: 'បើក', gpsRefresh: 'ធ្វើឱ្យស្រស់',
    hashTitle: 'ការផ្ទៀងផ្ទាត់ SHA-256',
    clearButton: 'សម្អាត', saveButton: 'រក្សាទុកកំណត់ត្រា', signing: 'កំពុងចុះហត្ថលេខា…',
    saveSuccess: 'បានរក្សាទុក និងចុះហត្ថលេខាដោយជោគជ័យ។',
    saveError: 'មិនអាចរក្សាទុកបានទេ។ សូមពិនិត្យការតភ្ជាប់ ហើយព្យាយាមម្តងទៀត។',
    saveValidation: 'សូមបញ្ចូលលេខបាច់ ផ្ទៀងផ្ទាត់រូបភាព និងបញ្ជាក់ចំនួន មុននឹងរក្សាទុក។',
    dashboardTitle: 'ផ្ទាំងគ្រប់គ្រង', refresh: 'ធ្វើឱ្យស្រស់',
    totalScans: 'ការស្កេនសរុប', totalItems: 'ធាតុសរុប', todaysScans: 'ការស្កេនថ្ងៃនេះ', verification: 'ការផ្ទៀងផ្ទាត់',
    historyTitle: 'ប្រវត្តិស្កេន', exportCsv: 'នាំចេញ CSV',
    searchPlaceholder: 'ស្វែងរកលេខបាច់ បុគ្គលិក ប្រភេទ hash…', allRecords: 'កំណត់ត្រាទាំងអស់',
    settingsTitle: 'ការកំណត់', saveSettings: 'រក្សាទុកការកំណត់', saved: 'បានរក្សាទុក',
    languageLabel: 'ភាសា', systemOnline: 'ប្រព័ន្ធអនឡាញ', checkingSystem: 'កំពុងពិនិត្យប្រព័ន្ធ',
  },
  zh: {
    navScan: '新扫描', navScanSub: '记录数据', navDashboard: '仪表板', navDashboardSub: '总览',
    navHistory: '扫描历史', navHistorySub: '历史记录', navSettings: '设置', navSettingsSub: '偏好设置',
    signOut: '退出登录', fieldOperator: '现场操作员', adminView: '管理员视图',
    welcomeBack: '欢迎回来', welcomeSub: '登录您的操作控制台。',
    emailLabel: '工作邮箱', passwordLabel: '密码', signInButton: '登录', signingIn: '登录中…',
    captureImageTitle: '拍摄图像', uploadPrompt: '点击上传图片',
    categoryLabel: '类别', batchIdLabel: '批次编号',
    reviewDetectionTitle: '检查检测结果', totalCountLabel: '总数量', detectedTypesLabel: '检测到的类型',
    gpsTitle: '位置', gpsEnable: '启用', gpsRefresh: '刷新', hashTitle: 'SHA-256 验证',
    clearButton: '清除', saveButton: '保存签名扫描', signing: '签名中…',
    saveSuccess: '扫描已成功保存并签名。',
    dashboardTitle: '仪表板', refresh: '刷新',
    totalScans: '扫描总数', totalItems: '项目总数', todaysScans: '今日扫描', verification: '验证',
    historyTitle: '扫描历史', exportCsv: '导出 CSV',
    searchPlaceholder: '搜索批次编号、操作员、类别、哈希…', allRecords: '所有记录',
    settingsTitle: '设置', saveSettings: '保存设置', saved: '已保存',
    languageLabel: '语言', systemOnline: '系统在线', checkingSystem: '正在检查系统',
  },
  ja: {
    navScan: '新規スキャン', navScanSub: '記録を取得', navDashboard: 'ダッシュボード', navDashboardSub: '概要',
    navHistory: 'スキャン履歴', navHistorySub: '過去の記録', navSettings: '設定', navSettingsSub: '環境設定',
    signOut: 'サインアウト', fieldOperator: 'フィールド担当者', adminView: '管理者ビュー',
    welcomeBack: 'おかえりなさい', welcomeSub: '操作コンソールにサインインしてください。',
    emailLabel: '業務用メール', passwordLabel: 'パスワード', signInButton: 'サインイン', signingIn: 'サインイン中…',
    captureImageTitle: '画像を撮影', uploadPrompt: 'タップして画像をアップロード',
    categoryLabel: 'カテゴリー', batchIdLabel: 'バッチID',
    reviewDetectionTitle: '検出結果を確認', totalCountLabel: '合計数', detectedTypesLabel: '検出された種類',
    gpsTitle: '位置情報', gpsEnable: '有効化', gpsRefresh: '更新', hashTitle: 'SHA-256 検証',
    clearButton: 'クリア', saveButton: '署名済みスキャンを保存', signing: '署名中…',
    saveSuccess: 'スキャンが正常に保存・署名されました。',
    dashboardTitle: 'ダッシュボード', refresh: '更新',
    totalScans: '合計スキャン数', totalItems: '合計アイテム数', todaysScans: '本日のスキャン', verification: '検証',
    historyTitle: 'スキャン履歴', exportCsv: 'CSVをエクスポート',
    searchPlaceholder: 'バッチID、担当者、カテゴリー、ハッシュを検索…', allRecords: 'すべての記録',
    settingsTitle: '設定', saveSettings: '設定を保存', saved: '保存済み',
    languageLabel: '言語', systemOnline: 'システム稼働中', checkingSystem: 'システム確認中',
  },
  ko: {
    navScan: '새 스캔', navScanSub: '기록 캡처', navDashboard: '대시보드', navDashboardSub: '개요',
    navHistory: '스캔 기록', navHistorySub: '이전 기록', navSettings: '설정', navSettingsSub: '환경설정',
    signOut: '로그아웃', fieldOperator: '현장 운영자', adminView: '관리자 보기',
    welcomeBack: '다시 오신 것을 환영합니다', welcomeSub: '운영 콘솔에 로그인하세요.',
    emailLabel: '업무용 이메일', passwordLabel: '비밀번호', signInButton: '로그인', signingIn: '로그인 중…',
    captureImageTitle: '이미지 캡처', uploadPrompt: '탭하여 이미지 업로드',
    categoryLabel: '카테고리', batchIdLabel: '배치 ID',
    reviewDetectionTitle: '감지 결과 검토', totalCountLabel: '총 개수', detectedTypesLabel: '감지된 유형',
    gpsTitle: '위치', gpsEnable: '활성화', gpsRefresh: '새로고침', hashTitle: 'SHA-256 검증',
    clearButton: '지우기', saveButton: '서명된 스캔 저장', signing: '서명 중…',
    saveSuccess: '스캔이 성공적으로 저장 및 서명되었습니다.',
    dashboardTitle: '대시보드', refresh: '새로고침',
    totalScans: '총 스캔 수', totalItems: '총 항목 수', todaysScans: '오늘의 스캔', verification: '검증',
    historyTitle: '스캔 기록', exportCsv: 'CSV 내보내기',
    searchPlaceholder: '배치 ID, 운영자, 카테고리, 해시 검색…', allRecords: '모든 기록',
    settingsTitle: '설정', saveSettings: '설정 저장', saved: '저장됨',
    languageLabel: '언어', systemOnline: '시스템 온라인', checkingSystem: '시스템 확인 중',
  },
  th: {
    navScan: 'สแกนใหม่', navScanSub: 'บันทึกข้อมูล', navDashboard: 'แดชบอร์ด', navDashboardSub: 'ภาพรวม',
    navHistory: 'ประวัติการสแกน', navHistorySub: 'บันทึกก่อนหน้า', navSettings: 'การตั้งค่า', navSettingsSub: 'ค่ากำหนด',
    signOut: 'ออกจากระบบ', fieldOperator: 'เจ้าหน้าที่ภาคสนาม', adminView: 'มุมมองผู้ดูแลระบบ',
    welcomeBack: 'ยินดีต้อนรับกลับ', welcomeSub: 'เข้าสู่ระบบคอนโซลปฏิบัติการของคุณ',
    emailLabel: 'อีเมลที่ทำงาน', passwordLabel: 'รหัสผ่าน', signInButton: 'เข้าสู่ระบบ', signingIn: 'กำลังเข้าสู่ระบบ…',
    captureImageTitle: 'ถ่ายภาพ', uploadPrompt: 'แตะเพื่ออัปโหลดรูปภาพ',
    categoryLabel: 'หมวดหมู่', batchIdLabel: 'รหัสชุด',
    reviewDetectionTitle: 'ตรวจสอบการตรวจจับ', totalCountLabel: 'จำนวนรวม', detectedTypesLabel: 'ประเภทที่ตรวจพบ',
    gpsTitle: 'ตำแหน่งที่ตั้ง', gpsEnable: 'เปิดใช้งาน', gpsRefresh: 'รีเฟรช', hashTitle: 'การยืนยัน SHA-256',
    clearButton: 'ล้าง', saveButton: 'บันทึกการสแกนที่ลงนามแล้ว', signing: 'กำลังลงนาม…',
    saveSuccess: 'บันทึกและลงนามการสแกนสำเร็จแล้ว',
    dashboardTitle: 'แดชบอร์ด', refresh: 'รีเฟรช',
    totalScans: 'จำนวนสแกนทั้งหมด', totalItems: 'จำนวนรายการทั้งหมด', todaysScans: 'การสแกนวันนี้', verification: 'การยืนยัน',
    historyTitle: 'ประวัติการสแกน', exportCsv: 'ส่งออก CSV',
    searchPlaceholder: 'ค้นหารหัสชุด ผู้ปฏิบัติงาน หมวดหมู่ แฮช…', allRecords: 'บันทึกทั้งหมด',
    settingsTitle: 'การตั้งค่า', saveSettings: 'บันทึกการตั้งค่า', saved: 'บันทึกแล้ว',
    languageLabel: 'ภาษา', systemOnline: 'ระบบออนไลน์', checkingSystem: 'กำลังตรวจสอบระบบ',
  },
  vi: {
    navScan: 'Quét mới', navScanSub: 'Ghi lại dữ liệu', navDashboard: 'Bảng điều khiển', navDashboardSub: 'Tổng quan',
    navHistory: 'Lịch sử quét', navHistorySub: 'Bản ghi trước đây', navSettings: 'Cài đặt', navSettingsSub: 'Tùy chọn',
    signOut: 'Đăng xuất', fieldOperator: 'Nhân viên hiện trường', adminView: 'Chế độ xem quản trị',
    welcomeBack: 'Chào mừng trở lại', welcomeSub: 'Đăng nhập vào bảng điều khiển vận hành của bạn.',
    emailLabel: 'Email công việc', passwordLabel: 'Mật khẩu', signInButton: 'Đăng nhập', signingIn: 'Đang đăng nhập…',
    captureImageTitle: 'Chụp ảnh', uploadPrompt: 'Nhấn để tải ảnh lên',
    categoryLabel: 'Danh mục', batchIdLabel: 'Mã lô',
    reviewDetectionTitle: 'Xem lại kết quả phát hiện', totalCountLabel: 'Tổng số lượng', detectedTypesLabel: 'Loại được phát hiện',
    gpsTitle: 'Vị trí', gpsEnable: 'Bật', gpsRefresh: 'Làm mới', hashTitle: 'Xác minh SHA-256',
    clearButton: 'Xóa', saveButton: 'Lưu bản quét đã ký', signing: 'Đang ký…',
    saveSuccess: 'Đã lưu và ký bản quét thành công.',
    dashboardTitle: 'Bảng điều khiển', refresh: 'Làm mới',
    totalScans: 'Tổng số lượt quét', totalItems: 'Tổng số mục', todaysScans: 'Lượt quét hôm nay', verification: 'Xác minh',
    historyTitle: 'Lịch sử quét', exportCsv: 'Xuất CSV',
    searchPlaceholder: 'Tìm mã lô, người vận hành, danh mục, mã băm…', allRecords: 'Tất cả bản ghi',
    settingsTitle: 'Cài đặt', saveSettings: 'Lưu cài đặt', saved: 'Đã lưu',
    languageLabel: 'Ngôn ngữ', systemOnline: 'Hệ thống trực tuyến', checkingSystem: 'Đang kiểm tra hệ thống',
  },
  lo: {
    navScan: 'ສະແກນໃໝ່', navScanSub: 'ບັນທຶກຂໍ້ມູນ', navDashboard: 'ແດຊບອດ', navDashboardSub: 'ພາບລວມ',
    navHistory: 'ປະຫວັດການສະແກນ', navHistorySub: 'ບັນທຶກກ່ອນໜ້າ', navSettings: 'ການຕັ້ງຄ່າ', navSettingsSub: 'ຄວາມມັກ',
    signOut: 'ອອກຈາກລະບົບ', fieldOperator: 'ພະນັກງານພາກສະໜາມ', adminView: 'ມຸມມອງຜູ້ດູແລລະບົບ',
    welcomeBack: 'ຍິນດີຕ້ອນຮັບກັບຄືນ', welcomeSub: 'ເຂົ້າສູ່ລະບົບຄອນໂຊນປະຕິບັດງານຂອງທ່ານ.',
    emailLabel: 'ອີເມວບ່ອນເຮັດວຽກ', passwordLabel: 'ລະຫັດຜ່ານ', signInButton: 'ເຂົ້າສູ່ລະບົບ', signingIn: 'ກຳລັງເຂົ້າສູ່ລະບົບ…',
    captureImageTitle: 'ຖ່າຍຮູບ', uploadPrompt: 'ແຕະເພື່ອອັບໂຫລດຮູບ',
    categoryLabel: 'ໝວດໝູ່', batchIdLabel: 'ລະຫັດຊຸດ',
    reviewDetectionTitle: 'ກວດສອບການກວດຈັບ', totalCountLabel: 'ຈຳນວນທັງໝົດ', detectedTypesLabel: 'ປະເພດທີ່ກວດພົບ',
    gpsTitle: 'ສະຖານທີ່', gpsEnable: 'ເປີດໃຊ້', gpsRefresh: 'ໂຫລດຄືນໃໝ່', hashTitle: 'ການຢືນຢັນ SHA-256',
    clearButton: 'ລ້າງ', saveButton: 'ບັນທຶກການສະແກນທີ່ເຊັນແລ້ວ', signing: 'ກຳລັງເຊັນ…',
    saveSuccess: 'ບັນທຶກ ແລະ ເຊັນການສະແກນສຳເລັດແລ້ວ.',
    dashboardTitle: 'ແດຊບອດ', refresh: 'ໂຫລດຄືນໃໝ່',
    totalScans: 'ຈຳນວນສະແກນທັງໝົດ', totalItems: 'ຈຳນວນລາຍການທັງໝົດ', todaysScans: 'ການສະແກນມື້ນີ້', verification: 'ການຢືນຢັນ',
    historyTitle: 'ປະຫວັດການສະແກນ', exportCsv: 'ສົ່ງອອກ CSV',
    searchPlaceholder: 'ຄົ້ນຫາລະຫັດຊຸດ, ພະນັກງານ, ໝວດໝູ່, ແຮັຊ…', allRecords: 'ບັນທຶກທັງໝົດ',
    settingsTitle: 'ການຕັ້ງຄ່າ', saveSettings: 'ບັນທຶກການຕັ້ງຄ່າ', saved: 'ບັນທຶກແລ້ວ',
    languageLabel: 'ພາສາ', systemOnline: 'ລະບົບອອນລາຍ', checkingSystem: 'ກຳລັງກວດສອບລະບົບ',
  },
  my: {
    navScan: 'စကင်အသစ်', navScanSub: 'မှတ်တမ်းယူရန်', navDashboard: 'ဒက်ရှ်ဘုတ်', navDashboardSub: 'ခြုံငုံသုံးသပ်ချက်',
    navHistory: 'စကင်မှတ်တမ်း', navHistorySub: 'ယခင်မှတ်တမ်းများ', navSettings: 'ဆက်တင်များ', navSettingsSub: 'နှစ်သက်ရာများ',
    signOut: 'ထွက်မည်', fieldOperator: 'မြေပြင်လုပ်သား', adminView: 'စီမံခန့်ခွဲသူမြင်ကွင်း',
    welcomeBack: 'ပြန်လည်ကြိုဆိုပါသည်', welcomeSub: 'သင့်လုပ်ငန်းစနစ်သို့ ဝင်ရောက်ပါ။',
    emailLabel: 'အလုပ်အီးမေးလ်', passwordLabel: 'စကားဝှက်', signInButton: 'ဝင်ရောက်ရန်', signingIn: 'ဝင်ရောက်နေသည်…',
    captureImageTitle: 'ပုံရိုက်ရန်', uploadPrompt: 'ပုံတင်ရန် နှိပ်ပါ',
    categoryLabel: 'အမျိုးအစား', batchIdLabel: 'အသုတ်နံပါတ်',
    reviewDetectionTitle: 'စစ်ဆေးတွေ့ရှိမှုကို ပြန်စစ်ပါ', totalCountLabel: 'စုစုပေါင်းအရေအတွက်', detectedTypesLabel: 'တွေ့ရှိသောအမျိုးအစားများ',
    gpsTitle: 'တည်နေရာ', gpsEnable: 'ဖွင့်ရန်', gpsRefresh: 'ပြန်လည်စတင်ရန်', hashTitle: 'SHA-256 အတည်ပြုချက်',
    clearButton: 'ရှင်းလင်းရန်', saveButton: 'လက်မှတ်ရေးထိုးထားသောစကင်ကို သိမ်းရန်', signing: 'လက်မှတ်ရေးနေသည်…',
    saveSuccess: 'စကင်ကို အောင်မြင်စွာ သိမ်းဆည်းပြီး လက်မှတ်ရေးထိုးပြီးပါပြီ။',
    dashboardTitle: 'ဒက်ရှ်ဘုတ်', refresh: 'ပြန်လည်စတင်ရန်',
    totalScans: 'စုစုပေါင်းစကင်အရေအတွက်', totalItems: 'စုစုပေါင်းအရာဝတ္ထုအရေအတွက်', todaysScans: 'ယနေ့စကင်များ', verification: 'အတည်ပြုချက်',
    historyTitle: 'စကင်မှတ်တမ်း', exportCsv: 'CSV ထုတ်ယူရန်',
    searchPlaceholder: 'အသုတ်နံပါတ်၊ လုပ်သား၊ အမျိုးအစား၊ ဟက်ရှ်ကို ရှာပါ…', allRecords: 'မှတ်တမ်းအားလုံး',
    settingsTitle: 'ဆက်တင်များ', saveSettings: 'ဆက်တင်များ သိမ်းရန်', saved: 'သိမ်းပြီး',
    languageLabel: 'ဘာသာစကား', systemOnline: 'စနစ်အွန်လိုင်း', checkingSystem: 'စနစ်စစ်ဆေးနေသည်',
  },
  id: {
    navScan: 'Pindaian baru', navScanSub: 'Rekam data', navDashboard: 'Dasbor', navDashboardSub: 'Ringkasan',
    navHistory: 'Riwayat pindaian', navHistorySub: 'Catatan sebelumnya', navSettings: 'Pengaturan', navSettingsSub: 'Preferensi',
    signOut: 'Keluar', fieldOperator: 'Petugas lapangan', adminView: 'Tampilan admin',
    welcomeBack: 'Selamat datang kembali', welcomeSub: 'Masuk ke konsol operasi Anda.',
    emailLabel: 'Email kerja', passwordLabel: 'Kata sandi', signInButton: 'Masuk', signingIn: 'Sedang masuk…',
    captureImageTitle: 'Ambil gambar', uploadPrompt: 'Ketuk untuk mengunggah gambar',
    categoryLabel: 'Kategori', batchIdLabel: 'ID Batch',
    reviewDetectionTitle: 'Tinjau deteksi', totalCountLabel: 'Jumlah total', detectedTypesLabel: 'Jenis yang terdeteksi',
    gpsTitle: 'Lokasi', gpsEnable: 'Aktifkan', gpsRefresh: 'Segarkan', hashTitle: 'Verifikasi SHA-256',
    clearButton: 'Hapus', saveButton: 'Simpan pindaian bertanda tangan', signing: 'Menandatangani…',
    saveSuccess: 'Pindaian berhasil disimpan dan ditandatangani.',
    dashboardTitle: 'Dasbor', refresh: 'Segarkan',
    totalScans: 'Total pindaian', totalItems: 'Total item', todaysScans: 'Pindaian hari ini', verification: 'Verifikasi',
    historyTitle: 'Riwayat pindaian', exportCsv: 'Ekspor CSV',
    searchPlaceholder: 'Cari ID batch, operator, kategori, hash…', allRecords: 'Semua catatan',
    settingsTitle: 'Pengaturan', saveSettings: 'Simpan pengaturan', saved: 'Tersimpan',
    languageLabel: 'Bahasa', systemOnline: 'Sistem daring', checkingSystem: 'Memeriksa sistem',
  },
  ms: {
    navScan: 'Imbasan baharu', navScanSub: 'Rakam rekod', navDashboard: 'Papan pemuka', navDashboardSub: 'Gambaran keseluruhan',
    navHistory: 'Sejarah imbasan', navHistorySub: 'Rekod lepas', navSettings: 'Tetapan', navSettingsSub: 'Keutamaan',
    signOut: 'Log keluar', fieldOperator: 'Operator lapangan', adminView: 'Paparan admin',
    welcomeBack: 'Selamat kembali', welcomeSub: 'Log masuk ke konsol operasi anda.',
    emailLabel: 'E-mel kerja', passwordLabel: 'Kata laluan', signInButton: 'Log masuk', signingIn: 'Sedang log masuk…',
    captureImageTitle: 'Tangkap imej', uploadPrompt: 'Ketik untuk muat naik imej',
    categoryLabel: 'Kategori', batchIdLabel: 'ID Kelompok',
    reviewDetectionTitle: 'Semak pengesanan', totalCountLabel: 'Jumlah keseluruhan', detectedTypesLabel: 'Jenis dikesan',
    gpsTitle: 'Lokasi', gpsEnable: 'Dayakan', gpsRefresh: 'Muat semula', hashTitle: 'Pengesahan SHA-256',
    clearButton: 'Kosongkan', saveButton: 'Simpan imbasan bertandatangan', signing: 'Menandatangani…',
    saveSuccess: 'Imbasan berjaya disimpan dan ditandatangani.',
    dashboardTitle: 'Papan pemuka', refresh: 'Muat semula',
    totalScans: 'Jumlah imbasan', totalItems: 'Jumlah item', todaysScans: 'Imbasan hari ini', verification: 'Pengesahan',
    historyTitle: 'Sejarah imbasan', exportCsv: 'Eksport CSV',
    searchPlaceholder: 'Cari ID kelompok, operator, kategori, hash…', allRecords: 'Semua rekod',
    settingsTitle: 'Tetapan', saveSettings: 'Simpan tetapan', saved: 'Disimpan',
    languageLabel: 'Bahasa', systemOnline: 'Sistem dalam talian', checkingSystem: 'Menyemak sistem',
  },
  tl: {
    navScan: 'Bagong scan', navScanSub: 'Kunan ng rekord', navDashboard: 'Dashboard', navDashboardSub: 'Pangkalahatang-ideya',
    navHistory: 'Kasaysayan ng scan', navHistorySub: 'Mga naunang rekord', navSettings: 'Mga setting', navSettingsSub: 'Mga kagustuhan',
    signOut: 'Mag-sign out', fieldOperator: 'Field operator', adminView: 'View ng admin',
    welcomeBack: 'Maligayang pagbabalik', welcomeSub: 'Mag-sign in sa iyong operations console.',
    emailLabel: 'Email sa trabaho', passwordLabel: 'Password', signInButton: 'Mag-sign in', signingIn: 'Nagsa-sign in…',
    captureImageTitle: 'Kumuha ng larawan', uploadPrompt: 'I-tap para mag-upload ng larawan',
    categoryLabel: 'Kategorya', batchIdLabel: 'Batch ID',
    reviewDetectionTitle: 'Suriin ang detection', totalCountLabel: 'Kabuuang bilang', detectedTypesLabel: 'Nakitang uri',
    gpsTitle: 'Lokasyon', gpsEnable: 'I-enable', gpsRefresh: 'I-refresh', hashTitle: 'SHA-256 verification',
    clearButton: 'I-clear', saveButton: 'I-save ang nilagdaang scan', signing: 'Nilalagdaan…',
    saveSuccess: 'Matagumpay na na-save at nalagdaan ang scan.',
    dashboardTitle: 'Dashboard', refresh: 'I-refresh',
    totalScans: 'Kabuuang scan', totalItems: 'Kabuuang item', todaysScans: 'Scan ngayong araw', verification: 'Verification',
    historyTitle: 'Kasaysayan ng scan', exportCsv: 'I-export ang CSV',
    searchPlaceholder: 'Hanapin ang batch ID, operator, kategorya, hash…', allRecords: 'Lahat ng rekord',
    settingsTitle: 'Mga setting', saveSettings: 'I-save ang mga setting', saved: 'Na-save',
    languageLabel: 'Wika', systemOnline: 'Online ang sistema', checkingSystem: 'Sinusuri ang sistema',
  },
  hi: {
    navScan: 'नया स्कैन', navScanSub: 'रिकॉर्ड कैप्चर करें', navDashboard: 'डैशबोर्ड', navDashboardSub: 'अवलोकन',
    navHistory: 'स्कैन इतिहास', navHistorySub: 'पिछले रिकॉर्ड', navSettings: 'सेटिंग्स', navSettingsSub: 'प्राथमिकताएँ',
    signOut: 'साइन आउट करें', fieldOperator: 'फील्ड ऑपरेटर', adminView: 'व्यवस्थापक दृश्य',
    welcomeBack: 'वापसी पर स्वागत है', welcomeSub: 'अपने ऑपरेशन कंसोल में साइन इन करें।',
    emailLabel: 'कार्य ईमेल', passwordLabel: 'पासवर्ड', signInButton: 'साइन इन करें', signingIn: 'साइन इन हो रहा है…',
    captureImageTitle: 'छवि कैप्चर करें', uploadPrompt: 'छवि अपलोड करने के लिए टैप करें',
    categoryLabel: 'श्रेणी', batchIdLabel: 'बैच आईडी',
    reviewDetectionTitle: 'पहचान की समीक्षा करें', totalCountLabel: 'कुल गणना', detectedTypesLabel: 'पहचाने गए प्रकार',
    gpsTitle: 'स्थान', gpsEnable: 'सक्षम करें', gpsRefresh: 'रीफ्रेश करें', hashTitle: 'SHA-256 सत्यापन',
    clearButton: 'साफ़ करें', saveButton: 'हस्ताक्षरित स्कैन सहेजें', signing: 'हस्ताक्षर हो रहे हैं…',
    saveSuccess: 'स्कैन सफलतापूर्वक सहेजा और हस्ताक्षरित किया गया।',
    dashboardTitle: 'डैशबोर्ड', refresh: 'रीफ्रेश करें',
    totalScans: 'कुल स्कैन', totalItems: 'कुल आइटम', todaysScans: 'आज के स्कैन', verification: 'सत्यापन',
    historyTitle: 'स्कैन इतिहास', exportCsv: 'CSV निर्यात करें',
    searchPlaceholder: 'बैच आईडी, ऑपरेटर, श्रेणी, हैश खोजें…', allRecords: 'सभी रिकॉर्ड',
    settingsTitle: 'सेटिंग्स', saveSettings: 'सेटिंग्स सहेजें', saved: 'सहेजा गया',
    languageLabel: 'भाषा', systemOnline: 'सिस्टम ऑनलाइन है', checkingSystem: 'सिस्टम की जाँच हो रही है',
  },
  bn: {
    navScan: 'নতুন স্ক্যান', navScanSub: 'রেকর্ড ক্যাপচার করুন', navDashboard: 'ড্যাশবোর্ড', navDashboardSub: 'সারসংক্ষেপ',
    navHistory: 'স্ক্যান ইতিহাস', navHistorySub: 'পূর্ববর্তী রেকর্ড', navSettings: 'সেটিংস', navSettingsSub: 'পছন্দসমূহ',
    signOut: 'সাইন আউট', fieldOperator: 'ফিল্ড অপারেটর', adminView: 'অ্যাডমিন ভিউ',
    welcomeBack: 'ফিরে আসার জন্য স্বাগতম', welcomeSub: 'আপনার অপারেশন কনসোলে সাইন ইন করুন।',
    emailLabel: 'কর্মস্থলের ইমেইল', passwordLabel: 'পাসওয়ার্ড', signInButton: 'সাইন ইন করুন', signingIn: 'সাইন ইন হচ্ছে…',
    captureImageTitle: 'ছবি ক্যাপচার করুন', uploadPrompt: 'ছবি আপলোড করতে ট্যাপ করুন',
    categoryLabel: 'বিভাগ', batchIdLabel: 'ব্যাচ আইডি',
    reviewDetectionTitle: 'সনাক্তকরণ পর্যালোচনা করুন', totalCountLabel: 'মোট সংখ্যা', detectedTypesLabel: 'সনাক্তকৃত ধরন',
    gpsTitle: 'অবস্থান', gpsEnable: 'সক্ষম করুন', gpsRefresh: 'রিফ্রেশ করুন', hashTitle: 'SHA-256 যাচাইকরণ',
    clearButton: 'সাফ করুন', saveButton: 'স্বাক্ষরিত স্ক্যান সংরক্ষণ করুন', signing: 'স্বাক্ষর হচ্ছে…',
    saveSuccess: 'স্ক্যান সফলভাবে সংরক্ষিত এবং স্বাক্ষরিত হয়েছে।',
    dashboardTitle: 'ড্যাশবোর্ড', refresh: 'রিফ্রেশ করুন',
    totalScans: 'মোট স্ক্যান', totalItems: 'মোট আইটেম', todaysScans: 'আজকের স্ক্যান', verification: 'যাচাইকরণ',
    historyTitle: 'স্ক্যান ইতিহাস', exportCsv: 'CSV এক্সপোর্ট করুন',
    searchPlaceholder: 'ব্যাচ আইডি, অপারেটর, বিভাগ, হ্যাশ খুঁজুন…', allRecords: 'সব রেকর্ড',
    settingsTitle: 'সেটিংস', saveSettings: 'সেটিংস সংরক্ষণ করুন', saved: 'সংরক্ষিত',
    languageLabel: 'ভাষা', systemOnline: 'সিস্টেম অনলাইন', checkingSystem: 'সিস্টেম পরীক্ষা করা হচ্ছে',
  },
  fr: {
    navScan: 'Nouveau scan', navScanSub: 'Enregistrer une donnée', navDashboard: 'Tableau de bord', navDashboardSub: 'Aperçu',
    navHistory: 'Historique des scans', navHistorySub: 'Enregistrements passés', navSettings: 'Paramètres', navSettingsSub: 'Préférences',
    signOut: 'Déconnexion', fieldOperator: 'Opérateur de terrain', adminView: 'Vue administrateur',
    welcomeBack: 'Content de vous revoir', welcomeSub: 'Connectez-vous à votre console d’opérations.',
    emailLabel: 'E-mail professionnel', passwordLabel: 'Mot de passe', signInButton: 'Se connecter', signingIn: 'Connexion…',
    captureImageTitle: 'Capturer une image', uploadPrompt: 'Appuyez pour téléverser une image',
    categoryLabel: 'Catégorie', batchIdLabel: 'ID du lot',
    reviewDetectionTitle: 'Vérifier la détection', totalCountLabel: 'Nombre total', detectedTypesLabel: 'Types détectés',
    gpsTitle: 'Emplacement', gpsEnable: 'Activer', gpsRefresh: 'Actualiser', hashTitle: 'Vérification SHA-256',
    clearButton: 'Effacer', saveButton: 'Enregistrer le scan signé', signing: 'Signature en cours…',
    saveSuccess: 'Scan enregistré et signé avec succès.',
    dashboardTitle: 'Tableau de bord', refresh: 'Actualiser',
    totalScans: 'Total des scans', totalItems: 'Total des éléments', todaysScans: 'Scans du jour', verification: 'Vérification',
    historyTitle: 'Historique des scans', exportCsv: 'Exporter en CSV',
    searchPlaceholder: 'Rechercher ID de lot, opérateur, catégorie, hash…', allRecords: 'Tous les enregistrements',
    settingsTitle: 'Paramètres', saveSettings: 'Enregistrer les paramètres', saved: 'Enregistré',
    languageLabel: 'Langue', systemOnline: 'Système en ligne', checkingSystem: 'Vérification du système',
  },
  de: {
    navScan: 'Neuer Scan', navScanSub: 'Datensatz erfassen', navDashboard: 'Dashboard', navDashboardSub: 'Übersicht',
    navHistory: 'Scan-Verlauf', navHistorySub: 'Frühere Datensätze', navSettings: 'Einstellungen', navSettingsSub: 'Präferenzen',
    signOut: 'Abmelden', fieldOperator: 'Außendienstmitarbeiter', adminView: 'Administratoransicht',
    welcomeBack: 'Willkommen zurück', welcomeSub: 'Melden Sie sich bei Ihrer Betriebskonsole an.',
    emailLabel: 'Geschäftliche E-Mail', passwordLabel: 'Passwort', signInButton: 'Anmelden', signingIn: 'Anmeldung läuft…',
    captureImageTitle: 'Bild aufnehmen', uploadPrompt: 'Zum Hochladen eines Bildes tippen',
    categoryLabel: 'Kategorie', batchIdLabel: 'Chargen-ID',
    reviewDetectionTitle: 'Erkennung überprüfen', totalCountLabel: 'Gesamtanzahl', detectedTypesLabel: 'Erkannte Typen',
    gpsTitle: 'Standort', gpsEnable: 'Aktivieren', gpsRefresh: 'Aktualisieren', hashTitle: 'SHA-256-Verifizierung',
    clearButton: 'Löschen', saveButton: 'Signierten Scan speichern', signing: 'Wird signiert…',
    saveSuccess: 'Scan erfolgreich gespeichert und signiert.',
    dashboardTitle: 'Dashboard', refresh: 'Aktualisieren',
    totalScans: 'Scans gesamt', totalItems: 'Elemente gesamt', todaysScans: 'Heutige Scans', verification: 'Verifizierung',
    historyTitle: 'Scan-Verlauf', exportCsv: 'CSV exportieren',
    searchPlaceholder: 'Chargen-ID, Bediener, Kategorie, Hash suchen…', allRecords: 'Alle Datensätze',
    settingsTitle: 'Einstellungen', saveSettings: 'Einstellungen speichern', saved: 'Gespeichert',
    languageLabel: 'Sprache', systemOnline: 'System online', checkingSystem: 'System wird überprüft',
  },
  es: {
    navScan: 'Nuevo escaneo', navScanSub: 'Capturar un registro', navDashboard: 'Panel de control', navDashboardSub: 'Resumen',
    navHistory: 'Historial de escaneos', navHistorySub: 'Registros anteriores', navSettings: 'Configuración', navSettingsSub: 'Preferencias',
    signOut: 'Cerrar sesión', fieldOperator: 'Operador de campo', adminView: 'Vista de administrador',
    welcomeBack: 'Bienvenido de nuevo', welcomeSub: 'Inicia sesión en tu consola de operaciones.',
    emailLabel: 'Correo del trabajo', passwordLabel: 'Contraseña', signInButton: 'Iniciar sesión', signingIn: 'Iniciando sesión…',
    captureImageTitle: 'Capturar imagen', uploadPrompt: 'Toca para subir una imagen',
    categoryLabel: 'Categoría', batchIdLabel: 'ID de lote',
    reviewDetectionTitle: 'Revisar detección', totalCountLabel: 'Cantidad total', detectedTypesLabel: 'Tipos detectados',
    gpsTitle: 'Ubicación', gpsEnable: 'Activar', gpsRefresh: 'Actualizar', hashTitle: 'Verificación SHA-256',
    clearButton: 'Borrar', saveButton: 'Guardar escaneo firmado', signing: 'Firmando…',
    saveSuccess: 'Escaneo guardado y firmado con éxito.',
    dashboardTitle: 'Panel de control', refresh: 'Actualizar',
    totalScans: 'Total de escaneos', totalItems: 'Total de elementos', todaysScans: 'Escaneos de hoy', verification: 'Verificación',
    historyTitle: 'Historial de escaneos', exportCsv: 'Exportar CSV',
    searchPlaceholder: 'Buscar ID de lote, operador, categoría, hash…', allRecords: 'Todos los registros',
    settingsTitle: 'Configuración', saveSettings: 'Guardar configuración', saved: 'Guardado',
    languageLabel: 'Idioma', systemOnline: 'Sistema en línea', checkingSystem: 'Comprobando el sistema',
  },
  it: {
    navScan: 'Nuova scansione', navScanSub: 'Acquisisci un record', navDashboard: 'Dashboard', navDashboardSub: 'Panoramica',
    navHistory: 'Cronologia scansioni', navHistorySub: 'Record precedenti', navSettings: 'Impostazioni', navSettingsSub: 'Preferenze',
    signOut: 'Disconnetti', fieldOperator: 'Operatore sul campo', adminView: 'Vista amministratore',
    welcomeBack: 'Bentornato', welcomeSub: 'Accedi alla tua console operativa.',
    emailLabel: 'E-mail di lavoro', passwordLabel: 'Password', signInButton: 'Accedi', signingIn: 'Accesso in corso…',
    captureImageTitle: 'Acquisisci immagine', uploadPrompt: 'Tocca per caricare un’immagine',
    categoryLabel: 'Categoria', batchIdLabel: 'ID lotto',
    reviewDetectionTitle: 'Rivedi il rilevamento', totalCountLabel: 'Conteggio totale', detectedTypesLabel: 'Tipi rilevati',
    gpsTitle: 'Posizione', gpsEnable: 'Attiva', gpsRefresh: 'Aggiorna', hashTitle: 'Verifica SHA-256',
    clearButton: 'Cancella', saveButton: 'Salva scansione firmata', signing: 'Firma in corso…',
    saveSuccess: 'Scansione salvata e firmata con successo.',
    dashboardTitle: 'Dashboard', refresh: 'Aggiorna',
    totalScans: 'Totale scansioni', totalItems: 'Totale elementi', todaysScans: 'Scansioni di oggi', verification: 'Verifica',
    historyTitle: 'Cronologia scansioni', exportCsv: 'Esporta CSV',
    searchPlaceholder: 'Cerca ID lotto, operatore, categoria, hash…', allRecords: 'Tutti i record',
    settingsTitle: 'Impostazioni', saveSettings: 'Salva impostazioni', saved: 'Salvato',
    languageLabel: 'Lingua', systemOnline: 'Sistema online', checkingSystem: 'Controllo del sistema in corso',
  },
  pt: {
    navScan: 'Nova digitalização', navScanSub: 'Capturar registro', navDashboard: 'Painel', navDashboardSub: 'Visão geral',
    navHistory: 'Histórico de digitalizações', navHistorySub: 'Registros anteriores', navSettings: 'Configurações', navSettingsSub: 'Preferências',
    signOut: 'Sair', fieldOperator: 'Operador de campo', adminView: 'Visão de administrador',
    welcomeBack: 'Bem-vindo de volta', welcomeSub: 'Entre no seu console de operações.',
    emailLabel: 'E-mail de trabalho', passwordLabel: 'Senha', signInButton: 'Entrar', signingIn: 'Entrando…',
    captureImageTitle: 'Capturar imagem', uploadPrompt: 'Toque para enviar uma imagem',
    categoryLabel: 'Categoria', batchIdLabel: 'ID do lote',
    reviewDetectionTitle: 'Revisar detecção', totalCountLabel: 'Contagem total', detectedTypesLabel: 'Tipos detectados',
    gpsTitle: 'Localização', gpsEnable: 'Ativar', gpsRefresh: 'Atualizar', hashTitle: 'Verificação SHA-256',
    clearButton: 'Limpar', saveButton: 'Salvar digitalização assinada', signing: 'Assinando…',
    saveSuccess: 'Digitalização salva e assinada com sucesso.',
    dashboardTitle: 'Painel', refresh: 'Atualizar',
    totalScans: 'Total de digitalizações', totalItems: 'Total de itens', todaysScans: 'Digitalizações de hoje', verification: 'Verificação',
    historyTitle: 'Histórico de digitalizações', exportCsv: 'Exportar CSV',
    searchPlaceholder: 'Pesquisar ID do lote, operador, categoria, hash…', allRecords: 'Todos os registros',
    settingsTitle: 'Configurações', saveSettings: 'Salvar configurações', saved: 'Salvo',
    languageLabel: 'Idioma', systemOnline: 'Sistema on-line', checkingSystem: 'Verificando o sistema',
  },
  ru: {
    navScan: 'Новое сканирование', navScanSub: 'Зафиксировать запись', navDashboard: 'Панель управления', navDashboardSub: 'Обзор',
    navHistory: 'История сканирований', navHistorySub: 'Прошлые записи', navSettings: 'Настройки', navSettingsSub: 'Предпочтения',
    signOut: 'Выйти', fieldOperator: 'Полевой оператор', adminView: 'Вид администратора',
    welcomeBack: 'С возвращением', welcomeSub: 'Войдите в консоль операций.',
    emailLabel: 'Рабочая почта', passwordLabel: 'Пароль', signInButton: 'Войти', signingIn: 'Вход…',
    captureImageTitle: 'Сделать снимок', uploadPrompt: 'Нажмите, чтобы загрузить изображение',
    categoryLabel: 'Категория', batchIdLabel: 'ID партии',
    reviewDetectionTitle: 'Проверить обнаружение', totalCountLabel: 'Общее количество', detectedTypesLabel: 'Обнаруженные типы',
    gpsTitle: 'Местоположение', gpsEnable: 'Включить', gpsRefresh: 'Обновить', hashTitle: 'Проверка SHA-256',
    clearButton: 'Очистить', saveButton: 'Сохранить подписанное сканирование', signing: 'Подписание…',
    saveSuccess: 'Сканирование успешно сохранено и подписано.',
    dashboardTitle: 'Панель управления', refresh: 'Обновить',
    totalScans: 'Всего сканирований', totalItems: 'Всего элементов', todaysScans: 'Сегодняшние сканирования', verification: 'Проверка',
    historyTitle: 'История сканирований', exportCsv: 'Экспортировать CSV',
    searchPlaceholder: 'Поиск по ID партии, оператору, категории, хешу…', allRecords: 'Все записи',
    settingsTitle: 'Настройки', saveSettings: 'Сохранить настройки', saved: 'Сохранено',
    languageLabel: 'Язык', systemOnline: 'Система онлайн', checkingSystem: 'Проверка системы',
  },
  nl: {
    navScan: 'Nieuwe scan', navScanSub: 'Registratie vastleggen', navDashboard: 'Dashboard', navDashboardSub: 'Overzicht',
    navHistory: 'Scangeschiedenis', navHistorySub: 'Eerdere registraties', navSettings: 'Instellingen', navSettingsSub: 'Voorkeuren',
    signOut: 'Afmelden', fieldOperator: 'Veldoperator', adminView: 'Beheerdersweergave',
    welcomeBack: 'Welkom terug', welcomeSub: 'Log in op je operationele console.',
    emailLabel: 'Werk-e-mail', passwordLabel: 'Wachtwoord', signInButton: 'Inloggen', signingIn: 'Bezig met inloggen…',
    captureImageTitle: 'Afbeelding vastleggen', uploadPrompt: 'Tik om een afbeelding te uploaden',
    categoryLabel: 'Categorie', batchIdLabel: 'Batch-ID',
    reviewDetectionTitle: 'Detectie controleren', totalCountLabel: 'Totaal aantal', detectedTypesLabel: 'Gedetecteerde typen',
    gpsTitle: 'Locatie', gpsEnable: 'Inschakelen', gpsRefresh: 'Vernieuwen', hashTitle: 'SHA-256-verificatie',
    clearButton: 'Wissen', saveButton: 'Ondertekende scan opslaan', signing: 'Bezig met ondertekenen…',
    saveSuccess: 'Scan succesvol opgeslagen en ondertekend.',
    dashboardTitle: 'Dashboard', refresh: 'Vernieuwen',
    totalScans: 'Totaal aantal scans', totalItems: 'Totaal aantal items', todaysScans: 'Scans van vandaag', verification: 'Verificatie',
    historyTitle: 'Scangeschiedenis', exportCsv: 'CSV exporteren',
    searchPlaceholder: 'Zoek batch-ID, operator, categorie, hash…', allRecords: 'Alle registraties',
    settingsTitle: 'Instellingen', saveSettings: 'Instellingen opslaan', saved: 'Opgeslagen',
    languageLabel: 'Taal', systemOnline: 'Systeem online', checkingSystem: 'Systeem controleren',
  },
  pl: {
    navScan: 'Nowe skanowanie', navScanSub: 'Zarejestruj wpis', navDashboard: 'Panel', navDashboardSub: 'Przegląd',
    navHistory: 'Historia skanów', navHistorySub: 'Poprzednie wpisy', navSettings: 'Ustawienia', navSettingsSub: 'Preferencje',
    signOut: 'Wyloguj się', fieldOperator: 'Operator terenowy', adminView: 'Widok administratora',
    welcomeBack: 'Witamy z powrotem', welcomeSub: 'Zaloguj się do konsoli operacyjnej.',
    emailLabel: 'Służbowy e-mail', passwordLabel: 'Hasło', signInButton: 'Zaloguj się', signingIn: 'Logowanie…',
    captureImageTitle: 'Zrób zdjęcie', uploadPrompt: 'Dotknij, aby przesłać zdjęcie',
    categoryLabel: 'Kategoria', batchIdLabel: 'ID partii',
    reviewDetectionTitle: 'Sprawdź wykrycie', totalCountLabel: 'Łączna liczba', detectedTypesLabel: 'Wykryte typy',
    gpsTitle: 'Lokalizacja', gpsEnable: 'Włącz', gpsRefresh: 'Odśwież', hashTitle: 'Weryfikacja SHA-256',
    clearButton: 'Wyczyść', saveButton: 'Zapisz podpisane skanowanie', signing: 'Podpisywanie…',
    saveSuccess: 'Skan pomyślnie zapisany i podpisany.',
    dashboardTitle: 'Panel', refresh: 'Odśwież',
    totalScans: 'Łącznie skanów', totalItems: 'Łącznie elementów', todaysScans: 'Dzisiejsze skany', verification: 'Weryfikacja',
    historyTitle: 'Historia skanów', exportCsv: 'Eksportuj CSV',
    searchPlaceholder: 'Szukaj ID partii, operatora, kategorii, hasha…', allRecords: 'Wszystkie wpisy',
    settingsTitle: 'Ustawienia', saveSettings: 'Zapisz ustawienia', saved: 'Zapisano',
    languageLabel: 'Język', systemOnline: 'System online', checkingSystem: 'Sprawdzanie systemu',
  },
  tr: {
    navScan: 'Yeni tarama', navScanSub: 'Kayıt oluştur', navDashboard: 'Gösterge paneli', navDashboardSub: 'Genel bakış',
    navHistory: 'Tarama geçmişi', navHistorySub: 'Önceki kayıtlar', navSettings: 'Ayarlar', navSettingsSub: 'Tercihler',
    signOut: 'Çıkış yap', fieldOperator: 'Saha operatörü', adminView: 'Yönetici görünümü',
    welcomeBack: 'Tekrar hoş geldiniz', welcomeSub: 'Operasyon konsolunuza giriş yapın.',
    emailLabel: 'İş e-postası', passwordLabel: 'Parola', signInButton: 'Giriş yap', signingIn: 'Giriş yapılıyor…',
    captureImageTitle: 'Görüntü yakala', uploadPrompt: 'Görüntü yüklemek için dokunun',
    categoryLabel: 'Kategori', batchIdLabel: 'Parti kimliği',
    reviewDetectionTitle: 'Tespiti gözden geçir', totalCountLabel: 'Toplam sayı', detectedTypesLabel: 'Tespit edilen türler',
    gpsTitle: 'Konum', gpsEnable: 'Etkinleştir', gpsRefresh: 'Yenile', hashTitle: 'SHA-256 doğrulama',
    clearButton: 'Temizle', saveButton: 'İmzalı taramayı kaydet', signing: 'İmzalanıyor…',
    saveSuccess: 'Tarama başarıyla kaydedildi ve imzalandı.',
    dashboardTitle: 'Gösterge paneli', refresh: 'Yenile',
    totalScans: 'Toplam tarama', totalItems: 'Toplam öğe', todaysScans: 'Bugünkü taramalar', verification: 'Doğrulama',
    historyTitle: 'Tarama geçmişi', exportCsv: 'CSV dışa aktar',
    searchPlaceholder: 'Parti kimliği, operatör, kategori, hash ara…', allRecords: 'Tüm kayıtlar',
    settingsTitle: 'Ayarlar', saveSettings: 'Ayarları kaydet', saved: 'Kaydedildi',
    languageLabel: 'Dil', systemOnline: 'Sistem çevrimiçi', checkingSystem: 'Sistem kontrol ediliyor',
  },
  uk: {
    navScan: 'Нове сканування', navScanSub: 'Зафіксувати запис', navDashboard: 'Панель керування', navDashboardSub: 'Огляд',
    navHistory: 'Історія сканувань', navHistorySub: 'Попередні записи', navSettings: 'Налаштування', navSettingsSub: 'Уподобання',
    signOut: 'Вийти', fieldOperator: 'Польовий оператор', adminView: 'Вигляд адміністратора',
    welcomeBack: 'З поверненням', welcomeSub: 'Увійдіть до консолі операцій.',
    emailLabel: 'Робоча пошта', passwordLabel: 'Пароль', signInButton: 'Увійти', signingIn: 'Вхід…',
    captureImageTitle: 'Зробити знімок', uploadPrompt: 'Торкніться, щоб завантажити зображення',
    categoryLabel: 'Категорія', batchIdLabel: 'ID партії',
    reviewDetectionTitle: 'Перевірити виявлення', totalCountLabel: 'Загальна кількість', detectedTypesLabel: 'Виявлені типи',
    gpsTitle: 'Місцезнаходження', gpsEnable: 'Увімкнути', gpsRefresh: 'Оновити', hashTitle: 'Перевірка SHA-256',
    clearButton: 'Очистити', saveButton: 'Зберегти підписане сканування', signing: 'Підписання…',
    saveSuccess: 'Сканування успішно збережено та підписано.',
    dashboardTitle: 'Панель керування', refresh: 'Оновити',
    totalScans: 'Усього сканувань', totalItems: 'Усього елементів', todaysScans: 'Сьогоднішні сканування', verification: 'Перевірка',
    historyTitle: 'Історія сканувань', exportCsv: 'Експортувати CSV',
    searchPlaceholder: 'Пошук ID партії, оператора, категорії, хешу…', allRecords: 'Усі записи',
    settingsTitle: 'Налаштування', saveSettings: 'Зберегти налаштування', saved: 'Збережено',
    languageLabel: 'Мова', systemOnline: 'Система онлайн', checkingSystem: 'Перевірка системи',
  },
};

const LanguageContext = createContext<{ lang: LangCode; setLang: (code: LangCode) => void; t: (key: string) => string } | null>(null);

function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LangCode>(() => {
    const stored = localStorage.getItem('cai_lang') as LangCode | null;
    return stored && translations[stored] ? stored : 'km';
  });
  const setLang = (code: LangCode) => { localStorage.setItem('cai_lang', code); setLangState(code); };
  const t = (key: string) => translations[lang]?.[key] ?? translations.en[key] ?? key;
  const value = useMemo(() => ({ lang, setLang, t }), [lang]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}

function LanguageSwitcher({ align = 'right' }: { align?: 'left' | 'right' }) {
  const { lang, setLang, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const current = LANGUAGES.find((item) => item.code === lang) || LANGUAGES[0];
  return <div className="relative">
    <button
      type="button"
      onClick={() => setOpen((value) => !value)}
      aria-label={t('languageLabel')}
      title={t('languageLabel')}
      data-testid="button-language-switcher"
      className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-foreground transition hover:bg-muted"
    >
      <Globe2 size={15} className="text-primary" />
      <span className="hidden sm:inline">{current.flag} {current.native}</span>
      <span className="sm:hidden">{current.flag}</span>
      <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <>
      <button aria-label="Close language menu" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
      <div className={`absolute z-50 mt-2 max-h-80 w-56 overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-2xl ${align === 'right' ? 'right-0' : 'left-0'}`}>
        {LANGUAGES.map((item) => (
          <button
            key={item.code}
            type="button"
            onClick={() => { setLang(item.code); setOpen(false); }}
            data-testid={`option-lang-${item.code}`}
            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-semibold transition ${lang === item.code ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'}`}
          >
            <span>{item.flag}</span>
            <span className="flex-1">{item.native}</span>
            {lang === item.code && <Check size={13} />}
          </button>
        ))}
      </div>
    </>}
  </div>;
}

/* ===================== end i18n ===================== */

function formatDate(value?: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}
function shortHash(hash?: string) { return hash ? `${hash.slice(0, 10)}…${hash.slice(-8)}` : 'Pending verification'; }
function initials(name?: string) { return (name || 'CAI').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(); }

function Brand({ compact = false }: { compact?: boolean }) {
  const { t } = useLanguage();
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

function useNavItems() {
  const { t } = useLanguage();
  return [
    { href: '/', key: 'scan', label: t('navScan'), sub: t('navScanSub'), icon: ScanLine },
    { href: '/dashboard', key: 'dashboard', label: t('navDashboard'), sub: t('navDashboardSub'), icon: LayoutDashboard },
    { href: '/scans', key: 'history', label: t('navHistory'), sub: t('navHistorySub'), icon: History },
    { href: '/settings', key: 'settings', label: t('navSettings'), sub: t('navSettingsSub'), icon: Settings2 },
  ];
}

function Sidebar({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [location] = useLocation();
  const { t } = useLanguage();
  const items = useNavItems();
  return <aside className="hidden min-h-[100dvh] w-[262px] shrink-0 flex-col bg-sidebar px-5 py-6 text-sidebar-foreground md:flex">
    <div className="flex items-center justify-between gap-2">
      <Brand />
    </div>
    <div className="mt-5"><LanguageSwitcher /></div>
    <div className="mt-10 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-sidebar-foreground/40">Operations</div>
    <nav className="mt-3 space-y-1" aria-label="Primary navigation">
      {items.map(({ href, key, label, sub, icon: Icon }) => {
        const active = href === '/' ? location === '/' : location.startsWith(href);
        return <Link key={href} href={href} data-testid={`link-nav-${key}`} className={`group flex items-center gap-3 rounded-xl px-3 py-3 transition-colors ${active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/63 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'}`}>
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
        <button onClick={onLogout} title={t('signOut')} aria-label={t('signOut')} data-testid="button-sign-out" className="rounded-lg p-2 text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-secondary"><LogOut size={16} /></button>
      </div>
    </div>
  </aside>;
}

function MobileHeader({ user, onMenu }: { user: User; onMenu: () => void }) {
  return <header className="flex items-center justify-between gap-2 border-b border-border bg-card/90 px-4 py-3 backdrop-blur md:hidden">
    <button onClick={onMenu} aria-label="Open navigation" data-testid="button-open-navigation" className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><Menu size={20} /></button>
    <Brand compact />
    <div className="flex items-center gap-2">
      <LanguageSwitcher />
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary text-[10px] font-extrabold">{initials(user.name)}</div>
    </div>
  </header>;
}

function Topbar({ user, title, subtitle, action }: { user: User; title: string; subtitle: string; action?: ReactNode }) {
  const { t } = useLanguage();
  return <div className="mb-8 flex items-start justify-between gap-4">
    <div><div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.18em] text-primary"><span className="h-1.5 w-1.5 rounded-full bg-secondary" />{user.role === 'admin' ? t('adminView') : t('fieldOperator')}</div><h1 className="text-2xl font-extrabold tracking-[-.04em] text-foreground sm:text-3xl">{title}</h1><p className="mt-1 text-sm text-muted-foreground">{subtitle}</p></div>
    {action}
  </div>;
}

function Shell({ user, children, onLogout }: { user: User; children: ReactNode; onLogout: () => void }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = useNavItems();
  return <div className="min-h-[100dvh] bg-background">
    <div className="flex min-h-[100dvh]">
      <Sidebar user={user} onLogout={onLogout} />
      <div className="min-w-0 flex-1">
        <MobileHeader user={user} onMenu={() => setMobileOpen(true)} />
        {mobileOpen && <div className="fixed inset-0 z-50 flex md:hidden"><button className="absolute inset-0 bg-foreground/30" aria-label="Close navigation" onClick={() => setMobileOpen(false)} /><div className="relative z-10 flex w-[280px] flex-col bg-sidebar p-5 text-sidebar-foreground"><div className="flex items-center justify-between"><Brand /><button onClick={() => setMobileOpen(false)} aria-label="Close navigation" data-testid="button-close-navigation" className="rounded-lg p-2 hover:bg-sidebar-accent"><X size={18} /></button></div><nav className="mt-10 space-y-1">{items.map(({ href, key, label, sub, icon: Icon }) => <Link onClick={() => setMobileOpen(false)} key={href} href={href} data-testid={`mobile-link-${key}`} className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-sidebar-accent"><Icon size={19} /><span><b className="block text-sm">{label}</b><small className="opacity-50">{sub}</small></span></Link>)}</nav><button onClick={onLogout} data-testid="mobile-button-sign-out" className="mt-auto flex items-center gap-3 border-t border-sidebar-border pt-4 text-sm"><LogOut size={18} /> Sign out</button></div></div>}
        <main className="app-grid min-h-[calc(100dvh-57px)] px-4 py-7 sm:px-7 lg:px-10 lg:py-9">{children}</main>
      </div>
    </div>
  </div>;
}

function SignIn({ onSignedIn }: { onSignedIn: (user: User) => void }) {
  const login = useLogin();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const submit = (event: React.FormEvent) => { event.preventDefault(); login.mutate({ data: { email, password } }, { onSuccess: (session) => { localStorage.setItem('cai_session', session.token); onSignedIn(session.user); } }); };
  return <div className="min-h-[100dvh] bg-sidebar text-sidebar-foreground">
    <div className="mx-auto grid min-h-[100dvh] max-w-[1440px] lg:grid-cols-[1.02fr_.98fr]">
      <section className="relative hidden overflow-hidden border-r border-sidebar-border px-12 py-12 lg:flex lg:flex-col">
        <div className="flex items-center justify-between"><Brand /><LanguageSwitcher /></div>
        <div className="relative z-10 mt-auto max-w-xl pb-8"><Pill tone="warm"><ShieldCheck size={13} /> Secure field intelligence</Pill><h1 className="mt-7 text-6xl font-extrabold leading-[.98] tracking-[-.07em]">Count what<br /><span className="text-secondary">matters.</span></h1><p className="mt-7 max-w-md text-base leading-relaxed text-sidebar-foreground/60">A calm, verified workspace for the teams moving Cambodia’s resources forward.</p><div className="mt-12 flex items-center gap-8 text-[11px] font-bold uppercase tracking-[.16em] text-sidebar-foreground/45"><span className="flex items-center gap-2"><LockKeyhole size={14} /> Signed records</span><span className="flex items-center gap-2"><Wifi size={14} /> Field ready</span></div></div>
        <div className="absolute -right-24 top-32 h-96 w-96 rounded-full border border-secondary/15" /><div className="absolute -right-4 top-56 h-64 w-64 rounded-full border border-secondary/10" /><div className="absolute bottom-20 left-1/2 h-px w-1/2 bg-gradient-to-r from-transparent via-secondary/30 to-transparent" />
      </section>
      <section className="flex items-center justify-center bg-background px-5 py-10 text-foreground sm:px-10">
        <div className="w-full max-w-[430px] animate-rise">
          <div className="mb-12 flex items-center justify-between lg:hidden"><Brand /><LanguageSwitcher align="left" /></div>
          <div className="mb-10"><p className="mb-3 text-xs font-bold uppercase tracking-[.2em] text-primary">CAI Pro Vision / Access</p><h2 className="text-3xl font-extrabold tracking-[-.05em]">{t('welcomeBack')}</h2><p className="mt-2 text-sm text-muted-foreground">{t('welcomeSub')}</p></div>
          <form onSubmit={submit} className="space-y-5">
            <label className="block"><span className="mb-2 block text-xs font-bold">{t('emailLabel')}</span><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="operator@cai.gov.kh" data-testid="input-email" className="h-12 w-full rounded-xl border border-input bg-card px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" /></label>
            <label className="block"><span className="mb-2 block text-xs font-bold">{t('passwordLabel')}</span><div className="relative"><input required minLength={1} type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" data-testid="input-password" className="h-12 w-full rounded-xl border border-input bg-card px-4 pr-20 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" /><button type="button" onClick={() => setShowPassword(!showPassword)} data-testid="button-toggle-password" className="absolute right-3 top-1/2 -translate-y-1/2 px-2 text-[11px] font-bold text-primary">{showPassword ? 'Hide' : 'Show'}</button></div></label>
            {login.isError && <div role="alert" data-testid="status-login-error" className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-xs font-semibold text-destructive">We could not verify those credentials. Check your email and try again.</div>}
            <button type="submit" disabled={login.isPending} data-testid="button-sign-in" className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-extrabold text-primary-foreground shadow-[0_4px_0_hsl(173_57%_25%)] transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60">{login.isPending ? <><Loader2 size={17} className="animate-spin" /> {t('signingIn')}</> : <>{t('signInButton')} <ArrowRight size={17} /></>}</button>
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
  const { t } = useLanguage();
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
  const [noticeType, setNoticeType] = useState<'success' | 'error' | null>(null);
  const [aiError, setAiError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const onFile = async (selected: File | undefined) => {
    if (!selected) return;
    setFile(selected); setAiComplete(false); setNotice(''); setNoticeType(null); setAiError('');
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
  const reset = () => { setFile(null); setPreview(''); setHash(''); setAiComplete(false); setProcessing(false); setCount('0'); setTypes(''); setBatchId(''); setNotice(''); setNoticeType(null); if (fileInput.current) fileInput.current.value = ''; };
  const save = () => {
    if (!batchId.trim() || Number(count) < 0 || !hash) { setNotice(t('saveValidation')); setNoticeType('error'); return; }
    const data: ScanInput = { category, batchId: batchId.trim(), totalCount: Number(count), detectedTypes: types.split(',').map((item) => item.trim()).filter(Boolean), hashSignature: hash, aiAssisted: aiComplete, latitude: gps?.lat ?? null, longitude: gps?.lng ?? null };
    createScan.mutate({ data }, { onSuccess: () => { setNotice(t('saveSuccess')); setNoticeType('success'); queryClient.invalidateQueries({ queryKey: getListScansQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); window.setTimeout(reset, 1600); }, onError: () => { setNotice(t('saveError')); setNoticeType('error'); } });
  };
  return <div className="mx-auto max-w-[1420px]"><Topbar user={user} title={t('navScan')} subtitle={t('navScanSub')} action={<div data-testid="status-system-health" className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-[11px] font-bold text-muted-foreground sm:flex"><span className={`pulse-dot h-2 w-2 rounded-full ${healthStatus === 'ok' ? 'bg-primary' : 'bg-secondary'}`} /> {healthStatus === 'ok' ? t('systemOnline') : t('checkingSystem')}</div>} />
    {notice && <div data-testid="status-scan-notice" className={`mb-5 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${noticeType === 'success' ? 'border-primary/20 bg-primary/10 text-primary' : 'border-secondary/40 bg-secondary/15 text-foreground'}`}>{noticeType === 'success' && <Check size={16} />}{notice}</div>}
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(330px,.7fr)]">
      <section className="rounded-2xl border border-card-border bg-card p-4 shadow-[0_12px_36px_rgba(20,57,63,.05)] sm:p-6">
         <div className="mb-6 flex items-center justify-between"><div><h2 className="text-base font-extrabold">{t('captureImageTitle')}</h2><p className="mt-1 text-xs text-muted-foreground">Upload a clear field image for assisted detection.</p></div><Pill tone={processing ? 'warm' : aiComplete ? 'good' : 'neutral'}>{processing ? <><Loader2 size={12} className="animate-spin" /> Processing</> : aiComplete ? <><Check size={12} /> Ready</> : <><Sparkles size={12} /> AI assisted</>}</Pill></div>
        <button type="button" onClick={() => fileInput.current?.click()} data-testid="button-upload-image" className={`group relative flex min-h-[280px] w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition ${preview ? 'border-primary/35 bg-sidebar' : 'border-border bg-muted/40 hover:border-primary/50 hover:bg-primary/5'}`}>
          <input ref={fileInput} type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0])} data-testid="input-image-upload" className="hidden" />
          {preview ? <><img src={preview} alt="Selected field scan" className="absolute inset-0 h-full w-full object-contain opacity-85" />{processing && <div className="scan-line absolute left-0 right-0 h-1 bg-secondary shadow-[0_0_18px_hsl(39_76%_57%)]" />}{processing && <div className="absolute inset-0 bg-sidebar/35" />}<div className="absolute bottom-3 left-3 rounded-lg bg-sidebar/90 px-3 py-2 text-left text-xs text-sidebar-foreground backdrop-blur"><div className="font-bold">{file?.name}</div><div className="mt-1 text-sidebar-foreground/60">{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : ''}</div></div><div className="absolute right-3 top-3 rounded-full bg-sidebar/85 p-2 text-sidebar-foreground"><FileImage size={16} /></div></> : <div className="relative z-10 text-center"><div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary transition group-hover:scale-105"><UploadCloud size={26} /></div><div className="text-sm font-extrabold">{t('uploadPrompt')}</div><div className="mt-1 text-xs text-muted-foreground">JPG, PNG up to 10 MB</div></div>}
        </button>
        <div className="mt-6 grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-xs font-bold">{t('categoryLabel')}</span><select value={category} onChange={(e) => setCategory(e.target.value as ScanInput['category'])} data-testid="select-category" className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold outline-none focus:border-primary">{categories.map((item) => <option key={item.value} value={item.value}>{item.kh} · {item.en}</option>)}</select></label><label><span className="mb-2 block text-xs font-bold">{t('batchIdLabel')}</span><input value={batchId} onChange={(e) => setBatchId(e.target.value)} placeholder="e.g. KHM-24-081" data-testid="input-batch-id" className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary" /></label></div>
      </section>
      <section className="space-y-5">
        <div className="rounded-2xl border border-card-border bg-card p-5 shadow-[0_12px_36px_rgba(20,57,63,.05)]"><div className="mb-5 flex items-center gap-2"><div className="grid h-8 w-8 place-items-center rounded-lg bg-secondary/25 text-foreground"><Gauge size={17} /></div><div><h2 className="text-sm font-extrabold">{t('reviewDetectionTitle')}</h2><p className="text-[11px] text-muted-foreground">Correct before signing the record.</p></div></div><label className="block"><span className="mb-2 block text-xs font-bold">{t('totalCountLabel')}</span><input type="number" min="0" value={count} onChange={(e) => setCount(e.target.value)} data-testid="input-total-count" className="h-14 w-full rounded-xl border border-input bg-background px-4 font-mono-ops text-2xl font-bold outline-none focus:border-primary" /></label><label className="mt-4 block"><span className="mb-2 block text-xs font-bold">{t('detectedTypesLabel')}</span><input value={types} onChange={(e) => setTypes(e.target.value)} placeholder="Separate types with commas" data-testid="input-detected-types" className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary" /></label><div className="mt-4 flex items-center justify-between rounded-xl bg-muted/70 px-3 py-2.5"><span className="text-xs text-muted-foreground">AI suggestion</span><span className={`text-xs font-bold ${aiComplete ? 'text-primary' : 'text-muted-foreground'}`}>{aiComplete ? 'Applied · editable' : 'Waiting for image'}</span></div></div>
        <div className="rounded-2xl border border-card-border bg-card p-5 shadow-[0_12px_36px_rgba(20,57,63,.05)]"><div className="flex items-start gap-3"><div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${gpsState === 'ready' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}><MapPin size={17} /></div><div className="min-w-0 flex-1"><h2 className="text-sm font-extrabold">{t('gpsTitle')}</h2><p className="mt-1 text-xs text-muted-foreground">{gpsState === 'ready' && gps ? `${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}` : gpsState === 'denied' ? 'Location permission unavailable' : 'Attach your current position to this record.'}</p></div><button onClick={requestGps} disabled={gpsState === 'loading'} data-testid="button-request-gps" className="rounded-lg border border-border px-2.5 py-2 text-[11px] font-bold text-primary hover:bg-primary/5 disabled:opacity-50">{gpsState === 'loading' ? <Loader2 size={14} className="animate-spin" /> : gpsState === 'ready' ? t('gpsRefresh') : t('gpsEnable')}</button></div></div>
         <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5"><div className="flex items-start gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"><Fingerprint size={17} /></div><div className="min-w-0"><h2 className="text-sm font-extrabold">{t('hashTitle')}</h2><p className="mt-1 text-xs text-muted-foreground">{hash ? 'Image fingerprint generated locally.' : 'Upload an image to generate its fingerprint.'}</p><div data-testid="text-hash-signature" className="mt-3 break-all font-mono-ops text-[10px] leading-relaxed text-primary">{hash || '— — — — — — — —'}</div>{aiError && <p className="mt-3 text-xs font-semibold text-secondary-foreground">{aiError}</p>}</div></div></div>
        <div className="flex gap-3"><button onClick={reset} type="button" data-testid="button-reset-scan" className="h-12 flex-1 rounded-xl border border-border bg-card text-sm font-bold text-muted-foreground hover:bg-muted">{t('clearButton')}</button><button onClick={save} disabled={createScan.isPending} data-testid="button-save-scan" className="flex h-12 flex-[2] items-center justify-center gap-2 rounded-xl bg-primary text-sm font-extrabold text-primary-foreground shadow-[0_4px_0_hsl(173_57%_25%)] transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60">{createScan.isPending ? <><Loader2 size={17} className="animate-spin" /> {t('signing')}</> : <><FileCheck2 size={17} /> {t('saveButton')}</>}</button></div>
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
  const { t } = useLanguage();
  const [range, setRange] = useState('7 days');
  const categoryEntries = Object.entries(summary?.categoryCounts || {});
  const maxCategory = Math.max(...categoryEntries.map(([, value]) => value), 1);
  return <div className="mx-auto max-w-[1420px]"><Topbar user={user} title={t('navDashboard')} subtitle={t('navDashboardSub')} action={<button onClick={() => summaryQuery.refetch()} data-testid="button-refresh-dashboard" className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-bold text-muted-foreground hover:bg-muted"><RefreshCw size={14} className={summaryQuery.isFetching ? 'animate-spin' : ''} /> {t('refresh')}</button>} />
    {summaryQuery.isError && <div role="alert" data-testid="status-dashboard-error" className="mb-5 flex items-center justify-between rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive"><span>Dashboard data could not be loaded.</span><button onClick={() => summaryQuery.refetch()} data-testid="button-retry-dashboard" className="font-bold underline">Retry</button></div>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{summaryQuery.isLoading ? [1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-[157px]" />) : <><MetricCard label={t('totalScans')} value={summary?.totalScans ?? 0} sub="All signed records" icon={ScanLine} /><MetricCard label={t('totalItems')} value={summary?.totalItems ?? 0} sub="Across all categories" icon={PackageSearch} tone="orange" /><MetricCard label={t('todaysScans')} value={summary?.todayScans ?? 0} sub="Since 00:00 local time" icon={Activity} tone="coral" /><MetricCard label={t('verification')} value="SHA-256" sub="Every record fingerprinted" icon={ShieldCheck} /></>}</div>
    <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_.9fr]"><section className="rounded-2xl border border-card-border bg-card p-5 sm:p-6"><div className="mb-7 flex items-center justify-between"><div><h2 className="text-base font-extrabold">Scan volume</h2><p className="mt-1 text-xs text-muted-foreground">Category distribution across signed records</p></div><select value={range} onChange={(e) => setRange(e.target.value)} data-testid="select-dashboard-range" className="rounded-lg border border-border bg-background px-2.5 py-2 text-[11px] font-bold outline-none"><option>7 days</option><option>30 days</option><option>All time</option></select></div>{summaryQuery.isLoading ? <Skeleton className="h-48" /> : categoryEntries.length ? <div className="space-y-5">{categoryEntries.map(([key, value]) => { const category = categories.find((item) => item.value === key); return <div key={key}><div className="mb-2 flex items-center justify-between text-xs"><span className="font-bold">{category?.kh || key} <span className="font-normal text-muted-foreground">/ {category?.en || key}</span></span><span className="font-mono-ops text-muted-foreground">{value}</span></div><div className="h-3 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full transition-all duration-700 ${category?.tint === 'orange' ? 'bg-secondary' : category?.tint === 'coral' ? 'bg-accent' : category?.tint === 'olive' ? 'bg-chart-5' : 'bg-primary'}`} style={{ width: `${Math.max((value / maxCategory) * 100, 5)}%` }} /></div></div>})}</div> : <EmptyState icon={BarChart3} title="No scan volume yet" detail="Signed records will appear here after your first field scan." />}</section><section className="rounded-2xl border border-card-border bg-card p-5 sm:p-6"><div className="mb-3 flex items-center justify-between"><div><h2 className="text-base font-extrabold">Recent activity</h2><p className="mt-1 text-xs text-muted-foreground">Latest signed records</p></div><Link href="/scans" data-testid="link-view-all-scans" className="text-xs font-bold text-primary hover:underline">View all <ArrowRight size={13} className="ml-1 inline" /></Link></div>{summaryQuery.isLoading ? <div className="space-y-2">{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-16" />)}</div> : summary?.recentScans?.length ? summary.recentScans.slice(0, 5).map((scan, index) => <ScanRow key={scan.id || index} scan={scan} index={index} />) : <EmptyState icon={History} title="No recent activity" detail="Your most recent scans will be listed here." />}</section></div>
    <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-secondary/35 bg-secondary/10 px-5 py-4"><div className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-secondary-foreground"><Zap size={17} /></div><div className="flex-1"><div className="text-sm font-extrabold">Keep the chain unbroken</div><div className="text-xs text-muted-foreground">Every saved image is fingerprinted before it enters the shared record.</div></div><Pill tone="warm"><LockKeyhole size={12} /> Verified workflow</Pill></div>
  </div>;
}

function EmptyState({ icon: Icon, title, detail }: { icon: typeof Activity; title: string; detail: string }) {
  return <div className="grid min-h-[170px] place-items-center rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center"><div><div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-card text-muted-foreground shadow-sm"><Icon size={19} /></div><div className="mt-3 text-sm font-bold">{title}</div><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div></div>;
}

function ScansPage({ user }: { user: User }) {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Scan | null>(null);
  const [category, setCategory] = useState('all');
  const scansQuery = useListScans({ limit: 100 });
  const scans = useMemo(() => (scansQuery.data || []).filter((scan) => `${scan.batchId} ${scan.operator} ${scan.category} ${scan.hashSignature}`.toLowerCase().includes(query.toLowerCase()) && (category === 'all' || scan.category === category)), [scansQuery.data, query, category]);
  const exportCsv = () => { const rows = [['id', 'batch_id', 'category', 'operator', 'total_count', 'detected_types', 'hash_signature', 'ai_assisted', 'latitude', 'longitude', 'created_at'], ...scans.map((scan) => [scan.id, scan.batchId, scan.category, scan.operator, String(scan.totalCount), scan.detectedTypes.join('; '), scan.hashSignature, String(scan.aiAssisted), String(scan.latitude ?? ''), String(scan.longitude ?? ''), scan.createdAt])]; const blob = new Blob([rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `cai-pro-vision-scans-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); URL.revokeObjectURL(url); };
  return <div className="mx-auto max-w-[1420px]"><Topbar user={user} title={t('navHistory')} subtitle={t('navHistorySub')} action={<button onClick={exportCsv} disabled={!scans.length} data-testid="button-export-csv" className="flex items-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-xs font-extrabold text-primary-foreground shadow-[0_3px_0_hsl(173_57%_25%)] disabled:opacity-40"><Download size={14} /> {t('exportCsv')}</button>} />
    <section className="rounded-2xl border border-card-border bg-card p-4 shadow-[0_12px_36px_rgba(20,57,63,.05)] sm:p-6"><div className="flex flex-col gap-3 lg:flex-row"><div className="relative flex-1"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} type="search" placeholder={t('searchPlaceholder')} data-testid="input-search-scans" className="h-11 w-full rounded-xl border border-input bg-background pl-10 pr-4 text-sm outline-none focus:border-primary" /></div><div className="flex items-center gap-2 overflow-x-auto"><SlidersHorizontal size={15} className="shrink-0 text-muted-foreground" />{['all', ...categories.map((item) => item.value)].map((item) => <button key={item} onClick={() => setCategory(item)} data-testid={`button-filter-${item}`} className={`whitespace-nowrap rounded-lg px-3 py-2 text-[11px] font-bold transition ${category === item ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary'}`}>{item === 'all' ? t('allRecords') : categories.find((cat) => cat.value === item)?.en}</button>)}</div></div><div className="mt-5 flex items-center justify-between border-b border-border pb-3 text-[11px] font-bold uppercase tracking-[.13em] text-muted-foreground"><span>{scansQuery.isLoading ? 'Loading register' : `${scans.length} visible record${scans.length === 1 ? '' : 's'}`}</span><span className="hidden sm:block">Signed · SHA-256</span></div>{scansQuery.isError ? <div className="py-8 text-center"><div className="text-sm font-bold text-destructive">Unable to load scan history.</div><button onClick={() => scansQuery.refetch()} data-testid="button-retry-scans" className="mt-2 text-xs font-bold text-primary underline">Retry</button></div> : scansQuery.isLoading ? <div className="space-y-3 py-3">{[1, 2, 3, 4, 5].map((item) => <Skeleton key={item} className="h-[67px]" />)}</div> : scans.length ? <div>{scans.map((scan, index) => <button key={scan.id || index} onClick={() => setSelected(scan)} data-testid={`button-open-scan-${scan.id || index}`} className="block w-full text-left transition hover:bg-muted/45"><ScanRow scan={scan} index={index} /></button>)}</div> : <div className="py-5"><EmptyState icon={History} title={query || category !== 'all' ? 'No matching records' : 'Register is empty'} detail={query || category !== 'all' ? 'Try a different search or category filter.' : 'Saved scans will appear in this register.'} /></div>}</section>
    {selected && <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/35 p-0 sm:items-center sm:p-5"><button aria-label="Close scan details" onClick={() => setSelected(null)} className="absolute inset-0" /><section role="dialog" aria-modal="true" className="relative z-10 max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-border bg-card p-5 shadow-2xl sm:rounded-2xl sm:p-7"><div className="flex items-start justify-between"><div><Pill tone="good"><Check size={12} /> Signed record</Pill><h2 className="mt-3 text-xl font-extrabold">{selected.batchId}</h2><p className="mt-1 text-xs text-muted-foreground">{formatDate(selected.createdAt)} · {selected.operator}</p></div><button onClick={() => setSelected(null)} aria-label="Close details" data-testid="button-close-scan-details" className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X size={18} /></button></div><div className="mt-7 grid grid-cols-2 gap-3"><div className="rounded-xl bg-muted/60 p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Category</div><div className="mt-2 text-sm font-bold">{categories.find((item) => item.value === selected.category)?.kh} · {selected.category}</div></div><div className="rounded-xl bg-muted/60 p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total count</div><div className="mt-2 font-mono-ops text-xl font-bold">{selected.totalCount}</div></div></div><div className="mt-3 rounded-xl border border-border p-4"><div className="flex items-center gap-2 text-xs font-bold"><Fingerprint size={15} className="text-primary" /> SHA-256 signature</div><div className="mt-3 break-all font-mono-ops text-[10px] leading-relaxed text-primary">{selected.hashSignature}</div></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-muted/60 p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Detected types</div><div className="mt-2 text-xs font-semibold">{selected.detectedTypes.length ? selected.detectedTypes.join(', ') : 'None recorded'}</div></div><div className="rounded-xl bg-muted/60 p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Coordinates</div><div className="mt-2 font-mono-ops text-[10px]">{selected.latitude != null ? `${selected.latitude.toFixed(5)}, ${selected.longitude?.toFixed(5)}` : 'Not attached'}</div></div></div></section></div>}
  </div>;
}

function SettingsPage({ user }: { user: User }) {
  const { t } = useLanguage();
  const [geofence, setGeofence] = useState(() => localStorage.getItem('cai_geofence') !== 'off');
  const [radius, setRadius] = useState(() => localStorage.getItem('cai_geofence_radius') || '250');
  const [saved, setSaved] = useState(false);
  const saveSettings = () => { localStorage.setItem('cai_geofence', geofence ? 'on' : 'off'); localStorage.setItem('cai_geofence_radius', radius); setSaved(true); window.setTimeout(() => setSaved(false), 2400); };
  return <div className="mx-auto max-w-[1060px]"><Topbar user={user} title={t('navSettings')} subtitle={t('navSettingsSub')} action={saved ? <Pill tone="good"><Check size={12} /> {t('saved')}</Pill> : undefined} /><div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]"><section className="rounded-2xl border border-card-border bg-card p-5 sm:p-7"><div className="mb-7"><h2 className="text-base font-extrabold">គណនី / Account</h2><p className="mt-1 text-xs text-muted-foreground">Your identity on every signed scan.</p></div><div className="flex items-center gap-4 border-b border-border pb-6"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-lg font-extrabold text-secondary-foreground">{initials(user.name)}</div><div><div className="text-lg font-extrabold">{user.name}</div><div className="mt-1 text-sm text-muted-foreground">{user.email}</div><div className="mt-2"><Pill tone={user.role === 'admin' ? 'warm' : 'good'}>{user.role === 'admin' ? <><ShieldCheck size={12} /> Administrator</> : <><UserRound size={12} /> Field staff</>}</Pill></div></div></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><div className="rounded-xl bg-muted/60 p-4"><div className="flex items-center gap-2 text-xs font-bold"><LockKeyhole size={14} className="text-primary" /> Authentication</div><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Signed in through your organization account. Session cookies are sent securely.</p></div><div className="rounded-xl bg-muted/60 p-4"><div className="flex items-center gap-2 text-xs font-bold"><UsersRound size={14} className="text-primary" /> Access role</div><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{user.role === 'admin' ? 'Team-wide dashboard, register, and export access.' : 'Personal scanning and visible register access.'}</p></div></div></section><section className="rounded-2xl border border-card-border bg-card p-5 sm:p-7"><div className="mb-7"><h2 className="text-base font-extrabold">ទីតាំងសុវត្ថិភាព / Geofence</h2><p className="mt-1 text-xs text-muted-foreground">Keep field records inside the approved working area.</p></div><div className="flex items-center justify-between gap-4 rounded-xl border border-border p-4"><div><div className="text-sm font-extrabold">Require location on scan</div><div className="mt-1 text-xs text-muted-foreground">{geofence ? 'GPS is requested before saving.' : 'Location remains optional.'}</div></div><button role="switch" aria-checked={geofence} onClick={() => setGeofence(!geofence)} data-testid="switch-geofence" className={`relative h-7 w-12 rounded-full transition-colors ${geofence ? 'bg-primary' : 'bg-muted'}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-card shadow transition-transform ${geofence ? 'translate-x-6' : 'translate-x-1'}`} /></button></div><label className="mt-5 block"><span className="mb-2 block text-xs font-bold">Working radius <span className="font-normal text-muted-foreground">/ metres</span></span><div className="relative"><input type="number" min="50" max="5000" value={radius} onChange={(e) => setRadius(e.target.value)} disabled={!geofence} data-testid="input-geofence-radius" className="h-11 w-full rounded-xl border border-input bg-background px-3 pr-16 font-mono-ops text-sm outline-none focus:border-primary disabled:opacity-40" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">m</span></div></label><div className="mt-5 flex items-start gap-2.5 rounded-xl bg-secondary/12 p-3 text-xs leading-relaxed text-muted-foreground"><Globe2 size={15} className="mt-0.5 shrink-0 text-foreground" />Coordinates are attached to the signed record only when permission is granted on the device.</div><button onClick={saveSettings} data-testid="button-save-settings" className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-extrabold text-primary-foreground shadow-[0_3px_0_hsl(173_57%_25%)] hover:-translate-y-0.5"><Check size={16} /> {t('saveSettings')}</button></section></div><section className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-5"><div className="flex items-start gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"><CircleHelp size={17} /></div><div><h2 className="text-sm font-extrabold">Need help in the field?</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Ask your administrator to update team access or the approved operating area. CAI Pro Vision will keep the last saved setting on this device.</p></div></div></section></div>;
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
  return <QueryClientProvider client={queryClient}><LanguageProvider><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><ErrorBoundary><Router /></ErrorBoundary></WouterRouter><Toaster /></TooltipProvider></LanguageProvider></QueryClientProvider>;
}

export default App;
