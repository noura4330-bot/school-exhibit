// يضع عنوان العمود على كل خلية (data-label) كي تُعرض الجداول بطاقاتٍ مقروءة على الجوال دون قص الأعمدة.
function labelTable(table: HTMLTableElement) {
  const heads = Array.from(table.tHead?.rows[0]?.cells ?? []).map((c) => c.textContent?.trim() ?? '')
  for (const body of Array.from(table.tBodies)) {
    for (const row of Array.from(body.rows)) {
      Array.from(row.cells).forEach((cell, i) => {
        const label = heads[i] ?? ''
        if (cell.dataset.label !== label) cell.dataset.label = label
      })
    }
  }
}

export function watchTableLabels(root: HTMLElement) {
  let queued = false
  const run = () => {
    queued = false
    root.querySelectorAll<HTMLTableElement>('table.table').forEach(labelTable)
  }
  const observer = new MutationObserver(() => {
    if (!queued) {
      queued = true
      requestAnimationFrame(run)
    }
  })
  observer.observe(root, { childList: true, subtree: true, characterData: true })
  run()
  return () => observer.disconnect()
}
