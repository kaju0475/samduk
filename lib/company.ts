
// import { db } from './db'; // [FIX] Circular dependency removed

/**
 * Checks if a given name matches the company name or any of its aliases.
 * Uses consistent constants to prevent heavy DB load.
 * @param name The name to check (e.g. 'SDG', '삼덕')
 * @returns true if it matches a company alias
 */
export function isCompanyAlias(name: string | null | undefined): boolean {
    if (!name) return false;
    
    // Default Settings (Decoupled from DB)
    const settings = { 
        companyName: '삼덕가스공업(주)', 
        aliases: ['삼덕', 'SDG', '삼덕가스', 'SAMDUK', '삼덕공장'] 
    };

    const normalized = name.trim();
    
    // 1. Check Main Company Name
    if (normalized === settings.companyName) return true;

    // 2. Check Aliases (Case Check?)
    // While 'aliases' in DB might be mixed case, let's assume we want case-insensitive for English aliases like SDG/sdg.
    const aliases = settings.aliases || [];
    
    // Exact match on aliases (case-insensitive for safety)
    return aliases.some(alias => alias.toLowerCase() === normalized.toLowerCase());
}

/**
 * Returns '삼덕공장' (Canonical ID) if the input is an alias, otherwise returns the input.
 * Useful for normalizing owner/location fields.
 */
export function normalizeCompanyOwner(name: string): string {
    if (isCompanyAlias(name)) {
        return '삼덕공장'; // Internal Canonical ID
    }
    return name;
}
