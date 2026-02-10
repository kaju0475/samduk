'use client';

import Script from "next/script";

export function BpacScript() {
    return (
        <Script 
            src="/lib/bpac.js" 
            strategy="afterInteractive" 
            onError={(e) => { console.error('b-PAC Script failed to load', e); }}
        />
    );
}
