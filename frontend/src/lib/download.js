/** Bietet Text als Datei zum Herunterladen an. */
export function downloadText(content, filename, mimeType = "text/plain") {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Erst freigeben, wenn der Browser den Download angestoßen hat.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
