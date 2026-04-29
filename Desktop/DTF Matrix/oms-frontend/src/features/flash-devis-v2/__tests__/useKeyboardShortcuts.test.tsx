import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { useEffect, useRef, useState } from "react";
import { useFlashDevisV2Store } from "../store";
import { useKeyboardShortcuts } from "../useKeyboardShortcuts";

/** Harness React qui monte le hook avec un input "search" et un input
 *  "notes" pour tester le guard inEditable. */
function Harness({ initialOpen = false }: { initialOpen?: boolean }) {
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(initialOpen);

  useKeyboardShortcuts({
    searchInputRef,
    cheatSheetOpen: open,
    onToggleCheatSheet: () => setOpen((v) => !v),
    onCloseCheatSheet: () => setOpen(false),
  });

  // Expose `open` via data-attr pour les assertions
  useEffect(() => {
    document.body.dataset.cheatOpen = String(open);
  }, [open]);

  return (
    <div>
      <input
        ref={searchInputRef}
        data-testid="search"
        type="search"
        aria-label="Rechercher"
      />
      <textarea data-testid="notes" aria-label="Notes" />
    </div>
  );
}

beforeEach(() => {
  useFlashDevisV2Store.getState().reset();
  delete document.body.dataset.cheatOpen;
});

afterEach(() => {
  cleanup();
  useFlashDevisV2Store.getState().reset();
  delete document.body.dataset.cheatOpen;
});

describe("useKeyboardShortcuts — emplacements 1..6", () => {
  it("sans modèle sélectionné, 1..6 ne fait rien", () => {
    render(<Harness />);
    fireEvent.keyDown(window, { key: "1" });
    fireEvent.keyDown(window, { key: "3" });
    expect(useFlashDevisV2Store.getState().placements.size).toBe(0);
  });

  it("avec modèle, 1..6 toggle les bons placements dans l'ordre canonique", () => {
    useFlashDevisV2Store.getState().selectModel("H-001");
    render(<Harness />);

    fireEvent.keyDown(window, { key: "1" });
    expect(useFlashDevisV2Store.getState().placements.has("Coeur")).toBe(true);

    fireEvent.keyDown(window, { key: "2" });
    expect(useFlashDevisV2Store.getState().placements.has("Poitrine")).toBe(true);

    fireEvent.keyDown(window, { key: "3" });
    expect(useFlashDevisV2Store.getState().placements.has("AvantPlein")).toBe(true);

    fireEvent.keyDown(window, { key: "4" });
    expect(useFlashDevisV2Store.getState().placements.has("ArrierePlein")).toBe(true);

    fireEvent.keyDown(window, { key: "5" });
    expect(useFlashDevisV2Store.getState().placements.has("MancheG")).toBe(true);

    fireEvent.keyDown(window, { key: "6" });
    expect(useFlashDevisV2Store.getState().placements.has("MancheD")).toBe(true);

    // Re-frappe sur 1 → retire Cœur
    fireEvent.keyDown(window, { key: "1" });
    expect(useFlashDevisV2Store.getState().placements.has("Coeur")).toBe(false);
  });
});

describe("useKeyboardShortcuts — quantité", () => {
  it("avec modèle, + et - font ±1, borné à 1", () => {
    useFlashDevisV2Store.getState().selectModel("H-001");
    render(<Harness />);

    fireEvent.keyDown(window, { key: "+" });
    expect(useFlashDevisV2Store.getState().quantity).toBe(2);
    fireEvent.keyDown(window, { key: "=" });
    expect(useFlashDevisV2Store.getState().quantity).toBe(3);
    fireEvent.keyDown(window, { key: "-" });
    expect(useFlashDevisV2Store.getState().quantity).toBe(2);
    fireEvent.keyDown(window, { key: "-" });
    fireEvent.keyDown(window, { key: "-" });
    fireEvent.keyDown(window, { key: "-" });
    // bornée à 1
    expect(useFlashDevisV2Store.getState().quantity).toBe(1);
  });

  it("Shift+ArrowUp/Down font ±10, borne basse 1", () => {
    useFlashDevisV2Store.getState().selectModel("H-001");
    render(<Harness />);

    fireEvent.keyDown(window, { key: "ArrowUp", shiftKey: true });
    expect(useFlashDevisV2Store.getState().quantity).toBe(11);
    fireEvent.keyDown(window, { key: "ArrowUp", shiftKey: true });
    expect(useFlashDevisV2Store.getState().quantity).toBe(21);
    fireEvent.keyDown(window, { key: "ArrowDown", shiftKey: true });
    expect(useFlashDevisV2Store.getState().quantity).toBe(11);
    // 11 - 10 - 10 - 10 → bornée à 1
    fireEvent.keyDown(window, { key: "ArrowDown", shiftKey: true });
    fireEvent.keyDown(window, { key: "ArrowDown", shiftKey: true });
    fireEvent.keyDown(window, { key: "ArrowDown", shiftKey: true });
    expect(useFlashDevisV2Store.getState().quantity).toBe(1);
  });

  it("sans modèle, + ne change pas la quantité", () => {
    render(<Harness />);
    fireEvent.keyDown(window, { key: "+" });
    expect(useFlashDevisV2Store.getState().quantity).toBe(1);
  });
});

describe("useKeyboardShortcuts — toggles t / g", () => {
  it("avec modèle, t toggle transportActive et g toggle tgcaActive", () => {
    useFlashDevisV2Store.getState().selectModel("H-001");
    render(<Harness />);

    expect(useFlashDevisV2Store.getState().transportActive).toBe(true);
    fireEvent.keyDown(window, { key: "t" });
    expect(useFlashDevisV2Store.getState().transportActive).toBe(false);
    fireEvent.keyDown(window, { key: "t" });
    expect(useFlashDevisV2Store.getState().transportActive).toBe(true);

    expect(useFlashDevisV2Store.getState().tgcaActive).toBe(false);
    fireEvent.keyDown(window, { key: "g" });
    expect(useFlashDevisV2Store.getState().tgcaActive).toBe(true);
    fireEvent.keyDown(window, { key: "g" });
    expect(useFlashDevisV2Store.getState().tgcaActive).toBe(false);
  });

  it("sans modèle, t et g sont ignorés", () => {
    render(<Harness />);
    fireEvent.keyDown(window, { key: "t" });
    fireEvent.keyDown(window, { key: "g" });
    expect(useFlashDevisV2Store.getState().transportActive).toBe(true);
    expect(useFlashDevisV2Store.getState().tgcaActive).toBe(false);
  });
});

describe("useKeyboardShortcuts — guard input", () => {
  it("quand un input est focus, t ne toggle PAS le transport", () => {
    useFlashDevisV2Store.getState().selectModel("H-001");
    const { getByTestId } = render(<Harness />);
    const notes = getByTestId("notes") as HTMLTextAreaElement;
    notes.focus();
    fireEvent.keyDown(notes, { key: "t" });
    expect(useFlashDevisV2Store.getState().transportActive).toBe(true);
  });

  it("quand l'input search est focus, 1..6 ne toggle PAS de placement", () => {
    useFlashDevisV2Store.getState().selectModel("H-001");
    const { getByTestId } = render(<Harness />);
    const search = getByTestId("search") as HTMLInputElement;
    search.focus();
    fireEvent.keyDown(search, { key: "1" });
    expect(useFlashDevisV2Store.getState().placements.size).toBe(0);
  });
});

describe("useKeyboardShortcuts — focus search", () => {
  it("Ctrl+K focus l'input search même si un autre input est focus", () => {
    const { getByTestId } = render(<Harness />);
    const notes = getByTestId("notes") as HTMLTextAreaElement;
    const search = getByTestId("search") as HTMLInputElement;
    notes.focus();
    expect(document.activeElement).toBe(notes);
    fireEvent.keyDown(notes, { key: "k", ctrlKey: true });
    expect(document.activeElement).toBe(search);
  });

  it("Cmd+K (metaKey) focus l'input search", () => {
    const { getByTestId } = render(<Harness />);
    const search = getByTestId("search") as HTMLInputElement;
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(document.activeElement).toBe(search);
  });

  it("/ focus l'input search quand on n'est pas dans un champ", () => {
    const { getByTestId } = render(<Harness />);
    const search = getByTestId("search") as HTMLInputElement;
    fireEvent.keyDown(window, { key: "/" });
    expect(document.activeElement).toBe(search);
  });

  it("/ ne se déclenche pas quand un input est focus (laisse taper le slash)", () => {
    const { getByTestId } = render(<Harness />);
    const notes = getByTestId("notes") as HTMLTextAreaElement;
    notes.focus();
    fireEvent.keyDown(notes, { key: "/" });
    expect(document.activeElement).toBe(notes);
  });
});

describe("useKeyboardShortcuts — Esc dans search", () => {
  it("Esc quand search a le focus vide la recherche et blur", () => {
    useFlashDevisV2Store.getState().setSearch("hoodie");
    const { getByTestId } = render(<Harness />);
    const search = getByTestId("search") as HTMLInputElement;
    search.value = "hoodie";
    search.focus();
    fireEvent.keyDown(search, { key: "Escape" });
    expect(useFlashDevisV2Store.getState().search).toBe("");
    expect(document.activeElement).not.toBe(search);
  });

  it("Esc sans focus search et sans cheat sheet ouvert ne touche pas au store", () => {
    useFlashDevisV2Store.getState().selectModel("H-001");
    render(<Harness />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(useFlashDevisV2Store.getState().selectedModelRef).toBe("H-001");
  });
});

describe("useKeyboardShortcuts — cheat sheet ?", () => {
  it("? ouvre le cheat sheet, Esc le ferme", () => {
    render(<Harness />);
    expect(document.body.dataset.cheatOpen).toBe("false");
    act(() => {
      fireEvent.keyDown(window, { key: "?" });
    });
    expect(document.body.dataset.cheatOpen).toBe("true");
    act(() => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    expect(document.body.dataset.cheatOpen).toBe("false");
  });

  it("? est ignoré quand un input est focus", () => {
    const { getByTestId } = render(<Harness />);
    const notes = getByTestId("notes") as HTMLTextAreaElement;
    notes.focus();
    fireEvent.keyDown(notes, { key: "?" });
    expect(document.body.dataset.cheatOpen).toBe("false");
  });
});
