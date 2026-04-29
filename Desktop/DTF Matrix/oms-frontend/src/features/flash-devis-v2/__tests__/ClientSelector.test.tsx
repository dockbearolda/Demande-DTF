import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Client } from "@/lib/types";
import { ClientSelector } from "../components/ClientSelector";

const FAKE_CLIENTS: Client[] = [
  {
    id: "client-1",
    nom: "Atelier Maroquin",
    nom_facture: null,
    contact: null,
    ville: null,
    email: "atelier@maroquin.fr",
    telephone: null,
    adresse: null,
    contacts: [],
    created_at: "",
    updated_at: "",
  } as Client,
  {
    id: "client-2",
    nom: "Boulangerie Dubois",
    nom_facture: null,
    contact: null,
    ville: null,
    email: "contact@dubois.fr",
    telephone: null,
    adresse: null,
    contacts: [],
    created_at: "",
    updated_at: "",
  } as Client,
  {
    id: "client-3",
    nom: "Café Central",
    nom_facture: null,
    contact: null,
    ville: null,
    email: null,
    telephone: null,
    adresse: null,
    contacts: [],
    created_at: "",
    updated_at: "",
  } as Client,
];

vi.mock("@/hooks/useClients", () => ({
  useClients: () => ({ data: FAKE_CLIENTS, isLoading: false }),
}));

afterEach(() => {
  cleanup();
});

describe("ClientSelector", () => {
  it("affiche un input de recherche quand aucun client sélectionné", () => {
    render(<ClientSelector value={null} onChange={() => {}} />);
    expect(
      screen.getByLabelText(/rechercher un client/i),
    ).toBeInTheDocument();
  });

  it("filtre la liste sur la saisie utilisateur", () => {
    render(<ClientSelector value={null} onChange={() => {}} />);
    const input = screen.getByLabelText(/rechercher un client/i);
    fireEvent.focus(input);
    // Sans saisie, on a les 3 clients dans le dropdown
    expect(screen.getByText("Atelier Maroquin")).toBeInTheDocument();
    expect(screen.getByText("Boulangerie Dubois")).toBeInTheDocument();
    expect(screen.getByText("Café Central")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "boulang" } });
    expect(screen.queryByText("Atelier Maroquin")).not.toBeInTheDocument();
    expect(screen.getByText("Boulangerie Dubois")).toBeInTheDocument();
    expect(screen.queryByText("Café Central")).not.toBeInTheDocument();
  });

  it("appelle onChange avec l'id quand on clique sur un résultat", () => {
    const onChange = vi.fn();
    render(<ClientSelector value={null} onChange={onChange} />);
    fireEvent.focus(screen.getByLabelText(/rechercher un client/i));
    fireEvent.click(screen.getByText("Boulangerie Dubois"));
    expect(onChange).toHaveBeenCalledWith("client-2");
  });

  it("affiche le client sélectionné avec un bouton « Changer »", () => {
    render(<ClientSelector value="client-1" onChange={() => {}} />);
    expect(screen.getByText("Atelier Maroquin")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /changer de client/i }),
    ).toBeInTheDocument();
  });

  it("le bouton « Changer » remet en mode recherche", () => {
    const onChange = vi.fn();
    render(<ClientSelector value="client-1" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /changer de client/i }));
    expect(onChange).toHaveBeenCalledWith(null);
    expect(screen.getByLabelText(/rechercher un client/i)).toBeInTheDocument();
  });

  it("affiche un message si aucun résultat", () => {
    render(<ClientSelector value={null} onChange={() => {}} />);
    fireEvent.focus(screen.getByLabelText(/rechercher un client/i));
    fireEvent.change(screen.getByLabelText(/rechercher un client/i), {
      target: { value: "zzzzzzzz" },
    });
    expect(screen.getByText(/aucun client trouvé/i)).toBeInTheDocument();
  });
});
