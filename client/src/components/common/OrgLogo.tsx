// An organisation's logo: the uploaded image if there is one, otherwise a
// coloured circle with the logo letter(s). Used on branded surfaces (member
// app, login, rewards).
export default function OrgLogo({ url, letter, name, color = '#0a7b7b', size = 40 }: {
  url?: string; letter?: string; name?: string; color?: string; size?: number;
}) {
  if (url) {
    return (
      <img
        src={url}
        alt={name || 'Logo'}
        style={{ width: size, height: size, borderRadius: 10, objectFit: 'contain', background: '#fff', border: '1px solid #e3eded' }}
      />
    );
  }
  const initial = (letter || name?.charAt(0) || 'M').toUpperCase().slice(0, 2);
  return (
    <span style={{
      width: size, height: size, borderRadius: 10, background: color, color: '#fff',
      display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: size * 0.4,
    }}>{initial}</span>
  );
}
