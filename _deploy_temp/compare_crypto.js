
const crypto = require('crypto');
const SECRET_KEY = 'samduk-system-secure-qr-login-key-2026';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const getKey = () => crypto.createHash('sha256').update(SECRET_KEY).digest();

const encryptToken = (text) => {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const combined = Buffer.concat([iv, authTag, encrypted]);
    return combined.toString('base64url');
};

const uuid = '550e8400-e29b-41d4-a716-446655440000';
const username = 'admin';

const encUuid = encryptToken(uuid);
const encUser = encryptToken(username);

console.log('UUID Encrypted Length:', encUuid.length, encUuid);
console.log('User Encrypted Length:', encUser.length, encUser);
