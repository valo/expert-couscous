import { expect, test, type Page } from "@playwright/test";

const WALLETCONNECT_RPC_MATCHER = "https://rpc.walletconnect.com/**";
const ZERO_32 = `0x${"0".repeat(64)}`;
const FIFTY_USDC_ENCODED = "0x0000000000000000000000000000000000000000000000000000000002faf080";

type JsonRpcPayload = {
  id?: number | string | null;
  method: string;
  params?: Array<Record<string, unknown> | string>;
};

test.describe("Swap Page", () => {
  test.beforeEach(async ({ page }) => {
    await mockWalletConnectRpc(page);
    await page.goto("/swap");
  });

  test("renders default swap state when the wallet is disconnected", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Swap" })).toBeVisible();

    await expect(page.getByTestId("direction-toggle")).toHaveText("USDC → dbUSD");

    await expect(page.getByTestId("from-token-symbol")).toHaveText("USDC");
    await expect(page.getByTestId("to-token-symbol")).toHaveText("dbUSD");

    const submitButton = page.getByTestId("swap-submit-button");
    await expect(submitButton).toBeDisabled();
    await expect(submitButton).toHaveText("Connect wallet");

    await expect(page.getByTestId("to-amount-display")).toHaveText("0.0");
    await expect(page.getByTestId("status-message")).toHaveCount(0);
  });

  test("switching direction updates labels and clears typed amount", async ({ page }) => {
    const amountInput = page.getByTestId("amount-input");
    await amountInput.fill("12.5");
    await expect(amountInput).toHaveValue("12.5");

    const toggle = page.getByTestId("direction-toggle");
    await toggle.click();

    await expect(toggle).toHaveText("dbUSD → USDC");
    await expect(page.getByTestId("from-token-symbol")).toHaveText("dbUSD");
    await expect(page.getByTestId("to-token-symbol")).toHaveText("USDC");
    await expect(amountInput).toHaveValue("");
  });

  test("faucet links are visible for quick funding guidance", async ({ page }) => {
    const usdcFaucet = page.getByRole("link", { name: "https://faucet.circle.com/" });
    await expect(usdcFaucet).toBeVisible();
    await expect(usdcFaucet).toHaveAttribute("href", "https://faucet.circle.com/");

    const ethFaucet = page.getByRole("link", {
      name: "https://cloud.google.com/application/web3/faucet/ethereum/sepolia",
    });
    await expect(ethFaucet).toBeVisible();
    await expect(ethFaucet).toHaveAttribute(
      "href",
      "https://cloud.google.com/application/web3/faucet/ethereum/sepolia",
    );
  });
});

async function mockWalletConnectRpc(page: Page) {
  await page.route(WALLETCONNECT_RPC_MATCHER, async (route) => {
    const request = route.request();
    const postData = request.postData();

    if (!postData) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ jsonrpc: "2.0", id: null, result: ZERO_32 }),
      });
      return;
    }

    let payload: JsonRpcPayload | JsonRpcPayload[];

    try {
      payload = JSON.parse(postData) as JsonRpcPayload | JsonRpcPayload[];
    } catch {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ jsonrpc: "2.0", id: null, result: ZERO_32 }),
      });
      return;
    }

    if (Array.isArray(payload)) {
      const responses = payload.map((call) => formatRpcResponse(call));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(responses),
      });
      return;
    }

    const response = formatRpcResponse(payload);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(response),
    });
  });
}

function formatRpcResponse(call: JsonRpcPayload) {
  return {
    jsonrpc: "2.0",
    id: call.id ?? null,
    result: resolveRpcResult(call),
  };
}

function resolveRpcResult(call: JsonRpcPayload): unknown {
  switch (call.method) {
    case "eth_chainId":
      return "0xaa36a7"; // Sepolia
    case "net_version":
      return "11155111"; // Sepolia network id
    case "eth_blockNumber":
      return "0x1";
    case "eth_getBalance":
    case "eth_getTransactionCount":
    case "eth_estimateGas":
    case "eth_gasPrice":
      return "0x0";
    case "eth_getLogs":
      return [];
    case "eth_getBlockByNumber":
      return {
        number: "0x1",
        hash: ZERO_32,
        parentHash: ZERO_32,
        timestamp: "0x0",
        transactions: [],
      };
    case "eth_call": {
      const params = Array.isArray(call.params) ? call.params : [];
      const payload = params[0] as Record<string, unknown> | undefined;
      const data = typeof payload?.data === "string" ? payload.data : "";

      if (data.startsWith("0x70a08231")) {
        return FIFTY_USDC_ENCODED; // balanceOf(address)
      }

      return ZERO_32;
    }
    default:
      return ZERO_32;
  }
}
