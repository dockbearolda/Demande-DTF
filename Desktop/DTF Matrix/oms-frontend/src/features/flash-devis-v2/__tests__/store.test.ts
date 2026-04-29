import { afterEach, describe, expect, it } from "vitest";
import { useFlashDevisV2Store } from "../store";

afterEach(() => {
  useFlashDevisV2Store.getState().reset();
});

describe("useFlashDevisV2Store", () => {
  it("part de l'état initial attendu", () => {
    const s = useFlashDevisV2Store.getState();
    expect(s.selectedModelRef).toBeNull();
    expect(s.selectedClientId).toBeNull();
    expect(s.quantity).toBe(1);
    expect(s.placements.size).toBe(0);
    expect(s.transportActive).toBe(true);
    expect(s.tgcaActive).toBe(false);
    expect(s.discount).toBe(0);
    expect(s.notes).toBe("");
    expect(s.sleeveFilter.size).toBe(0);
    expect(s.neckFilter.size).toBe(0);
    expect(s.search).toBe("");
  });

  it("selectClient met à jour l'id client", () => {
    useFlashDevisV2Store.getState().selectClient("client-uuid-1");
    expect(useFlashDevisV2Store.getState().selectedClientId).toBe("client-uuid-1");
    useFlashDevisV2Store.getState().selectClient(null);
    expect(useFlashDevisV2Store.getState().selectedClientId).toBeNull();
  });

  it("selectModel met à jour la référence", () => {
    useFlashDevisV2Store.getState().selectModel("NS300");
    expect(useFlashDevisV2Store.getState().selectedModelRef).toBe("NS300");
    useFlashDevisV2Store.getState().selectModel(null);
    expect(useFlashDevisV2Store.getState().selectedModelRef).toBeNull();
  });

  it("setQuantity force >= 1 et entier", () => {
    const { setQuantity } = useFlashDevisV2Store.getState();
    setQuantity(30);
    expect(useFlashDevisV2Store.getState().quantity).toBe(30);
    setQuantity(0);
    expect(useFlashDevisV2Store.getState().quantity).toBe(1);
    setQuantity(-5);
    expect(useFlashDevisV2Store.getState().quantity).toBe(1);
    setQuantity(12.7);
    expect(useFlashDevisV2Store.getState().quantity).toBe(12);
    setQuantity(Number.NaN);
    expect(useFlashDevisV2Store.getState().quantity).toBe(1);
  });

  it("togglePlacement ajoute puis retire", () => {
    const { togglePlacement } = useFlashDevisV2Store.getState();
    togglePlacement("Coeur");
    expect(useFlashDevisV2Store.getState().placements.has("Coeur")).toBe(true);
    togglePlacement("MancheG");
    expect(useFlashDevisV2Store.getState().placements.size).toBe(2);
    togglePlacement("Coeur");
    expect(useFlashDevisV2Store.getState().placements.has("Coeur")).toBe(false);
    expect(useFlashDevisV2Store.getState().placements.has("MancheG")).toBe(true);
  });

  it("togglePlacement préserve l'immutabilité du Set précédent", () => {
    const { togglePlacement } = useFlashDevisV2Store.getState();
    const before = useFlashDevisV2Store.getState().placements;
    togglePlacement("Coeur");
    const after = useFlashDevisV2Store.getState().placements;
    expect(after).not.toBe(before);
    expect(before.size).toBe(0); // l'ancien Set ne doit pas avoir muté
  });

  it("toggleSleeveFilter et toggleNeckFilter sont indépendants", () => {
    const { toggleSleeveFilter, toggleNeckFilter } = useFlashDevisV2Store.getState();
    toggleSleeveFilter("courte");
    toggleNeckFilter("rond");
    const s = useFlashDevisV2Store.getState();
    expect(s.sleeveFilter.has("courte")).toBe(true);
    expect(s.neckFilter.has("rond")).toBe(true);
    expect(s.sleeveFilter.size).toBe(1);
    expect(s.neckFilter.size).toBe(1);
  });

  it("setTransportActive et setTgcaActive togglent les flags", () => {
    const { setTransportActive, setTgcaActive } = useFlashDevisV2Store.getState();
    setTransportActive(false);
    expect(useFlashDevisV2Store.getState().transportActive).toBe(false);
    setTgcaActive(true);
    expect(useFlashDevisV2Store.getState().tgcaActive).toBe(true);
  });

  it("setDiscount accepte un montant >= 0, force 0 sinon", () => {
    const { setDiscount } = useFlashDevisV2Store.getState();
    setDiscount(50);
    expect(useFlashDevisV2Store.getState().discount).toBe(50);
    setDiscount(0);
    expect(useFlashDevisV2Store.getState().discount).toBe(0);
    setDiscount(-30);
    expect(useFlashDevisV2Store.getState().discount).toBe(0);
    setDiscount(Number.NaN);
    expect(useFlashDevisV2Store.getState().discount).toBe(0);
  });

  it("reset remet tout à zéro", () => {
    const s = useFlashDevisV2Store.getState();
    s.selectModel("NS300");
    s.selectClient("client-uuid-1");
    s.setQuantity(50);
    s.togglePlacement("Coeur");
    s.togglePlacement("MancheG");
    s.setTgcaActive(true);
    s.setTransportActive(false);
    s.setDiscount(75);
    s.setNotes("test");
    s.toggleSleeveFilter("courte");
    s.toggleNeckFilter("v");
    s.setSearch("ns");
    s.reset();
    const after = useFlashDevisV2Store.getState();
    expect(after.selectedModelRef).toBeNull();
    expect(after.selectedClientId).toBeNull();
    expect(after.quantity).toBe(1);
    expect(after.placements.size).toBe(0);
    expect(after.transportActive).toBe(true);
    expect(after.tgcaActive).toBe(false);
    expect(after.discount).toBe(0);
    expect(after.notes).toBe("");
    expect(after.sleeveFilter.size).toBe(0);
    expect(after.neckFilter.size).toBe(0);
    expect(after.search).toBe("");
  });
});
