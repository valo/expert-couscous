'use client';

if (typeof window === 'undefined' && !('indexedDB' in globalThis)) {
    await import('fake-indexeddb/auto');
}

import { createStorage, cookieStorage } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';

export const projectId = process.env.NEXT_PUBLIC_PROJECT_ID

if (!projectId) {
    throw new Error('Project ID is not defined')
}

export const config = getDefaultConfig({
    appName: 'Dibor CDP',
    projectId,
    chains: [sepolia],
    ssr: true,
    storage: createStorage({
        storage: cookieStorage,
    }),
});
