export default function Stub({ title }: { title: string }) {
  return (
    <div className="panel stub-panel">
      <h2>{title}</h2>
      <p className="muted">Essa área ainda não foi construída — em breve.</p>
    </div>
  );
}
