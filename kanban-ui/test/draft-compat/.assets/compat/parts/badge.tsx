export default function Badge({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <span className="rounded-full bg-white px-2 text-sm">
      {children}
      {label}
    </span>
  );
}
