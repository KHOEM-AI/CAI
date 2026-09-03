import crypto from 'node:crypto';

const password = 'password123';
const salt = crypto.randomBytes(16).toString('hex');
const derived = crypto.scryptSync(password, salt, 64).toString('hex');
const passwordHash = `${salt}:${derived}`;
const userId = `user_${crypto.randomUUID()}`;

console.log('--- COPY THE SQL BELOW ---');
console.log(`INSERT INTO cai_users (id, name, email, password_hash, role) VALUES ('${userId}', 'Field Operator', 'operator@cai.gov.kh', '${passwordHash}', 'admin');`);
console.log('--- LOGIN CREDENTIALS ---');
console.log('Email: operator@cai.gov.kh');
console.log('Password: password123');
