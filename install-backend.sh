#!/data/data/com.termux/files/usr/bin/bash
# ============================================================
# CAI Pro Vision — Backend installer (all-in-one)
# រត់ក្នុងថត root នៃ repo "CAI" (ថតដែលមាន backend/ រួចហើយ)
#   cd ~/CAI-new
#   bash install-backend.sh
# ============================================================
set -e

if [ ! -d backend ]; then
  echo "❌ រកមិនឃើញថត backend/ ក្នុងទីតាំងបច្ចុប្បន្នទេ។"
  echo "   សូម cd ចូលថត root នៃ repo CAI សិន (ថតដែលមាន backend/, docs/, frontend/)."
  exit 1
fi

echo "============================================================"
echo " ជំហានទី 1/4 — សរសេរ package.json + tsconfig.json"
echo "============================================================"

cat > backend/package.json << 'CAIEOF'
{
  "name": "cai-backend",
  "version": "1.0.0",
  "private": true,
  "description": "CAI Pro Vision — standalone Auth/RBAC backend (Phase 2 prototype)",
  "main": "server.ts",
  "scripts": {
    "dev": "tsx watch server.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js",
    "migrate": "tsx db/migrate.ts"
  },
  "dependencies": {
    "bcrypt": "^5.1.1",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "express-rate-limit": "^7.4.0",
    "helmet": "^7.1.0",
    "jsonwebtoken": "^9.0.2",
    "pg": "^8.12.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/bcrypt": "^5.0.2",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jsonwebtoken": "^9.0.6",
    "@types/node": "^22.5.0",
    "@types/pg": "^8.11.6",
    "tsx": "^4.19.0",
    "typescript": "^5.5.4"
  }
}
CAIEOF
echo "  ✅ backend/package.json"

cat > backend/tsconfig.json << 'CAIEOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "strict": true,
    "outDir": "dist",
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
CAIEOF
echo "  ✅ backend/tsconfig.json"

echo ""
echo "============================================================"
echo " ជំហានទី 2/4 — npm install (backend/)"
echo "============================================================"
cd backend
npm install

echo ""
echo "============================================================"
echo " ជំហានទី 3/4 — .env setup"
echo "============================================================"
if [ -f .env ]; then
  echo "  ⏭️  .env មានរួចហើយ — មិនសរសេរជាន់ទេ។"
else
  if [ ! -f .env.example ]; then
    echo "  ❌ រកមិនឃើញ .env.example ទេ — សូមប្រាកដថាបាន copy ចេញពី setup-cai-db.sh រួចហើយ។"
    exit 1
  fi
  cp .env.example .env
  echo "  ✅ បានចម្លង .env.example → .env"
  echo ""
  echo "  🔑 កំពុងបង្កើត JWT secrets ស្វ័យប្រវត្តិ..."
  ACCESS_SECRET=$(openssl rand -hex 32)
  REFRESH_SECRET=$(openssl rand -hex 32)
  # ប្រើ sed ជំនួសតម្លៃ placeholder ដោយផ្ទាល់ក្នុង .env
  sed -i "s#JWT_ACCESS_SECRET=.*#JWT_ACCESS_SECRET=${ACCESS_SECRET}#" .env
  sed -i "s#JWT_REFRESH_SECRET=.*#JWT_REFRESH_SECRET=${REFRESH_SECRET}#" .env
  echo "  ✅ JWT_ACCESS_SECRET និង JWT_REFRESH_SECRET ត្រូវបានបង្កើតដោយស្វ័យប្រវត្តិ"
  echo ""
  echo "  ⚠️  សូមកែ DATABASE_URL ក្នុង .env ដោយដៃ ឱ្យត្រូវនឹង PostgreSQL ពិតរបស់បង៖"
  echo "      DATABASE_URL=postgres://<user>:<password>@localhost:5432/<database>"
  echo ""
  read -p "  👉 តើ DATABASE_URL បច្ចុប្បន្ន (postgres://cai_app_user:changeme@localhost:5432/cai) ត្រឹមត្រូវរួចហើយឬទេ? (y/n): " db_ok
  if [ "$db_ok" != "y" ] && [ "$db_ok" != "Y" ]; then
    read -p "  សូមវាយ DATABASE_URL ត្រឹមត្រូវ (ទុកទទេ = រំលង, កែក្រោយដោយ nano .env): " new_db_url
    if [ -n "$new_db_url" ]; then
      escaped_url=$(printf '%s\n' "$new_db_url" | sed -e 's/[\/&]/\\&/g')
      sed -i "s#DATABASE_URL=.*#DATABASE_URL=${escaped_url}#" .env
      echo "  ✅ DATABASE_URL ត្រូវបានកែប្រែ"
    else
      echo "  ⏭️  រំលង — សូមកែ .env ដោយដៃពេលក្រោយ (nano .env)"
    fi
  fi
fi

echo ""
echo "============================================================"
echo " ជំហានទី 4/4 — Database migration + ចាប់ផ្តើម server"
echo "============================================================"
read -p "  👉 ចង់រត់ 'npm run migrate' ឥឡូវនេះទេ? (ត្រូវការ PostgreSQL កំពុងដំណើរការ) (y/n): " do_migrate
if [ "$do_migrate" = "y" ] || [ "$do_migrate" = "Y" ]; then
  npm run migrate
  echo "  ✅ Migration ចប់"
else
  echo "  ⏭️  រំលង migration — រត់ដោយដៃពេលក្រោយ: cd backend && npm run migrate"
fi

echo ""
read -p "  👉 ចង់ចាប់ផ្តើម backend server ('npm run dev') ឥឡូវនេះទេ? (y/n): " do_start
if [ "$do_start" = "y" ] || [ "$do_start" = "Y" ]; then
  echo "  🚀 កំពុងចាប់ផ្តើម server នៅ http://localhost:4000 ..."
  echo "     (ចុច Ctrl+C ដើម្បីបញ្ឈប់)"
  npm run dev
else
  echo ""
  echo "🎉 ការដំឡើងចប់សព្វគ្រប់! ចាប់ផ្តើម server ពេលក្រោយដោយ៖"
  echo "     cd backend && npm run dev"
  echo ""
  echo "សាកល្បង៖  curl http://localhost:4000/health"
fi
