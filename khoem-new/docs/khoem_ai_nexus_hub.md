# 🌐 KHOEM_AI Nexus Hub - Official Documentation

**Version:** 3.0 (Production Ready)  
**Author:** KHOEM_AI Creator (Supreme Master)  
**Philosophy:** *"បង្កើតរបស់ដែលប្រើប្រាស់បានពិតប្រាកដ កុំបង្កើតរបស់ដែលប្រើប្រាស់មិនបាន!"*

---

## 📌 សេចក្តីផ្តើម (Overview)
**KHOEM_AI Nexus Hub** គឺជាប្រព័ន្ធបញ្ជាកណ្តាល (Centralized IoT Gateway) ដ៏មានឥទ្ធិពលបំផុត ដែលអនុញ្ញាតឱ្យម្ចាស់ប្រព័ន្ធអាចគ្រប់គ្រងរាល់ឧបករណ៍ឆ្លាតវៃទាំងអស់ (Smart Home, Security Doors, Appliances) មិនថានៅជិត ឬឆ្ងាយជុំវិញពិភពលោក។ ប្រព័ន្ធនេះត្រូវបានរចនាឡើងជាមួយនឹងកម្រិតសុវត្ថិភាពខ្ពស់បំផុត ដោយផ្តល់សិទ្ធិអំណាចដាច់ខាត (Absolute Human Control) ទៅលើម្ចាស់ដើមតែម្នាក់គត់។

---

## 🏗 រចនាសម្ព័ន្ធប្រព័ន្ធ (System Architecture)
ប្រព័ន្ធនេះត្រូវបានរៀបចំតាមស្តង់ដារអន្តរជាតិ ដោយបែងចែកឯកសារមេ និងឯកសាររងយ៉ាងច្បាស់លាស់៖

* **`app.py`** (Main Entry) ៖ ខួរក្បាលកណ្តាលសម្រាប់រត់ Server (Flask)។
* **`templates/khoem_ai_nexus_hub.html`** (Main Entry) ៖ ផ្ទាំងគ្រប់គ្រង (Dashboard) សម្រាប់អ្នកប្រើប្រាស់។
* **`core/auth_routes.py`** ៖ ការផ្ទៀងផ្ទាត់អត្តសញ្ញាណម្ចាស់ (Google Sign-In + real server-side session)។
* **`core/database_engine.py`** ៖ ស្រទាប់ Database (SQLite)។
* **`static/js/khoem_ai_nexus_hub.js`** ៖ កូដ Frontend — ការចូលគណនី (Google Sign-In) និងបញ្ជូនសំណើបញ្ជាឧបករណ៍។
* **`database/khoem_ai.db`** ៖ ឃ្លាំងផ្ទុកទិន្នន័យ (SQLite) រក្សាស្ថានភាពឧបករណ៍អចិន្ត្រៃយ៍។

---

## 📡 ប្រព័ន្ធទំនាក់ទំនង (Communication Range)

KHOEM_AI Nexus Hub បែងចែកការគ្រប់គ្រងជា ២ កម្រិត៖

### ១. Global Range (ការបញ្ជាគ្មានដែនកំណត់)
* **បច្ចេកវិទ្យា៖** Wi-Fi & Internet / Flask API
* **រយៈចម្ងាយ៖** គ្រប់ទីកន្លែងលើពិភពលោក (Unlimited)
* **ដំណើរការ៖** ម្ចាស់ប្រព័ន្ធអាចបញ្ជាពីសហរដ្ឋអាមេរិក មកបើកទ្វារផ្ទះនៅកម្ពុជាបានភ្លាមៗ ឱ្យតែមានអ៊ីនធឺណិត។

### ២. Local Range (ការបញ្ជាចម្ងាយជិត)
* **បច្ចេកវិទ្យា៖** Bluetooth Low Energy (BLE) / Local Gateway
* **រយៈចម្ងាយ៖** ១០ ទៅ ១០០ ម៉ែត្រ
* **ដំណើរការ៖** ប្រើប្រាស់សម្រាប់បញ្ជាសោទ្វារ (Smart Lock) ឬនៅពេលដែលប្រព័ន្ធអ៊ីនធឺណិតរអាក់រអួល ប្រព័ន្ធនឹងប្តូរមកប្រើ Bluetooth ជាជម្រើសបម្រុង (Offline Fallback) ស្វ័យប្រវត្តិ។

---

## 🛡️ ប្រព័ន្ធសុវត្ថិភាព (Owner Authentication)

**ចំណាំ៖** កំណែមុនរបស់ឯកសារនេះពិពណ៌នាអំពី "Triple-Layer Security" (Email + Device ID + Face Biometrics)។
ក្នុងការអភិវឌ្ឍបន្ត លក្ខណៈ Face Scan/Fingerprint/PIN ដើមត្រូវបានរកឃើញថាជា UI ក្លែងក្លាយ
(មិនបានផ្ទៀងផ្ទាត់អ្វីពិតប្រាកដ — គ្រាន់តែ `alert()`/`prompt()` ដែលទទួលយក input ណាមួយថាត្រឹមត្រូវ)
ដូច្នេះត្រូវបានជំនួសដោយ **Google Sign-In ពិតប្រាកដ**៖

1. **Google Sign-In (Frontend):** ប្រើ Google Identity Services library — ម្ចាស់ចុច Sign-In ដោយគណនី Google ពិតប្រាកដ។
2. **Server-Side Verification (`core/auth_routes.py`):** Server ផ្ទៀងផ្ទាត់ Google ID token តាម `google-auth` library
   ហើយប្រៀបធៀបអាសយដ្ឋានអ៊ីមែលនឹងបញ្ជីម្ចាស់ដែលអនុញ្ញាត (`AUTHORIZED_OWNER_EMAILS`)។
3. **Session Cookie:** បន្ទាប់ពីផ្ទៀងផ្ទាត់ជោគជ័យ Server បង្កើត Flask session ពិតប្រាកដ —
   រាល់ការបញ្ជាឧបករណ៍បន្ទាប់ពីនេះ ត្រូវមាន session cookie នេះ (`require_owner_session()`) ទើបអាចដំណើរការបាន។

---

## 🔌 API Endpoints (សម្រាប់អ្នកអភិវឌ្ឍន៍)

### 1. ចូលគណនីម្ចាស់ (Google Sign-In)
* **Endpoint:** `POST /api/auth/google`
* **Body:** `{ "credential": "<Google ID token>" }`
* **Response (Success):**
  ```json
  { "ok": true, "message": "ចូលជោគជ័យ" }
  ```

### 2. ពិនិត្យស្ថានភាពឧបករណ៍ (Get Ecosystem Status)
* **Endpoint:** `GET /api/nexus/status`
* **Response (Success):** 
  ```json
  {
    "system": "KHOEM_AI Nexus Hub",
    "total_devices": 4,
    "ecosystem": {
      "main_door_lock": {"type": "Security", "status": "LOCKED", "conn": "Bluetooth/BLE"}
    }
  }
  ```
