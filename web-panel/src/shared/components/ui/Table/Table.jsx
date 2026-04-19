import React from 'react';
import './Table.css';

export const Table = ({ 
  columns = [], 
  data = [], 
  emptyMessage = 'Veri bulunamadı',
  emptyIcon = '📋',
  onRowClick,
  className = ''
}) => {
  if (data.length === 0) {
    return (
      <div className="table-empty-state">
        <div className="table-empty-icon">{emptyIcon}</div>
        <p className="table-empty-message">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`table-wrapper ${className}`}>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th key={column.key || index} style={column.style}>
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
            >
              {columns.map((column, colIndex) => (
                <td key={column.key || colIndex} style={column.style}>
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

