import { beforeEach, describe, expect, it } from "vitest";
import { useNewOrderStore, selectLines, selectLine } from "../store";
import { isClassicLine, isTextileLine } from "../types";

/**
 * Tests for the multi-reference store.
 *
 * Each test resets the store to its initial state. We exercise:
 *  - line lifecycle (add, remove, duplicate, expand, reorder)
 *  - per-secteur scaffolding (textile vs classic)
 *  - duplicate detection
 *  - artwork copy across textile lines
 *  - global validation
 */
describe("new-order store — multi-reference", () => {
  beforeEach(() => {
    // Wipe persisted state and the store. `reset` clears localStorage too.
    useNewOrderStore.getState().reset();
  });

  it("starts empty", () => {
    const state = useNewOrderStore.getState();
    expect(state.draft.lines).toHaveLength(0);
    expect(state.draft.expandedLineId).toBeNull();
    expect(selectLine(state)).toBeNull();
  });

  it("addLine appends a new record and expands it", () => {
    const id = useNewOrderStore.getState().addLine("DTF");
    const state = useNewOrderStore.getState();
    expect(state.draft.lines).toHaveLength(1);
    expect(state.draft.expandedLineId).toBe(id);
    const line = selectLine(state)!;
    expect(isClassicLine(line)).toBe(true);
  });

  it("addLine for Textiles produces a textile line", () => {
    useNewOrderStore.getState().addLine("Textiles");
    const line = selectLine(useNewOrderStore.getState())!;
    expect(isTextileLine(line)).toBe(true);
  });

  it("removeLine drops the record and re-expands a sibling", () => {
    const a = useNewOrderStore.getState().addLine("DTF");
    const b = useNewOrderStore.getState().addLine("UV");
    const c = useNewOrderStore.getState().addLine("Trotec");
    expect(useNewOrderStore.getState().draft.expandedLineId).toBe(c);

    useNewOrderStore.getState().removeLine(c);
    let state = useNewOrderStore.getState();
    expect(state.draft.lines).toHaveLength(2);
    // After removing the expanded last line, the previous one becomes expanded.
    expect(state.draft.expandedLineId).toBe(b);

    useNewOrderStore.getState().removeLine(a);
    state = useNewOrderStore.getState();
    expect(state.draft.lines).toHaveLength(1);
  });

  it("duplicateLine clones a line under a fresh id", () => {
    const a = useNewOrderStore.getState().addLine("DTF");
    useNewOrderStore.getState().setClassicProduit("Sticker bleu");
    useNewOrderStore.getState().setClassicQty(5);

    const b = useNewOrderStore.getState().duplicateLine(a)!;
    expect(b).not.toBe(a);
    const lines = selectLines(useNewOrderStore.getState());
    expect(lines).toHaveLength(2);
    expect(useNewOrderStore.getState().draft.expandedLineId).toBe(b);

    const original = lines.find((r) => r.id === a)!;
    const dup = lines.find((r) => r.id === b)!;
    expect(isClassicLine(dup.line) && dup.line.produit).toBe("Sticker bleu");
    // Mutating the duplicate must not affect the original.
    useNewOrderStore.getState().setClassicQty(99);
    const refreshed = useNewOrderStore.getState().draft.lines;
    expect(
      isClassicLine(refreshed.find((r) => r.id === a)!.line) &&
        (refreshed.find((r) => r.id === a)!.line as { quantity: number }).quantity,
    ).toBe(5);
    expect(
      isClassicLine(refreshed.find((r) => r.id === b)!.line) &&
        (refreshed.find((r) => r.id === b)!.line as { quantity: number }).quantity,
    ).toBe(99);
    // Reference original to avoid unused warning.
    expect(original.id).toBe(a);
  });

  it("expandLine + collapseAll switch the expanded record", () => {
    const a = useNewOrderStore.getState().addLine("DTF");
    const b = useNewOrderStore.getState().addLine("UV");
    expect(useNewOrderStore.getState().draft.expandedLineId).toBe(b);
    useNewOrderStore.getState().expandLine(a);
    expect(useNewOrderStore.getState().draft.expandedLineId).toBe(a);
    useNewOrderStore.getState().collapseAll();
    expect(useNewOrderStore.getState().draft.expandedLineId).toBeNull();
  });

  it("reorderLines moves a record to a new position", () => {
    const a = useNewOrderStore.getState().addLine("DTF");
    const b = useNewOrderStore.getState().addLine("UV");
    const c = useNewOrderStore.getState().addLine("Trotec");
    useNewOrderStore.getState().reorderLines(0, 2);
    const order = selectLines(useNewOrderStore.getState()).map((r) => r.id);
    expect(order).toEqual([b, c, a]);
  });

  it("findDuplicates returns siblings sharing the same signature", () => {
    const a = useNewOrderStore.getState().addLine("DTF");
    useNewOrderStore.getState().setClassicProduit("Visuel test");
    useNewOrderStore.getState().setClassicQty(5);

    const b = useNewOrderStore.getState().duplicateLine(a)!;
    expect(useNewOrderStore.getState().findDuplicates(b)).toEqual([a]);

    // Edit the dup so the signature changes — duplicates disappear.
    useNewOrderStore.getState().setClassicProduit("Autre visuel");
    expect(useNewOrderStore.getState().findDuplicates(b)).toHaveLength(0);
  });

  it("copyArtworkToLines clones design + placement to other textile lines", () => {
    const src = useNewOrderStore.getState().addLine("Textiles");
    useNewOrderStore.getState().setBodyPlacements(["front"]);

    const tgt1 = useNewOrderStore.getState().addLine("Textiles");
    const tgt2 = useNewOrderStore.getState().addLine("Textiles");

    useNewOrderStore.getState().copyArtworkToLines(src, [tgt1, tgt2]);

    const lines = useNewOrderStore.getState().draft.lines;
    for (const id of [tgt1, tgt2]) {
      const line = lines.find((r) => r.id === id)!.line;
      expect(isTextileLine(line)).toBe(true);
      if (isTextileLine(line)) {
        expect(line.bodyPlacements).toEqual(["front"]);
      }
    }
  });

  it("validate fails when no lines are present", () => {
    useNewOrderStore.getState().setHeader({
      clientNom: "ACME",
      assignedTo: "L",
    });
    const result = useNewOrderStore.getState().validate();
    expect(result.ok).toBe(false);
    expect(result.fieldErrors.secteur).toBeTruthy();
  });

  it("validate passes when header + at least one valid classic line are set", () => {
    // setClient binds both clientId + clientNom — required since orphan
    // names (no id) now fail validation.
    useNewOrderStore
      .getState()
      .setClient("00000000-0000-0000-0000-000000000001", "ACME");
    useNewOrderStore.getState().setHeader({ assignedTo: "L" });
    useNewOrderStore.getState().addLine("DTF");
    useNewOrderStore.getState().setClassicProduit("Sticker");
    useNewOrderStore.getState().setClassicQty(3);

    const result = useNewOrderStore.getState().validate();
    expect(result.ok).toBe(true);
  });

  it("validate fails when an in-progress line is incomplete", () => {
    useNewOrderStore.getState().setHeader({
      clientNom: "ACME",
      assignedTo: "L",
    });
    useNewOrderStore.getState().addLine("DTF");
    // Leave produit empty.
    const result = useNewOrderStore.getState().validate();
    expect(result.ok).toBe(false);
    expect(result.fieldErrors.line).toBeTruthy();
  });
});
