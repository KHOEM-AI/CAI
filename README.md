# CAI · Vision · Count · Locate

ស្កេនរូបថត រាប់វត្ថុ និងកត់ទីតាំង GPS (Camera, Gallery, Bulk, 360°)។

- `cai-scan.html` ជាកម្មវិធីទាំងមូល (ពណ៌ផ្ទៃមេឃ) មិនត្រូវ build · `index.html` គ្រាន់តែបញ្ជូនបន្ត
- ដំណើរការក្នុង UI៖ `./ai.sh sync` (ចម្លង `cai-scan.html` ទៅ `AI/public/cai/`)
- ដំណើរការឯករាជ្យ៖ `./ai.sh run` → :5180
- ចែករំលែកទីតាំង/តាមដានឧបករណ៍៖ `share-server.mjs` (:5181) · ដាក់ Google Client ID ក្នុង `~/.cai-google-client-id` ហើយ `./ai.sh restart`
- ភ្ជាប់ទៅវិញទៅមក៖ `cai-scan.html#cam|#r360|#gps|#share|#hist|#res|#set` បើកផ្ទាំងដោយផ្ទាល់ (ប្រើដោយ CAIHome និង AI UI)
- ទូរស័ព្ទពីរគ្រឿង៖ `./ai.sh tunnel` (ត្រូវ `pkg install cloudflared`) រួចបើក address https លើទូរស័ព្ទមួយទៀត
- ឯកសារចែករំលែកទីតាំង · ឧបករណ៍ · ឯកជនភាព៖ docs/SHARING.md · test៖ node --test test/share.test.mjs
