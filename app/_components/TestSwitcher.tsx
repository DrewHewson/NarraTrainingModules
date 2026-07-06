/**
 * TEST-ONLY role switcher. Renders nothing unless NEXT_PUBLIC_TEST_MODE ===
 * "true". Two buttons POST to /dev/act-as (itself gated by TEST_MODE) to
 * instantly re-authenticate as the seeded admin or learner — no sign-out,
 * no password typing. Never enable in a real production deploy.
 */
export default function TestSwitcher() {
  if (process.env.NEXT_PUBLIC_TEST_MODE !== "true") return null;

  const btnStyle: React.CSSProperties = {
    padding: "0.3rem 0.7rem",
    fontSize: "0.68rem",
    letterSpacing: "0.08em",
  };

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.5rem",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-geist-sans), sans-serif",
          fontSize: "0.58rem",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--clay-deep)",
          border: "1px solid var(--line)",
          borderRadius: "999px",
          padding: "0.2em 0.6em",
        }}
      >
        Test
      </span>
      <form action="/dev/act-as" method="post" style={{ display: "inline" }}>
        <input type="hidden" name="role" value="admin" />
        <button type="submit" className="narra-btn ghost" style={btnStyle}>
          Admin view
        </button>
      </form>
      <form action="/dev/act-as" method="post" style={{ display: "inline" }}>
        <input type="hidden" name="role" value="learner" />
        <button type="submit" className="narra-btn ghost" style={btnStyle}>
          Learner view
        </button>
      </form>
    </div>
  );
}
