
export type SmartScanIntent = 'CUSTOMER' | 'CYLINDER' | 'USER' | 'AMBIGUOUS';

export interface SmartScanParseResult {
    rawTarget: string;
    cleanTarget: string;
    intent: SmartScanIntent;
    isNumeric: boolean;
    rawDigits: string;
    numberVal: number;
}

/**
 * Pure Function: Analyzes the raw QR string and extracts intent and clean target.
 */
export const parseSmartScan = (rawQr: string): SmartScanParseResult | null => {
    if (!rawQr) return null;
    const rawTarget = rawQr.trim();

    // --- Channel 1: Intent Analysis (Before Stripping) ---
    // Detect what the user *likely* scanned based on prefixes
    let intent: SmartScanIntent = 'AMBIGUOUS';
    
    if (rawTarget.match(/^(c|cust|st|u|business|create)[:\-_]?/i) || rawTarget.includes('/customers/')) intent = 'CUSTOMER';
    else if (rawTarget.match(/^(s|sdg|cyl|gas)[:\-_]?/i) || rawTarget.includes('/cylinders/')) intent = 'CYLINDER';
    else if (rawTarget.match(/^(user|worker|w)[:\-_]?/i)) intent = 'USER';

    // --- Cleanup: Strip Common Prefixes ---
    // e.g. "https://samduk.vercel.app/cylinders/xyz" -> "xyz"
    let cleanTarget = rawTarget.replace(/^https?:\/\/[^\/]+\/(cylinders\/?|auth\/login\?token=|customers\/)?/i, '');
    
    // [FIX] Robust Slash Cleanup
    cleanTarget = cleanTarget.replace(/^\//, '');

    // e.g. "CUST:C123" -> "c123", "sdg:1001" -> "1001"
    cleanTarget = cleanTarget.replace(/^(cust|sdg|cyl|user|worker|business)[:\-_]*/gi, '');
    cleanTarget = cleanTarget.replace(/^(st|u|s|w|c)[:\-_]+/gi, ''); // Single chars REQUIRE separator

    // 2.1 Extract Core Digits
    const digitMatch = cleanTarget.match(/(\d+)$/);
    const rawDigits = digitMatch ? digitMatch[1] : '';
    const numberVal = rawDigits ? parseInt(rawDigits, 10) : -1;

    return {
        rawTarget,
        cleanTarget,
        intent,
        isNumeric: !!rawDigits && !isNaN(numberVal),
        rawDigits,
        numberVal
    };
};

/**
 * Generates candidate strings for Customer Lookup
 */
export const generateCustomerCandidates = (parse: SmartScanParseResult): string[] => {
    const candidates = new Set<string>();
    candidates.add(parse.cleanTarget); // Exact ID Check (e.g. "c1766...")
    
    if (parse.isNumeric) {
        const padded3 = String(parse.numberVal).padStart(3, '0');
        candidates.add(parse.rawDigits);        // Ledger "004"
        candidates.add(String(parse.numberVal));// Ledger "4"
        candidates.add(padded3);          // Ledger "004"
        candidates.add(`cust-${parse.rawDigits}`);// ID "cust-004"
        candidates.add(`cust-${padded3}`);  // ID "cust-004"
    }
    return Array.from(candidates);
};

/**
 * Generates candidate strings for Cylinder Lookup
 */
export const generateCylinderCandidates = (parse: SmartScanParseResult): string[] => {
    const candidates = new Set<string>();
    candidates.add(parse.cleanTarget); // Original
    candidates.add(parse.cleanTarget.toLowerCase());
    candidates.add(parse.cleanTarget.toUpperCase());
    candidates.add(parse.rawTarget);
    candidates.add(parse.rawTarget.toUpperCase());
    
    if (parse.isNumeric) {
        const padded3 = String(parse.numberVal).padStart(3, '0');
        const padded4 = String(parse.numberVal).padStart(4, '0');
        candidates.add(`sdg-${parse.rawDigits}`);
        candidates.add(`sdg-${padded4}`);
        // [TEST DATA SUPPORT]
        candidates.add(`cyl-test-${parse.rawDigits}`); // Legacy Test Format
        candidates.add(`sdg-test-${parse.rawDigits}`); // New Test Format
        candidates.add(`test-exp-${padded3}`);
    }
    return Array.from(candidates);
};
