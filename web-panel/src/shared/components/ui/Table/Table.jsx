import React from 'react';
import './Table.css';

export const Table = ({ 
  columns = [], 
  data = [], 
  emptyMessage = 'Veri bulunamadı',
  emptyIcon = '📋',
  onRowClick,
  className = '',
  caption,
}) => {
  if (data.length === 0) {
    return (
      <div className="table-empty-state" role="status">
        <div className="table-empty-icon" aria-hidden="true">{emptyIcon}</div>
        <p className="table-empty-message">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`table-wrapper ${className}`}>
      <table className="data-table" role="table">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr role="row">
            {columns.map((column, index) => (
              <th key={column.key || index} style={column.style} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr 
              key={row.id || rowIndex} 
              onClick={() => onRowClick && onRowClick(row)}
              className={onRowClick ? 'table-row-clickable' : ''}
              role="row"
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onRowClick(row); } : undefined}
              aria-label={onRowClick ? `Row ${rowIndex + 1}` : undefined}
            >
              {columns.map((column, colIndex) => (
                <td key={column.key || colIndex} style={column.style} role="cell">
                  {column.render 
                    ? column.render(row[column.key], row, rowIndex)
                    : row[column.key]
                  }
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

