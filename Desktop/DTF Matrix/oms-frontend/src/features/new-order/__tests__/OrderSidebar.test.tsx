import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { OrderSidebar } from "../components/OrderSidebar";
import { useNewOrderStore } from "../store";

beforeEach(() => {
  const style = document.createElement("style");
  style.id = "test-sidebar-css";
  style.textContent = `aside { display: block !important; }`;
  document.head.appendChild(style);
  useNewOrderStore.getState().reset();
});

afterEach(() => {
  document.getElementById("test-sidebar-css")?.remove();
  cleanup();
});

function setStep(step: 1 | 2 | 3 | 4) {
  useNewOrderStore.getState().setStep(step);
}

describe("OrderSidebar — quote summary card", () => {
  it("renders the quote summary card at step 1", () => {
    setStep(1);
    render(<OrderSidebar />);

    const cards = screen.getAllByRole("complementary");
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveAccessibleName("Récapitulatif du devis");
  });

  it("renders at step 2", () => {
    setStep(2);
    render(<OrderSidebar />);
    expect(screen.getAllByRole("complementary")).toHaveLength(1);
  });

  it("shows '—' placeholders when no qty is entered", () => {
    setStep(3);
    render(<OrderSidebar />);

    const card = screen.getByLabelText("Récapitulatif du devis");
    expect(within(card).queryByText(/dès qu'une quantité/i)).not.toBeInTheDocument();
  });
});
