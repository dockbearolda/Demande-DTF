import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ShortcutsCheatSheet } from "../components/ShortcutsCheatSheet";

afterEach(() => {
  cleanup();
});

describe("ShortcutsCheatSheet", () => {
  it("ne rend rien quand open=false", () => {
    const { container } = render(
      <ShortcutsCheatSheet open={false} onClose={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("a un role=dialog quand open", () => {
    render(<ShortcutsCheatSheet open onClose={() => {}} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("liste au moins 8 raccourcis", () => {
    render(<ShortcutsCheatSheet open onClose={() => {}} />);
    // Chaque raccourci est un <li> dans une <ul>
    const items = document.querySelectorAll("li");
    expect(items.length).toBeGreaterThanOrEqual(8);
  });

  it("affiche les sections principales (en-têtes)", () => {
    render(<ShortcutsCheatSheet open onClose={() => {}} />);
    const headings = Array.from(document.querySelectorAll("h3")).map(
      (h) => h.textContent ?? "",
    );
    expect(headings).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Recherche & navigation/i),
        expect.stringMatching(/Quantité/),
        expect.stringMatching(/Emplacements logos/i),
        expect.stringMatching(/Options/i),
      ]),
    );
  });

  it("appelle onClose au clic sur le bouton Esc", () => {
    const onClose = vi.fn();
    render(<ShortcutsCheatSheet open onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /fermer/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("appelle onClose au clic sur le backdrop", () => {
    const onClose = vi.fn();
    render(<ShortcutsCheatSheet open onClose={onClose} />);
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ne ferme pas au clic à l'intérieur de la card", () => {
    const onClose = vi.fn();
    render(<ShortcutsCheatSheet open onClose={onClose} />);
    fireEvent.click(screen.getByRole("heading", { name: /raccourcis clavier/i }));
    expect(onClose).not.toHaveBeenCalled();
  });
});
