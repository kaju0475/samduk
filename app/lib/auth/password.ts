
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * Hash a plain text password.
 * @param password Plain text password
 * @returns Hashed password string
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password) {
    throw new Error('Password is required');
  }
  return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a plain text password against a hash.
 * @param password Plain text password
 * @param hash Stored password hash
 * @returns true if valid, false otherwise
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) {
    return false;
  }
  
  // 1. Try bcrypt comparison (Secure)
  const isMatch = await bcrypt.compare(password, hash);
  if (isMatch) return true;

  // 2. Fallback: Plain Text comparison (Legacy Support)
  // This allows users with unhashed passwords to still login.
  // TODO: Ideally, we should re-hash and save the password here, but for now we just allow access.
  return password === hash;
}
