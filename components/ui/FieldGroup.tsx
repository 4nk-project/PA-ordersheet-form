export function FieldGroup({ title, description, action, children }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="field-group"><div className="field-group-head"><div><h3>{title}</h3>{description ? <p>{description}</p> : null}</div>{action}</div>{children}</section>;
}
