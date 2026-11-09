# ចែករំលែកទីតាំង · តាមដានឧបករណ៍ (CAI)

ប្រព័ន្ធនេះសរសេរដោយខ្លួនឯង៖ `share-server.mjs` (Node គ្មាន package ខាងក្រៅ) និងផ្ទាំង 👥 Share ក្នុង `cai-scan.html`។
**មិនប្រើ និងមិនចម្លង Google Find Hub ទេ។** Google ត្រូវបានប្រើតែសម្រាប់ "ចូលដោយគណនី" (Sign in with Google) ប៉ុណ្ណោះ។

## គោលការណ៍
- **គ្មាន password**៖ app មិនទទួល មិនរក្សា password ទេ។ ភ្លេច password ត្រូវយកពី Google។
- **ត្រូវយល់ព្រម**៖ ចែករំលែកទីតាំងបានតែពេលអ្នកទទួលចុច "យល់ព្រម"។ ម្ខាងៗចុច "បិទ" បានគ្រប់ពេល។
- **ទិន្នន័យតិចបំផុត**៖ រក្សាតែទីតាំង ១ ចំណុចចុងក្រោយ ហើយលុបពេលបិទ។ គ្មានប្រវត្តិទីតាំង។

## ចាប់ផ្តើម
1. console.cloud.google.com → OAuth consent screen (External) → ថែមអ៊ីមែលរបស់បងជា Test user។
2. Credentials → OAuth client ID (Web) → Authorized JavaScript origins៖ `http://localhost:5175`, `http://localhost:5180`។
3. `echo "XXXX.apps.googleusercontent.com" > ~/.cai-google-client-id` ហើយ `bash ai.sh restart` (server នៅ `:5181`)។

ទូរស័ព្ទពីរគ្រឿង៖ `bash ai.sh tunnel` (ត្រូវ `pkg install cloudflared`)។ server ផ្តល់ទំព័រ និង API នៅ address https តែមួយ។
បន្ថែម address នោះទៅ Authorized origins ហើយបើកវាលើទូរស័ព្ទមួយទៀត។ អ្នកទីពីរក៏ត្រូវនៅក្នុងបញ្ជី Test users ដែរ។ address របស់ quick tunnel ប្តូរគ្រប់ដង។

## ចែករំលែកទីតាំង (២ នាក់ · អ៊ីមែល ២)
- ជ្រើស **កន្លះម៉ោង · ១ ម៉ោង · 24/7** (24/7 បន្តរហូតដល់ចុច "បិទ")។ ពេលរាប់ចាប់ពីអ្នកទទួលយល់ព្រម។
- **ទៅវិញទៅមក** (⇄)៖ យល់ព្រមម្តង ចាប់ផ្តើមទាំងពីរទិស ដោយម៉ោងបញ្ចប់ដូចគ្នា។ ឬចុច "ចែករំលែកត្រឡប់" ក្រោយ។
- **ទប់ស្កាត់**៖ អ្នកទទួលលែងឃើញសំណើពីអ្នកនោះ ហើយអ្នកផ្ញើឃើញតែ "រង់ចាំ" (មិនដឹងថាត្រូវទប់ស្កាត់)។
- **បិទទាំងអស់**៖ បិទគ្រប់ការចែករំលែកដែលខ្ញុំផ្ញើ។
- 📍 ផែនទី · 🧭 ចង្អុលផ្លូវ · 📤 ផ្ញើ link ទីតាំងតាម app ណាក៏បាន (share sheet របស់ទូរស័ព្ទ)។

## តាមដានឧបករណ៍ (១ គណនី)
- ឧបករណ៍ដែលបើក app នេះ (ទូរស័ព្ទ កុំព្យូទ័រ tablet)៖ ចុច "តាមដានឧបករណ៍នេះ"។ ឃើញបានតែក្នុងគណនីតែមួយ។

ឧបករណ៍ដែលបើក app មិនបាន (កាមេរ៉ា ក្តារ ។ល។)៖ ចុច 🔑 ដើម្បីបាន key (បង្ហាញតែម្តង) ហើយផ្ញើដោយ HTTP៖

~~~bash
curl -X POST https://ADDRESS/device/report \
  -H "Authorization: Bearer ck_..." -H "Content-Type: application/json" \
  -d '{"lat":11.5564,"lon":104.9282,"acc":10}'
~~~

key ធ្វើបានតែផ្ញើទីតាំងរបស់ឧបករណ៍នោះ ហើយស្លាប់ពេលលុបឧបករណ៍ ឬចេញ key ថ្មី។

## ទិន្នន័យ (`~/.cai-share.json` សិទ្ធិ 600 នៅក្រៅ repo)
| រក្សា | រយៈពេល |
|---|---|
| session (sha256 នៃ token, អ៊ីមែល, ឈ្មោះ) | 30 ថ្ងៃ · ≤ 10 ក្នុងមួយគណនី |
| ការចែករំលែក (អ៊ីមែល ២, រយៈពេល, ស្ថានភាព, ម៉ោង) | សំណើរង់ចាំ 24 ម៉ោង · ចប់ហើយលុប 7 ថ្ងៃក្រោយ |
| ទីតាំងចុងក្រោយ ១ ចំណុច (ពេលមានការចែករំលែកកំពុងដំណើរការ) | លុបពេលបិទ ឬផុតម៉ោង |
| ឧបករណ៍ (ឈ្មោះ ប្រភេទ ទីតាំងចុងក្រោយ) · key (sha256 តែប៉ុណ្ណោះ) · បញ្ជីទប់ស្កាត់ | រហូតដល់អ្នកប្រើលុប |

**មិនរក្សា**៖ password, token របស់ Google (ផ្ទៀងផ្ទាត់ signature, issuer, audience, ផុតកំណត់, អ៊ីមែលបានបញ្ជាក់ ហើយបោះចោល), ប្រវត្តិទីតាំង, រូបថត (server នេះមិនទទួលរូបទេ)។

## ដែនកំណត់ (ប្រាប់ត្រង់ៗ)
- ទំព័រ web ផ្ញើទីតាំងបានតែពេល app បើក។ គ្មានការតាមដានក្នុងផ្ទៃខាងក្រោយ។ ជម្រើស "ទុកអេក្រង់បើក" ជួយ តែស៊ីថ្ម។ 24/7 ពិតៗត្រូវការ app Android ពិតប្រាកដ។
- គ្មានអ៊ីនធឺណិត ឬ wifi គឺមិនដឹងទីតាំង។ ទីតាំងចាស់ជាង 5 នាទីបង្ហាញថា "ចាស់"។
- គ្មានការជូនដំណឹងទៅឆ្ងាយ៖ app សួរ server រៀងរាល់ 30 វិនាទី ហើយបង្ហាញលេខសំណើរង់ចាំលើផ្ទាំង Share។
- ឯកសារ JSON តែមួយ សមស្របក្រុមតូច មិនមែនសម្រាប់ទាំងពាន់នាក់ទេ។
- មិនអានឧបករណ៍ពី Google Find Hub បានទេ (គ្មាន API) ហើយក៏មិនចង់ពឹងវាដែរ។

## API (JSON · `Authorization: Bearer <token>`)
`GET /health` · `GET /config` · `GET /` (ទំព័រ) · `POST /auth/google` · `POST /auth/logout` · `GET /me`
`GET /shares` · `POST /share {to, minutes: 30|60|0, mutual}` · `POST /share/respond {id, accept, block}` · `POST /share/stop {id}` · `POST /share/stop-all`
`POST /loc {lat, lon, acc}` · `GET /blocks` · `POST /unblock {email}`
`GET /devices` · `POST /device {id, name, kind, lat, lon}` · `POST /device/remove {id}` · `POST /device/key {id}` · `POST /device/report` (key ឧបករណ៍)

## ទំព័រភ្ជាប់គ្នា
ផ្ទាំងនីមួយៗមាន address ផ្ទាល់៖ `cai-scan.html#cam | #r360 | #gps | #share | #hist | #res | #set`។
`CAIHome.tsx` និង AI UI ប្រើវាដើម្បីបើកផ្ទាំងត្រូវ។ ផ្ទាំង GPS មានប៊ូតុង 📤 និង 👥 ទៅ Share។

## ការពឹងផ្អែកខាងក្រៅពេលដំណើរការ
| ពី | ប្រើសម្រាប់ | ពេលណា |
|---|---|---|
| cdn.jsdelivr.net | TensorFlow.js 4.22.0, coco-ssd 2.2.3 (Apache-2.0) | ស្កេនរូប (តាមដែលដឹង ទម្ងន់ម៉ូដែលមកពី storage.googleapis.com) |
| accounts.google.com | Sign in with Google | ផ្ទាំង Share តែប៉ុណ្ណោះ |
| openstreetmap.org (ODbL, © OpenStreetMap contributors) | ផែនទី | ពេលបើកផែនទី |
| nominatim.openstreetmap.org | ឈ្មោះទីកន្លែង | ពេលចុចប៊ូតុងតែប៉ុណ្ណោះ (ប្រើតិច តាមគោលនយោបាយរបស់គេ) |

គម្រោងបន្ត៖ ដាក់ TensorFlow.js និងម៉ូដែលក្នុងម៉ាស៊ីនខ្លួនឯង ដើម្បីកុំពឹង CDN (ត្រូវរក្សាសេចក្តីជូនដំណឹង license)។

## ច្បាប់ និងឯកជនភាព
នេះមិនមែនជាដំបូន្មានផ្លូវច្បាប់ទេ។ មុនបើកឱ្យសាធារណៈ ត្រូវមាន Privacy Policy និង Terms របស់ខ្លួន,
បំពេញ OAuth consent screen របស់ Google (ឈ្មោះ app, អ៊ីមែលទំនាក់ទំនង) ហើយពិនិត្យច្បាប់ការពារទិន្នន័យក្នុងប្រទេសរបស់អ្នកប្រើ (ឧ. GDPR បើមានអ្នកប្រើនៅអឺរ៉ុប)។

## Test
`node --test test/share.test.mjs` (9 ក្រុម៖ ការចូល, ការយល់ព្រម, ទៅវិញទៅមក, ទប់ស្កាត់, ការត្រួតពិនិត្យ input, key ឧបករណ៍, ទំព័រ, ផុតម៉ោង, ការផ្ទៀងផ្ទាត់ token របស់ Google ដោយ key ក្នុងម៉ាស៊ីន)។ មិនត្រូវការអ៊ីនធឺណិត។
