import { expect, test, type Page } from "@playwright/test";

const WALLETCONNECT_RPC_MATCHER = "https://rpc.walletconnect.com/**";
const ZERO_32 = `0x${"0".repeat(64)}`;

type JsonRpcPayload = {
  id?: number | string | null;
  method: string;
  params?: Array<Record<string, unknown> | string>;
};

test.describe("Earn Page", () => {
  test.beforeEach(async ({ page }) => {
    await mockWalletConnectRpc(page);
    await page.goto("/earn");
  });

  test("renders default earn state when the wallet is disconnected", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Earn" })).toBeVisible();

    await expect(page.getByText("Current APY")).toBeVisible();
    await expect(page.getByText("—")).toBeVisible();

    const amountInput = page.getByPlaceholder("0.0");
    await expect(amountInput).toHaveValue("");

    const submitButton = page.getByRole("button", { name: "Connect wallet", exact: true });
    await expect(submitButton).toBeDisabled();

    await expect(page.getByRole("button", { name: "Max" })).toBeVisible();
  });

  test("switching between deposit and withdraw updates the amount field", async ({ page }) => {
    const amountInput = page.getByPlaceholder("0.0");
    await amountInput.fill("12.5");
    await expect(amountInput).toHaveValue("12.5");

    const withdrawButton = page.getByRole("button", { name: "Withdraw" });
    await withdrawButton.click();
    await expect(amountInput).toHaveValue("");

    const depositButton = page.getByRole("button", { name: "Deposit" });
    await depositButton.click();
    await expect(amountInput).toHaveValue("12.5");
  });

  test("shows withdraw labels when toggled", async ({ page }) => {
    await expect(page.getByText("Deposit amount")).toBeVisible();

    const withdrawButton = page.getByRole("button", { name: "Withdraw" });
    await withdrawButton.click();

    await expect(page.getByText("Withdraw amount")).toBeVisible();
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
      return "0xaa36a7";
    case "net_version":
      return "11155111";
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
    default:
      return ZERO_32;
  }
}
