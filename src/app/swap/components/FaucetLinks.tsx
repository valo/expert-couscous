export function FaucetLinks() {
  return (
    <div className="mt-6 space-y-2 text-xs text-neutral-500 dark:text-neutral-400">
      <p>
        To get some Sepolia USDC, use this faucet:{" "}
        <a
          href="https://faucet.circle.com/"
          target="_blank"
          rel="noreferrer"
          className="text-blue-600 hover:underline"
        >
          https://faucet.circle.com/
        </a>
      </p>
      <p>
        For some Sepolia ETH for gas, use this faucet:{" "}
        <a
          href="https://cloud.google.com/application/web3/faucet/ethereum/sepolia"
          target="_blank"
          rel="noreferrer"
          className="text-blue-600 hover:underline"
        >
          https://cloud.google.com/application/web3/faucet/ethereum/sepolia
        </a>
      </p>
    </div>
  );
}
