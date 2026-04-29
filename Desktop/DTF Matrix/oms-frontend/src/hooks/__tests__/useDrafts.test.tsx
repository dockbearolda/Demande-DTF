import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import { createWrapper } from "./test-utils";

const getMock = vi.fn();
const putMock = vi.fn();
const deleteMock = vi.fn();

vi.mock("@/lib/api", () => ({
  api: {
    get: (...args: unknown[]) => getMock(...args),
    put: (...args: unknown[]) => putMock(...args),
    delete: (...args: unknown[]) => deleteMock(...args),
  },
}));

import {
  useDeleteDraft,
  useDraft,
  useDrafts,
  useUpsertDraft,
} from "../useDrafts";

afterEach(() => {
  getMock.mockReset();
  putMock.mockReset();
  deleteMock.mockReset();
});

describe("useDrafts", () => {
  it("fetches /drafts and exposes the summary list", async () => {
    getMock.mockResolvedValueOnce({
      data: [{ id: "d1", client_name: "ACME" }],
    });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDrafts(), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(getMock).toHaveBeenCalledWith("/drafts");
    expect(result.current.data?.[0].id).toBe("d1");
  });
});

describe("useDraft", () => {
  it("does not fire when id is undefined", async () => {
    const { wrapper } = createWrapper();
    renderHook(() => useDraft(undefined), { wrapper });
    await new Promise((r) => setTimeout(r, 20));
    expect(getMock).not.toHaveBeenCalled();
  });

  it("fetches /drafts/{id} when an id is provided", async () => {
    getMock.mockResolvedValueOnce({ data: { id: "d1", payload: {} } });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDraft("d1"), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(getMock).toHaveBeenCalledWith("/drafts/d1");
  });
});

describe("useUpsertDraft", () => {
  it("PUTs payload to /drafts/{id}", async () => {
    putMock.mockResolvedValueOnce({ data: { id: "d1" } });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpsertDraft(), { wrapper });
    const body = {
      payload: { x: 1 },
      client_name: "ACME",
      item_count: 2,
      reference_count: 1,
      last_step: 3,
      quote_id: null,
    };
    await result.current.mutateAsync({ id: "d1", body });
    expect(putMock).toHaveBeenCalledWith("/drafts/d1", body);
  });

  it("invalidates the drafts list cache on success", async () => {
    putMock.mockResolvedValueOnce({ data: { id: "d1" } });
    const { wrapper, qc } = createWrapper();
    const spy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useUpsertDraft(), { wrapper });

    await result.current.mutateAsync({
      id: "d1",
      body: {
        payload: {},
        client_name: null,
        item_count: 0,
        reference_count: 0,
        last_step: 1,
        quote_id: null,
      },
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["drafts"] });
  });
});

describe("useDeleteDraft", () => {
  it("DELETEs /drafts/{id} and invalidates the list", async () => {
    deleteMock.mockResolvedValueOnce({});
    const { wrapper, qc } = createWrapper();
    const spy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useDeleteDraft(), { wrapper });
    await result.current.mutateAsync("d1");
    expect(deleteMock).toHaveBeenCalledWith("/drafts/d1");
    expect(spy).toHaveBeenCalledWith({ queryKey: ["drafts"] });
  });
});
