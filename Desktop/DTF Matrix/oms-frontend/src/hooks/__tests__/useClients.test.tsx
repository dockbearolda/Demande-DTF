import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import { createWrapper } from "./test-utils";

const getMock = vi.fn();
const postMock = vi.fn();
const putMock = vi.fn();
const deleteMock = vi.fn();

vi.mock("@/lib/api", () => ({
  api: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
    put: (...args: unknown[]) => putMock(...args),
    delete: (...args: unknown[]) => deleteMock(...args),
  },
}));

const loggerWarnMock = vi.fn();
vi.mock("@/lib/logger", () => ({
  logger: {
    warn: (...args: unknown[]) => loggerWarnMock(...args),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  useClients,
  useCreateClient,
  useDeleteClient,
  useImportClients,
  useUpdateClient,
} from "../useClients";

afterEach(() => {
  getMock.mockReset();
  postMock.mockReset();
  putMock.mockReset();
  deleteMock.mockReset();
  loggerWarnMock.mockReset();
});

describe("useClients", () => {
  it("fetches with the maximum window (limit=500) and no search by default", async () => {
    getMock.mockResolvedValueOnce({ data: [] });
    const { wrapper } = createWrapper();
    renderHook(() => useClients(), { wrapper });

    await waitFor(() => expect(getMock).toHaveBeenCalled());
    expect(getMock).toHaveBeenCalledWith("/clients", {
      params: { limit: 500 },
    });
  });

  it("forwards the search term as a request param", async () => {
    getMock.mockResolvedValueOnce({ data: [] });
    const { wrapper } = createWrapper();
    renderHook(() => useClients("acme"), { wrapper });

    await waitFor(() => expect(getMock).toHaveBeenCalled());
    expect(getMock).toHaveBeenCalledWith("/clients", {
      params: { limit: 500, search: "acme" },
    });
  });

  it("logs a dev warning when the 500-row window is saturated", async () => {
    const big = Array.from({ length: 500 }, (_, i) => ({ id: `c${i}` }));
    getMock.mockResolvedValueOnce({ data: big });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useClients(), { wrapper });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(loggerWarnMock).toHaveBeenCalled();
  });
});

describe("useCreateClient", () => {
  it("POSTs the payload as-is", async () => {
    postMock.mockResolvedValueOnce({ data: { id: "c1" } });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateClient(), { wrapper });

    await result.current.mutateAsync({ nom: "ACME" });
    expect(postMock).toHaveBeenCalledWith("/clients", { nom: "ACME" });
  });
});

describe("useUpdateClient", () => {
  it("PUTs to /clients/{id} with the partial payload", async () => {
    putMock.mockResolvedValueOnce({ data: { id: "c1", nom: "Old", ville: "Paris" } });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateClient(), { wrapper });

    await result.current.mutateAsync({
      id: "c1",
      payload: { nom: "Old", ville: "Paris" },
    });
    expect(putMock).toHaveBeenCalledWith("/clients/c1", {
      nom: "Old",
      ville: "Paris",
    });
  });
});

describe("useDeleteClient", () => {
  it("DELETEs /clients/{id}", async () => {
    deleteMock.mockResolvedValueOnce({});
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteClient(), { wrapper });

    await result.current.mutateAsync("c1");
    expect(deleteMock).toHaveBeenCalledWith("/clients/c1");
  });
});

describe("useImportClients", () => {
  it("POSTs an array to /clients/bulk-import", async () => {
    postMock.mockResolvedValueOnce({
      data: { clients_created: 2, clients_skipped: 0, contacts_created: 3 },
    });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useImportClients(), { wrapper });

    const rows = [
      { nom: "ACME", contact: "Alice" },
      { nom: "BCorp", contact: "Bob" },
    ];
    await result.current.mutateAsync(rows);
    expect(postMock).toHaveBeenCalledWith("/clients/bulk-import", rows);
  });
});
