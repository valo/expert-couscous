"use client";

import { WagmiProvider, cookieToInitialState } from "wagmi";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { config } from "@/lib/config";

const queryClient = new QueryClient();

type Props = {
    children: React.ReactNode;
    cookie?: string | null;
};

export default function Providers({ children, cookie }: Props) {
    const initialState = typeof window === 'undefined'
        ? undefined
        : cookieToInitialState(config, cookie);

    return (
        <WagmiProvider config={config} initialState={initialState}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider>
                    {children}
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
}
