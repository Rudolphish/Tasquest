export function SignOutButton() {
  return (
    <form action="/auth/signout" method="post">
      <button
        type="submit"
        className="numeric"
        style={{
          height: 34,
          padding: '0 14px',
          background: 'transparent',
          border: '1px solid var(--line)',
          color: 'var(--text-3)',
          fontSize: 12,
          letterSpacing: '0.16em',
        }}
      >
        SIGN OUT
      </button>
    </form>
  );
}
