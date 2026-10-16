import type { PrintItem } from './publishData'

/**
 * One published list exactly as printed: an optional title line and a bordered three-column
 * table (No. · Name Preferred · points) coloured by band. No matric, whole-number points.
 */
export function PublishedTable({ item }: { readonly item: PrintItem }) {
  return (
    <section className="pub-list" aria-label={item.title ?? item.list.pointsLabel}>
      {item.title && <h2 className="pub-title">{item.title}</h2>}
      <table className="pub-table">
        <thead>
          <tr>
            <th className="pub-no" scope="col">No.</th>
            <th className="pub-name" scope="col">Name Preferred</th>
            <th className="pub-points" scope="col">{item.list.pointsLabel}</th>
          </tr>
        </thead>
        <tbody>
          {item.list.rows.map((row) => (
            <tr key={row.no} className={`pub-${row.band}`}>
              <td className="pub-no">{row.no}</td>
              <td className="pub-name">{row.name}</td>
              <td className="pub-points">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
