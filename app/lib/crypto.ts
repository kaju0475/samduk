import crypto from 'crypto';

const SECRET_KEY = process.env.AUTH_SECRET || 'samduk-system-secure-qr-login-key-2026'; 
if (!process.env.AUTH_SECRET) {
    console.warn('[Crypto] AUTH_SECRET is not set. Using default insecure key. QR codes may not work across environments.');
}
const ALGORITHM = 'aes-256-gcm'; 

const getKey = () => {
    return crypto.createHash('sha256').update(SECRET_KEY).digest();
};

const IV_LENGTH = 12; // Standard GCM IV length
const TAG_LENGTH = 16; // Standard GCM Tag length

export const encryptToken = (text: string): string => {
    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
        
        const encrypted = Buffer.concat([
            cipher.update(text, 'utf8'),
            cipher.final()
        ]);
        
        const authTag = cipher.getAuthTag();
        
        // Standard Format: IV + Tag + Encrypted
        // Base64URL is the web standard for URL-safe tokens.
        const combined = Buffer.concat([iv, authTag, encrypted]);
        
        return combined.toString('base64url');
    } catch (error) {
        console.error('Encryption failed:', error);
        throw new Error('Encryption failed');
    }
};

export const decryptToken = (token: string): string => {
    try {
        // [Fix] Handle 'ENC-' prefix if present
        const cleanToken = token.startsWith('ENC-') ? token.replace('ENC-', '') : token;
        
        const buffer = Buffer.from(cleanToken, 'base64url');
        
        if (buffer.length < IV_LENGTH + TAG_LENGTH) {
            console.error('[Crypto] Token too short:', buffer.length);
            return '';
        }

        const iv = buffer.subarray(0, IV_LENGTH);
        const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
        const encryptedText = buffer.subarray(IV_LENGTH + TAG_LENGTH);
        
        const key = getKey();
        // Log a hash of the key just to see if it changes across environments without exposing the secret
        const keyHash = crypto.createHash('md5').update(key).digest('hex').substring(0, 8);
        console.log(`[Crypto] Decrypting with Key-Hash: ${keyHash}`);

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);
        
        const decrypted = Buffer.concat([
            decipher.update(encryptedText),
            decipher.final()
        ]);
        
        return decrypted.toString('utf8');
    } catch (error: any) {
        console.error('[Crypto] Decryption Exception:', error.message);
        return '';
    }
};
