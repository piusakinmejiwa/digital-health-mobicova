// The MobiCova Health wordmark. The asset is a dark-on-transparent wordmark, so
// on dark chrome (sidebar, auth hero, portal top bars) render it on a white
// "chip"; on light surfaces use it bare.
export default function BrandLogo({ chip = false }: { chip?: boolean }) {
  const img = <img src="/images/logo.png" alt="MobiCova Health" className="brand-logo" />;
  return chip ? <span className="brand-logo-chip">{img}</span> : img;
}
