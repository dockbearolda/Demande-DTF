import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import { createWrapper } from "./test-utils";

const getMock = vi.fn();
const postMock = vi.fn();

vi.mock("@/lib/api", () => ({
  api: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
  },
}));

import {
  useBat,
  useBatsForOrder,
  useLinkBat,
  useSearchBats,
} from "../useBats";

afterEach(() => {
  getMock.mockReset();
  postMock.mockReset();
});

describe("useSearchBats", () => {
  it("builds a query string from the supplied filters", async () => {
    getMock.mockResolvedValueOnce({ data: [] });
    const { wrapper } = createWrapper();
    renderHook(
      () =>
        useSearchBats({
          client_id: "c1",
          model_reference: "H-001",
          color_id: "noir",
          query: "logo",
          days: 90,
          limit: 25,
        }),
      { wrapper },
    );

    await waitFor(() => expect(getMock).toHaveBeenCalled());
    const url = getMock.mock.calls[0][0] as string;
    expect(url.startsWith("/bat/search/list?")).toBe(true);
    expect(url).toContain("client_id=c1");
    expect(url).toContain("model_reference=H-001");
    expect(url).toContain("color_id=noir");
    expect(url).toContain("query=logo");
    expect(url).toContain("days=90");
    expect(url).toContain("limit=25");
  });

  it("does not run when enabled=false", async () => {
    const { wrapper } = createWrapper();
    renderHook(() => useSearchBats({ enabled: false }), { wrapper });
    // Give react-query a tick to attempt the fetch (it shouldn't).
    await new Promise((r) => setTimeout(r, 20));
    expect(getMock).not.toHaveBeenCalled();
  });
});

describe("useBatsForOrder", () => {
  it("does not fetch when orderId is undefined", async () => {
    const { wrapper } = createWrapper();
    renderHook(() => useBatsForOrder(undefined), { wrapper });
    await new Promise((r) => setTimeout(r, 20));
    expect(getMock).not.toHaveBeenCalled();
  });

  it("fetches /bat/order/{id} when given an id", async () => {
    getMock.mockResolvedValueOnce({ data: [{ id: "b1" }] });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useBatsForOrder("o1"), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(getMock).toHaveBeenCalledWith("/bat/order/o1");
  });
});

describe("useBat", () => {
  it("fetches /bat/{id}", async () => {
    getMock.mockResolvedValueOnce({ data: { id: "b1" } });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useBat("b1"), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(getMock).toHaveBeenCalledWith("/bat/b1");
  });
});

describe("useLinkBat", () => {
  it("POSTs the link request to /bat/link", async () => {
    postMock.mockResolvedValueOnce({ data: { id: "b1" } });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useLinkBat(), { wrapper });

    await result.current.mutateAsync({
      source_bat_id: "src-bat",
      target_order_id: "o1",
      color_id: "noir",
      model_reference: "H-001",
    });
    expect(postMock).toHaveBeenCalledWith("/bat/link", {
      source_bat_id: "src-bat",
      target_order_id: "o1",
      color_id: "noir",
      model_reference: "H-001",
    });
  });
});
