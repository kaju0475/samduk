export const safeLowerCase = (str: string | undefined | null): string => {
    if (!str || typeof str !== 'string') return '';
    return str.trim().toLowerCase();
};

export const safeIncludes = (target: string | undefined | null, search: string | undefined | null): boolean => {
    if (!target) return false;
    if (!search) return true; // Empty search usually means "match all" or "no filter"
    return safeLowerCase(target).includes(safeLowerCase(search));
};

export const safeCompare = (a: string | undefined | null, b: string | undefined | null): boolean => {
    return safeLowerCase(a) === safeLowerCase(b);
};
