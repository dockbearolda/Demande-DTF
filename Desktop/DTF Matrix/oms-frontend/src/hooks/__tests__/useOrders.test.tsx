import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import { createWrapper } from "./test-utils";

const getMock = vi.fn();
const postMock = vi.fn();
const putMock = vi.fn();
const patchMock = vi.fn();
const deleteMock = vi.fn();

vi.mock("@/lib/api", () => ({
  api: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
    put: (...args: unknown[]) => putMock(...args),
    patch: (...args: unknown[]) => patchMock(...args),
    delete: (...args: unknown[]) => deleteMock(...args),
  },
}));

import {
  useCreateOrder,
  useDeleteOrder,
  useOrders,
  useUpdateOrder,
  useUpdateOrderStatus,
} from "../useOrders";

afterEach(() => {
  getMock.mockReset();
  postMock.mockReset();
  putMock.mockReset();
  patchMock.mockReset();
  deleteMock.mockReset();
});

describe("useOrders", () => {
  it("forwards filter values as request params", async () => {
    getMock.mockResolvedValueOnce({ data: [] });
    const { wrapper } = createWrapper();
    renderHook(
      () =>
        useOrders({
          statut: "CONFIRMED",
          client_id: "abc",
          skip: 20,
          limit: 50,
        }),
      { wrapper },
    );

    await waitFor(() => expect(getMock).toHaveBeenCalled());
    expect(getMock).toHaveBeenCalledWith("/orders", {
      params: { statut: "CONFIRMED", client_id: "abc", skip: 20, limit: 50 },
    });
  });

  it("returns server data on success", async () => {
    getMock.mockResolvedValueOnce({ data: [{ id: "o1" }] });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useOrders(), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual([{ id: "o1" }]);
  });
});

describe("useUpdateOrderStatus", () => {
  it("PATCHes /orders/{id}/status with the new statut", async () => {
    patchMock.mockResolvedValueOnce({ data: { id: "o1", statut: "SHIPPED" } });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateOrderStatus(), { wrapper });

    await result.current.mutateAsync({ id: "o1", statut: "SHIPPED" });
    expect(patchMock).toHaveBeenCalledWith("/orders/o1/status", {
      statut: "SHIPPED",
    });
  });
});

describe("useUpdateOrder", () => {
  it("PUTs /orders/{id} and primes the detail cache on success", async () => {
    const updated = { id: "o1", reference: "REF-1" };
    putMock.mockResolvedValueOnce({ data: updated });
    const { wrapper, qc } = createWrapper();
    const { result } = renderHook(() => useUpdateOrder(), { wrapper });

    await result.current.mutateAsync({
      id: "o1",
      data: { is_urgent: true },
    });

    expect(putMock).toHaveBeenCalledWith("/orders/o1", { is_urgent: true });
    // Detail cache primed so the drawer doesn't flicker after save.
    expect(qc.getQueryData(["orders", "detail", "o1"])).toEqual(updated);
  });
});

describe("useCreateOrder", () => {
  it("POSTs payload to /orders", async () => {
    postMock.mockResolvedValueOnce({ data: { id: "o-new" } });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateOrder(), { wrapper });

    await result.current.mutateAsync({
      client_id: "c1",
      reference: "ORD-1",
      lines: [],
    });
    expect(postMock).toHaveBeenCalledWith("/orders", expect.objectContaining({
      client_id: "c1",
      reference: "ORD-1",
    }));
  });
});

describe("useDeleteOrder", () => {
  it("DELETEs /orders/{id}", async () => {
    deleteMock.mockResolvedValueOnce({ data: undefined });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteOrder(), { wrapper });
    await result.current.mutateAsync("o1");
    expect(deleteMock).toHaveBeenCalledWith("/orders/o1");
  });
});
