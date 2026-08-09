# 📘 KHOEM_AI — ប្រព័ន្ធគ្រប់គ្រងទិន្នន័យហាង (Real Working App)

ប្រព័ន្ធនេះជា **App ពិតប្រាកដ** ដែលប្រើ Flask (Python) ជា Backend និង SQLite ជា Database ពិត — មិនមែនទិន្នន័យសិប្បនិម្មិត (Mockup) ទេ។ រាល់ការបន្ថែម/លុបទិន្នន័យ នឹងត្រូវបានរក្សាទុកជាអចិន្ត្រៃយ៍។

## 📁 រចនាសម្ព័ន្ធឯកសារ

```text
khoem-shop/
├── app.py                  # Backend Server (Flask + SQLite)
├── database/
│   └── shop.db              # Database ស្វ័យប្រវត្តិ (បង្កើតដោយខ្លួនឯង)
├── templates/
│   └── index.html            # Dashboard UI
├── static/
│   ├── css/ai.css            # Dark Theme, Responsive
│   └── js/ai.js              # Fetch API logic (Real CRUD)
└── README.md
```

## 🚀 របៀបដំឡើង និងដំណើរការ

1. ត្រូវប្រាកដថាមាន **Python 3.9+** ដំឡើងរួច
2. បើក Terminal / Command Prompt ទៅកាន់ Folder `khoem-shop`
3. ដំឡើង Flask៖
   ```bash
   pip install flask
   ```
4. ដំណើរការ Server៖
   ```bash
   python app.py
   ```
5. បើក Browser ទៅកាន់៖ **http://127.0.0.1:5000**

Database `shop.db` នឹងត្រូវបានបង្កើតដោយស្វ័យប្រវត្តិលើកដំបូងដែលបងចាប់ផ្ដើម Server។

## 🛠️ លក្ខណៈពិសេស

- **Dark Theme** ទំនើប សម្រួលភ្នែក
- **Responsive** ស្អាតលើ Mobile, Tablet, Desktop
- **CRUD ពិតប្រាកដ**៖ បន្ថែម និងលុបទិន្នន័យ ត្រូវបានរក្សាទុកក្នុង SQLite ជាអចិន្ត្រៃយ៍
- **Live Metrics**៖ ចំណូលសរុប, ចំនួនការបញ្ជាទិញ, ស្ថានភាពជោគជ័យ/រង់ចាំ គណនាផ្ទាល់ពី Database
- **ស្វែងរក (Search)** អតិថិជន ឬសេវាភ្លាមៗ
- គាំទ្រពុម្ពអក្សរខ្មែរ Kantumruy Pro

## 🔌 API Endpoints

| Method | Path                       | ការងារ                          |
|--------|----------------------------|----------------------------------|
| GET    | `/api/summary`              | ទាញទិន្នន័យសង្ខេប (Metrics)        |
| GET    | `/api/transactions`         | ទាញបញ្ជីប្រតិបត្តិការទាំងអស់        |
| POST   | `/api/transactions`         | បន្ថែមប្រតិបត្តិការថ្មី              |
| PUT    | `/api/transactions/<id>`    | កែប្រែប្រតិបត្តិការ                |
| DELETE | `/api/transactions/<id>`    | លុបប្រតិបត្តិការ                   |

## ⚠️ ចំណាំ

ការកំណត់ `debug=True` នៅក្នុង `app.py` សម្រាប់ការអភិវឌ្ឍន៍ (Development) ប៉ុណ្ណោះ។ សម្រាប់ដាក់ឱ្យប្រើប្រាស់ជាផ្លូវការ (Production) សូមប្ដូរទៅជា `debug=False` និងប្រើ Server ដូចជា `gunicorn`។
