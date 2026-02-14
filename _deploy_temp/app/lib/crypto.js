"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decryptToken = exports.encryptToken = void 0;
var crypto_1 = __importDefault(require("crypto"));
var SECRET_KEY = process.env.AUTH_SECRET || 'samduk-system-secure-qr-login-key-2026';
var ALGORITHM = 'aes-256-gcm';
var getKey = function () {
    return crypto_1.default.createHash('sha256').update(SECRET_KEY).digest();
};
var IV_LENGTH = 12; // Standard GCM IV length
var TAG_LENGTH = 16; // Standard GCM Tag length
var encryptToken = function (text) {
    try {
        var iv = crypto_1.default.randomBytes(IV_LENGTH);
        var cipher = crypto_1.default.createCipheriv(ALGORITHM, getKey(), iv);
        var encrypted = Buffer.concat([
            cipher.update(text, 'utf8'),
            cipher.final()
        ]);
        var authTag = cipher.getAuthTag();
        // Standard Format: IV + Tag + Encrypted
        // Base64URL is the web standard for URL-safe tokens.
        var combined = Buffer.concat([iv, authTag, encrypted]);
        return combined.toString('base64url');
    }
    catch (error) {
        console.error('Encryption failed:', error);
        throw new Error('Encryption failed');
    }
};
exports.encryptToken = encryptToken;
var decryptToken = function (token) {
    try {
        // [Fix] Handle 'ENC-' prefix if present
        var cleanToken = token.startsWith('ENC-') ? token.replace('ENC-', '') : token;
        var buffer = Buffer.from(cleanToken, 'base64url');
        if (buffer.length < IV_LENGTH + TAG_LENGTH)
            return '';
        var iv = buffer.subarray(0, IV_LENGTH);
        var authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
        var encryptedText = buffer.subarray(IV_LENGTH + TAG_LENGTH);
        var decipher = crypto_1.default.createDecipheriv(ALGORITHM, getKey(), iv);
        decipher.setAuthTag(authTag);
        var decrypted = Buffer.concat([
            decipher.update(encryptedText),
            decipher.final()
        ]);
        return decrypted.toString('utf8');
    }
    catch (error) {
        return '';
    }
};
exports.decryptToken = decryptToken;
