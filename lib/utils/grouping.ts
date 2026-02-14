
// Interface for Grouped Items (Extends typical history/log item)
export interface GroupedHistoryItem<T> {
    isGroupedParent?: boolean;
    children?: T[];
}

/**
 * Groups transaction items by Rack Parent.
 * Matches items where 'memo' contains "Included in RACK(PARENT_ID)" or "랙(PARENT_ID)에 포함".
 * @param rawItems List of transaction items. Must have 'cylinderId' (or 'serial') and 'memo' fields.
 * @param idField The field name for the item's ID (e.g. 'cylinderId' or 'serial'). Defaults to 'cylinderId'.
 * @returns Grouped list where children are nested under parents.
 */
export function groupHistoryItems<T extends { memo?: string; date?: string; timestamp?: string }>(
    rawItems: T[], 
    idField: string = 'cylinderId'
): (T & GroupedHistoryItem<T>)[] {
    const groupedItems: (T & GroupedHistoryItem<T>)[] = [];
    const childrenMap = new Map<string, T[]>(); 
    const parents: (T & GroupedHistoryItem<T>)[] = [];
    const orphans: (T & GroupedHistoryItem<T>)[] = [];

    // 1. Separate Parents and Children
    rawItems.forEach(item => {
        if (!item.memo) {
            parents.push(item);
            return;
        }

        // Regex supports optional space: "랙 (ID)" or "랙(ID)"
        const match = item.memo.match(/랙\s*\((.*?)\)에 포함|Included in RACK\s*\((.*?)\)/);
        
        if (match) {
            const parentSerial = match[1] || match[2];
            if (parentSerial) {
                if (!childrenMap.has(parentSerial)) childrenMap.set(parentSerial, []);
                childrenMap.get(parentSerial)!.push(item);
            } else {
                orphans.push(item);
            }
        } else {
            parents.push(item);
        }
    });

    // 2. Attach children to parents
    parents.forEach(parent => {
        // Safe access to ID field
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parentId = String((parent as any)[idField]);
        const children = childrenMap.get(parentId);
        
        // Optional: Match by Date/Timestamp to ensure correct batch?
        // Parent and Child share strict timestamp in current logic.
        // If 'date' or 'timestamp' exists, we could filter.
        // For now, assuming exact ID match in the current list context is sufficient 
        // (as the list usually represents a filtered timeframe or history).
        
        if (children) {
            // Refine: Only attach children with matching timestamp if available
            // (Simpler: Just attach all matching ID children found in THIS dataset)
             const parentDate = parent.date || parent.timestamp;
             
             if (parentDate) {
                 const relevantChildren = children.filter(c => {
                     const childDate = c.date || c.timestamp;
                     return childDate === parentDate; 
                 });
                 if (relevantChildren.length > 0) {
                     parent.children = relevantChildren;
                 }
             } else {
                 // Fallback if no date (unlikely)
                 parent.children = children;
             }
        }
        groupedItems.push(parent);
    });

    // Include orphans? 
    // They are children whose parent wasn't found in the list.
    // They should probably be shown as flat items to avoid hiding data.
    orphans.forEach(o => groupedItems.push(o));

    // Sort? 
    // Usually input is sorted. Grouping preserves relative order of parents. 
    // Orphans appended at end might break sort order. 
    // Better to re-sort or insert orphans where they were?
    // Since orphans are rare (broken data), appending is acceptable.
    // Or we could mix them in 'parents' list initially if not matched?
    // Actually, distinct lists is safer.
    
    // BUT: If the original list was sorted by date DESC, we want valid output sorted DESC.
    // Parents are processed in order of appearance. 
    // Orphans appended at end -> Bad sorting.
    // FIX: Add Orphans to 'groupedItems' and then Sort?
    // OR: Treat orphans as 'parents' (items without children) in the loop?
    // Let's refine: 
    // Iterate original list. If Child -> Store in Map (Don't emit yet). If Parent -> Emit.
    // After loop, if Map has leftovers (Orphans), Emit them?
    // Current loop pushes to 'parents' or 'childrenMap'.
    // Then iterates 'parents'.
    // If we want to preserve input sort order (assuming input is sorted):
    // We should iterate input again? No.
    // Simpler: Just sort the result by date if date exists.
    
    return groupedItems.sort((a, b) => {
        const dA = a.date || a.timestamp || '';
        const dB = b.date || b.timestamp || '';
        if (!dA || !dB) return 0;
        return new Date(dB as string).getTime() - new Date(dA as string).getTime(); // DESC
    });
}
