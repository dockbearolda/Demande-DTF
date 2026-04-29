export function FlashDevisStandalonePage() {
  return (
    <div style={{ margin: -24, height: "calc(100% + 48px)", display: "flex", flexDirection: "column" }}>
      <iframe
        src="/devis-flash.html"
        style={{ flex: 1, border: "none", width: "100%", display: "block" }}
        title="Flash Devis"
      />
    </div>
  );
}
