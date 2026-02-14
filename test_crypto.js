
const crypto = require('crypto');

const SECRET_KEY = 'samduk-system-secure-qr-login-key-2026';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

const getKey = () => {
    return crypto.createHash('sha256').update(SECRET_KEY).digest();
};

const encryptToken = (text) => {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const combined = Buffer.concat([iv, authTag, encrypted]);
    return combined.toString('base64url');
};

const decryptToken = (token) => {
    try {
        const buffer = Buffer.from(token, 'base64url');
        if (buffer.length < IV_LENGTH + TAG_LENGTH) return 'ERR_LENGTH';
        const iv = buffer.subarray(0, IV_LENGTH);
        const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
        const encryptedText = buffer.subarray(IV_LENGTH + TAG_LENGTH);
        const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
        decipher.setAuthTag(authTag);
        const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
        return decrypted.toString('utf8');
    } catch (e) {
        return 'ERR_EXCEPTION: ' + e.message;
    }
};

const id = 'USER-admin';
const encrypted = encryptToken(id);
console.log('ID:', id);
console.log('Encrypted:', encrypted);
console.log('Decrypted:', decryptToken(encrypted));
