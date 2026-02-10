/**
 * Centralized Display Name Resolution Helper
 * 
 * Purpose:
 * To unify the display name of 'Samduk' across the application
 * without altering the underlying ID ('삼덕공장') or Owner ('삼덕용기') in the database.
 * 
 * Rules:
 * - Logic/DB: '삼덕공장' (Location ID), '삼덕용기' (Owner) -> Immutable
 * - Display: '삼덕가스공업(주)' -> Mutable/User-Friendly
 */

export const SAMDUK_DISPLAY_NAME = '삼덕가스공업(주)';

/**
 * Resolves the display name for a cylinder's owner.
 * Maps 'SAMDUK' to '삼덕용기' per user request.
 */
export function resolveOwnerName(owner: string | null | undefined): string {
    if (!owner) return '삼덕용기';
    
    const normalized = owner.toUpperCase().trim();
    // [FIX] User Request: Owner -> '삼덕가스'
    if (normalized === '삼덕공장' || normalized === '삼덕용기' || normalized === 'SAMDUK') {
        return '삼덕가스';
    }
    
    return owner;
}

export const SAMDUK_SHORT_NAME = '삼덕가스';

/**
 * UI-ONLY: Resolves the SHORT display name ('삼덕가스').
 * Use this for screen display (tables, cards) where space is limited or brevity is preferred.
 * DO NOT use this for official documents or QR codes.
 */
export function resolveShortOwnerName(owner: string | null | undefined): string {
    const fullName = resolveOwnerName(owner);
    // If it's already short enough or special, return it
    if (fullName === '삼덕용기') return fullName;
    return fullName === SAMDUK_DISPLAY_NAME ? SAMDUK_SHORT_NAME : fullName;
}

/**
 * UI-ONLY: Resolves the SHORT holder/location name.
 */
export function resolveShortHolderName(id: string | null | undefined): string {
    const fullName = resolveHolderName(id);
    return fullName;
}

/**
 * Resolves the display name for a location/holder ID.
 * Maps '삼덕공장' -> '삼덕공장' (Preserve for Recall/Inspection)
 * Maps 'SAMDUK' -> '삼덕가스' (General History)
 */
export function resolveHolderName(id: string | null | undefined): string {
    if (!id) return SAMDUK_DISPLAY_NAME; 
    
    const normalized = id.toUpperCase().trim();
    
    // [FIX] User Request: Recall/Inspection -> '삼덕공장'
    // [FIX] Standardize ALL 'Samduk' location variants to '삼덕공장'
    if (normalized === '삼덕공장' || normalized === 'SAMDUK' || normalized === '삼덕가스공업(주)' || normalized === '삼덕가스') {
        return '삼덕공장';
    }

    if (normalized === 'INSPECTION_AGENCY') {
        return '검사소';
    }
    
    return id;
}

/**
 * Resolves the display status color for badges based on standardized status
 */
export function getStatusColor(status: string): string {
    switch (status) {
        case '실병': return 'blue';
        case '공병': return 'green';
        case '충전중': return 'yellow';
        case '납품': return 'cyan';
        case '검사대상': return 'pink';
        case '검사중': return 'violet';
        case '폐기': return 'red';
        default: return 'gray';
    }
}

/**
 * Formats a date string (YYYY-MM-DD) to YYYY-MM for display.
 * @param dateStr The date string to format.
 * @returns 'YYYY-MM' or original string if invalid/short.
 */
export function formatExpiryDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '-';
    // If it's already YYYY-MM (7 chars) or longer, slice it.
    if (dateStr.length >= 7) {
        return dateStr.substring(0, 7);
    }
    return dateStr;
}
