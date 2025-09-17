'use client';

import { http, createStorage, cookieStorage } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { Chain, getDefaultConfig } from '@rainbow-me/rainbowkit';

const projectId = 'dibor-cdp-ui';

const supportedChains: Chain[] = [sepolia];

const transports = Object.fromEntries(
    supportedChains.map((chain) => [chain.id, http()])
) as Record<number, ReturnType<typeof http>>;

export const config = getDefaultConfig({
    appName: 'Dibor CDP',
    projectId,
    chains: supportedChains,
    ssr: true,
    storage: createStorage({
        storage: cookieStorage,
    }),
    transports,
});
