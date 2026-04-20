export function WebXRExtensionNote() {
  return (
    <div className="glass" style={{ padding: 16 }}>
      <h3 style={{ margin: 0 }}>AR/VR Extension Hook</h3>
      <p style={{ color: "var(--ink-1)", marginBottom: 0 }}>
        Scene graph and behavior engine are isolated for WebXR mounting. Replace this with XR session controls when AR/VR phase starts.
      </p>
    </div>
  );
}
