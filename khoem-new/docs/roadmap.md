# KHOEM_AI Roadmap

Designed by **KHOEM SOKSIVUTHA**

---

## Version 2.2 — 🟡 In Progress

| Feature | ការពិពណ៌នា | Status | Priority | Module | Docs |
|---|---|---|---|---|---|
| Chat AI | ការសន្ទនាជាមូលដ្ឋានជាមួយ AI | ✅ Done | High | `core/` | khoem_ai.md |
| Vision AI | មើលឯកសារ / វិភាគរូបភាព | ✅ Done | High | `core/` | video_khoemai.md |
| Navigator | ជួយណែនាំ/រុករកក្នុងកម្មវិធី | 🟡 In Progress | High | — | navigator.md |
| Voice | បញ្ចូល/ចេញសំឡេង (Speech Recognition + TTS) | 🟡 In Progress | Medium | `core/voice_engine.py`, `static/js/voice.js` | voice.md |
| Memory | រក្សាទុកព័ត៌មាន/context អ្នកប្រើ | 🔴 Planned | High | — | *(ត្រូវបង្កើត memory.md)* |
| Accessibility | គាំទ្រអ្នកប្រើមានតម្រូវការពិសេស | 🟡 In Progress | Medium | — | accessibility.md |

**Target release:** *(មិនទាន់កំណត់ — ត្រូវបញ្ចូល)*

**កំណត់ត្រា Voice (2.2):** មាន error handling ពេញលេញ (mic permission, no-speech, TTS fail, GPS fail), voice commands ប្រើ partial match, `GET /api/voices` route ត្រូវបន្ថែមក្នុង `app.py`។ Privacy: audio មិនផ្ញើទៅ server ទេ (client-side Web Speech API) ប៉ុន្តែ transcript retention policy នៅមិនទាន់ច្បាស់។

---

## Version 2.3 — 🔴 Planned

| Feature | ការពិពណ៌នា | Status | Priority | Dependencies |
|---|---|---|---|---|
| Face Detection | ចាប់/សម្គាល់មុខមនុស្ស | 🔴 Planned | Medium | Vision AI |
| OCR | អានអក្សរពីរូបភាព | 🔴 Planned | High | Vision AI |
| Document Reader | អានឯកសារ PDF/Word ស្វ័យប្រវត្តិ | 🔴 Planned | High | OCR |
| Translation | បកប្រែភាសា | 🔴 Planned | Medium | — |
| Calendar | គ្រប់គ្រងកាលវិភាគ | 🔴 Planned | Low | — |
| Weather | ព័ត៌មានអាកាសធាតុ | 🔴 Planned | Low | — |

---

## Version 3.0 — ⚪ Future

| Feature | ការពិពណ៌នា | Status | Priority | Dependencies |
|---|---|---|---|---|
| Local LLM | ដំណើរការ AI ដោយឯកឯង (offline model) | ⚪ Future | High | — |
| Offline AI | ប្រើ AI ដោយគ្មាន internet | ⚪ Future | High | Local LLM |
| Offline Voice | TTS/STT ដំណើរការក្នុងម៉ាស៊ីនផ្ទាល់ (Coqui TTS / Whisper) | ⚪ Future | Medium | Local LLM (ភ្ជាប់ពី voice.md §12) |
| RAG | ស្វែងរកព័ត៌មានពី knowledge base | ⚪ Future | High | Local LLM |
| Knowledge Base | ប្រព័ន្ធផ្ទុកទិន្នន័យផ្ទាល់ខ្លួន | ⚪ Future | High | Database |
| Plugin System | បន្ថែម feature តាម plugin | ⚪ Future | Medium | Architecture redesign |
| Enterprise Dashboard | ផ្ទាំងគ្រប់គ្រងសម្រាប់អង្គភាព | ⚪ Future | Medium | — |

---

## Version 4.0 — ⚪ Long-Term

| Feature | ការពិពណ៌នា | Status | Priority | Dependencies |
|---|---|---|---|---|
| AI Agents | AI ធ្វើការស្វ័យប្រវត្តិដោយខ្លួនឯង | ⚪ Future | High | Local LLM, RAG |
| Multi-Agent Collaboration | Agent ច្រើនធ្វើការជាមួយគ្នា | ⚪ Future | Medium | AI Agents |
| Computer Control | ត្រួតត្រា/ប្រតិបត្តិលើកុំព្យូទ័រ | ⚪ Future | Medium | AI Agents |
| Automation | ស្វ័យប្រវត្តិកម្មភារកិច្ច | ⚪ Future | Medium | AI Agents |
| Robot Interface | តភ្ជាប់ជាមួយ hardware/robot | ⚪ Future | Low | Computer Control |
| Drone Interface | ត្រួតត្រាដ្រូន | ⚪ Future | Low | Robot Interface |

---

## Long Term Vision

- Universal AI Assistant
- Enterprise Platform
- Offline + Online Hybrid
- Open Architecture

---

## Voice Roadmap (ភ្ជាប់ពី voice.md §12)

| Feature | Status | Notes |
|---|---|---|
| OpenAI TTS | 🔜 Planned | Server-side, higher quality, via `/api/tts` |
| ElevenLabs TTS | 🔜 Planned | Premium quality, realistic Khmer voices |
| Offline Voice | 🔜 Planned | On-device model — ភ្ជាប់ជាមួយ Version 3.0 Local LLM |
| Voice Cloning | 🔜 Planned | User-owned voices only — no third-party voice use |
| Emotion Voice | 🔜 Planned | Adjust tone based on sentiment |
| Multi-language Voice | 🔜 Planned | Auto-switch lang based on detected input |

---

## Changelog

| ថ្ងៃ | ការផ្លាស់ប្តូរ |
|---|---|
| *(បញ្ចូលកាលបរិច្ឆេទ)* | បង្កើត roadmap.md ដំបូង |
| *(បញ្ចូលកាលបរិច្ឆេទ)* | បន្ថែម status/priority/dependencies table |
| *(បញ្ចូលកាលបរិច្ឆេទ)* | ធ្វើសមកាលកម្ម version number ជាមួយ voice.md (3.3→2.2), បន្ថែម module paths និង Voice Roadmap section |

---

### Legend
- ✅ Done — បានបញ្ចប់
- 🟡 In Progress — កំពុងធ្វើ
- 🔴 Planned — ត្រូវធ្វើក្នុងពេលឆាប់ៗ
- ⚪ Future — គម្រោងអនាគតឆ្ងាយ
- 🔜 Planned (feature-specific, ពី sub-docs)

---

*khoem-new/docs/roadmap.md*
