// ============================================================
// mount.jsx — loaded last in the protected bundle.
// Renders the paid-access chip + the roadmap App. The render
// hook is invoked by the public boot loader after injection.
// ============================================================

// What THIS buyer paid, handed over by the boot loader from their payment
// record. Never a literal and never the current price: the price moves, a
// receipt doesn't. Falls back to an unpriced label rather than inventing a
// number when the amount is unknown (admin tokens, pre-amount-column rows).
function accessLabel() {
  const a = (typeof window !== "undefined" && window.__vibeAccess) || {};
  if (a.admin) return "Admin access";
  if (!Number.isFinite(a.amountPaise)) return "Paid";
  return `Paid · ₹${(a.amountPaise / 100).toFixed(2).replace(/\.00$/, "")}`;
}

function AccessChip() {
  function signOut() {
    try {
      localStorage.removeItem("vibe-token");
      localStorage.removeItem("vibe-payment-id");
    } catch (e) {}
    window.location.reload();
  }
  return (
    <div className="user-bar access-chip" title="Lifetime access · paid">
      <div className="user-bar-avatar">✓</div>
      <div className="user-bar-info">
        <div className="user-bar-name">Lifetime access</div>
        <div className="user-bar-meta">{accessLabel()}</div>
      </div>
      <button className="user-bar-signout" onClick={signOut} title="Sign out of this browser">⎋</button>
    </div>
  );
}

window.__renderRoadmap = function () {
  const App = window.__RoadmapApp;
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.Fragment>
      <AccessChip />
      <App />
    </React.Fragment>
  );
};
