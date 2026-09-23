export default function Loader({ full = false, label = 'جارٍ التحميل...' }) {
  return (
    <div className={`loader-wrap ${full ? 'full' : ''}`}>
      <span className="spinner" />
      <span>{label}</span>
    </div>
  );
}
