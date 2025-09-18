'use client';

if (typeof window === 'undefined' && !('indexedDB' in globalThis)) {
    await import('fake-indexeddb/auto');
}

import { createStorage, cookieStorage } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';

const projectId = 'dibor-cdp-ui';

export const config = getDefaultConfig({
    appName: 'Dibor CDP',
    projectId,
    chains: [sepolia],
    ssr: true,
    storage: createStorage({
        storage: cookieStorage,
    }),
});
