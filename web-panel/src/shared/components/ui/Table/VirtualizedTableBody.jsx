import React from 'react';

export const VirtualizedTableBody = ({
  rows,
  renderRow,
  getRowKey,
  colSpan,
  scrollTop = 0,
  viewportHeight = 560,
  rowHeight = 56,
  overscan = 6,
}) => {
  const safeRowHeight = Math.max(1, rowHeight);
  const safeViewportHeight = Math.max(safeRowHeight, viewportHeight);
  const totalRows = rows.length;

  if (totalRows === 0) {
    return <tbody />;
  }

  const baseStartIndex = Math.max(0, Math.floor(scrollTop / safeRowHeight) - overscan);
  const visibleCount = Math.ceil(safeViewportHeight / safeRowHeight) + overscan * 2;
  const maxStartIndex = Math.max(0, totalRows - 1);
  const startIndex = Math.min(baseStartIndex, maxStartIndex);
  const endIndex = Math.min(totalRows, startIndex + visibleCount);
  const visibleRows = rows.slice(startIndex, endIndex);

  const topSpacerHeight = startIndex * safeRowHeight;
  const bottomSpacerHeight = Math.max(0, (totalRows - endIndex) * safeRowHeight);

  return (
    <tbody>
      {topSpacerHeight > 0 && (
        <tr aria-hidden="true">
          <td colSpan={colSpan} style={{ height: `${topSpacerHeight}px`, padding: 0, border: 'none' }} />
        </tr>
      )}

      {visibleRows.map((row, localIndex) => {
        const rowIndex = startIndex + localIndex;
        const key = getRowKey ? getRowKey(row, rowIndex) : row?.id ?? rowIndex;
        return renderRow(row, rowIndex, key);
      })}

      {bottomSpacerHeight > 0 && (
        <tr aria-hidden="true">
          <td colSpan={colSpan} style={{ height: `${bottomSpacerHeight}px`, padding: 0, border: 'none' }} />
        </tr>
      )}
    </tbody>
  );
};

