import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import CsvImport from "../src/components/CsvImport.jsx";

async function oeffnen() {
  const onImport = vi.fn();
  render(<CsvImport onImport={onImport} />);
  await userEvent.click(screen.getByRole("button", { name: /Öffnen/i }));
  return { onImport };
}

describe("CsvImport", () => {
  it("zeigt die Felder erst nach dem Aufklappen", async () => {
    render(<CsvImport onImport={vi.fn()} />);
    expect(screen.queryByLabelText(/CSV-Inhalt/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Öffnen/i }));
    expect(screen.getByLabelText(/CSV-Inhalt/i)).toBeInTheDocument();
  });

  it("übernimmt eingefügte Zeilen und meldet die Anzahl", async () => {
    const { onImport } = await oeffnen();

    await userEvent.type(
      screen.getByLabelText(/CSV-Inhalt/i),
      "A,1,2026-08-10,Erste Bewertung,3"
    );
    await userEvent.click(screen.getByRole("button", { name: /^Importieren$/ }));

    expect(onImport).toHaveBeenCalledTimes(1);
    expect(onImport.mock.calls[0][0]).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent(/1 Bewertungen/);
  });

  it("hält Kommas im Bewertungstext zusammen", async () => {
    const { onImport } = await oeffnen();

    // Genau der Fall, an dem der frühere Parser die Spalten verschoben hat.
    await userEvent.type(
      screen.getByLabelText(/CSV-Inhalt/i),
      'M. K.,1,2026-08-10,"Absolute Katastrophe, nie wieder!",1'
    );
    await userEvent.click(screen.getByRole("button", { name: /^Importieren$/ }));

    expect(onImport.mock.calls[0][0][0].text).toBe("Absolute Katastrophe, nie wieder!");
  });

  it("meldet unbrauchbare Eingaben, statt still nichts zu tun", async () => {
    const { onImport } = await oeffnen();

    await userEvent.type(screen.getByLabelText(/CSV-Inhalt/i), ",,,,");
    await userEvent.click(screen.getByRole("button", { name: /^Importieren$/ }));

    expect(onImport).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent(/Keine verwertbaren Zeilen/);
  });

  it("sperrt den Import-Knopf, solange nichts eingefügt wurde", async () => {
    await oeffnen();
    expect(screen.getByRole("button", { name: /^Importieren$/ })).toBeDisabled();
  });
});
