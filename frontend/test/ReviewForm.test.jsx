import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import ReviewForm, { emptyReview } from "../src/components/ReviewForm.jsx";

/** Rendert das Formular mit einem steuerbaren Entwurf. */
function aufbauen(overrides = {}) {
  const onAdd = vi.fn();
  const onChange = vi.fn();
  const draft = { ...emptyReview(), ...overrides };
  render(<ReviewForm draft={draft} onChange={onChange} onAdd={onAdd} />);
  return { onAdd, onChange, draft };
}

describe("ReviewForm", () => {
  it("sperrt das Hinzufügen, solange kein Text eingegeben wurde", () => {
    aufbauen({ text: "" });
    expect(screen.getByRole("button", { name: /Zur Fallakte hinzufügen/i })).toBeDisabled();
  });

  it("gibt das Hinzufügen frei, sobald Text vorhanden ist", () => {
    aufbauen({ text: "Die Rechnung war zu hoch." });
    expect(screen.getByRole("button", { name: /Zur Fallakte hinzufügen/i })).toBeEnabled();
  });

  it("meldet die Bewertung mit eigener ID nach oben", async () => {
    const { onAdd, draft } = aufbauen({ text: "Termin nicht eingehalten.", rating: 1 });
    await userEvent.click(screen.getByRole("button", { name: /Zur Fallakte hinzufügen/i }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    const uebergeben = onAdd.mock.calls[0][0];
    expect(uebergeben.text).toBe("Termin nicht eingehalten.");
    // Frische ID, damit zwei gleiche Einträge nicht kollidieren.
    expect(uebergeben.id).not.toBe(draft.id);
  });

  it("reicht Tippen im Textfeld als Änderung nach oben", async () => {
    const { onChange } = aufbauen({ text: "" });
    await userEvent.type(screen.getByLabelText(/Bewertungstext/i), "x");
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)[0].text).toBe("x");
  });

  it("liefert die Sternebewertung als Zahl, nicht als Text", async () => {
    const { onChange } = aufbauen({ rating: 1 });
    await userEvent.selectOptions(screen.getByLabelText(/Sternebewertung/i), "5");
    expect(onChange.mock.calls.at(-1)[0].rating).toBe(5);
  });

  it("beschriftet jedes Feld für Screenreader", () => {
    aufbauen();
    for (const label of [
      /Name des Bewerters/i,
      /Sternebewertung/i,
      /Zeitpunkt der Bewertung/i,
      /Anzahl bisheriger Bewertungen/i,
      /Bewertungstext/i,
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });
});
