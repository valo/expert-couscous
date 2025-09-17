'use client';

import { http, createStorage, cookieStorage } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { Chain, getDefaultConfig } from '@rainbow-me/rainbowkit'

const projectId = 'dibor-cdp-ui';

const supportedChains: Chain[] = [sepolia];

export const config = getDefaultConfig({
    appName: 'Dibor CDP',
    projectId,
    chains: supportedChains as any,
    ssr: true,
    storage: createStorage({
        storage: cookieStorage,
    }),
    transports: supportedChains.reduce((obj, chain) => ({ ...obj, [chain.id]: http() }), {})
});