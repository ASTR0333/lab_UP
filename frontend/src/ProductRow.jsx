import React, { useRef } from 'react';

export default function ProductRow({ product, disabled, onEdit, onDelete }) {
  const actions = useRef(null);
  const { id, name, category, date, imageUrl } = product;

  function select(action) {
    actions.current.open = false;
    action(product);
  }

  return (
    <tr onContextMenu={(event) => {
      if (disabled) return;
      event.preventDefault();
      actions.current.open = true;
      actions.current.querySelector('button').focus();
    }}>
      <td>{id}</td>
      <td>{imageUrl && <img className="product-image" src={imageUrl} alt="" />} {name}</td>
      <td>{category}</td>
      <td>{date ? date.split('-').reverse().join('.') : '—'}</td>
      <td className="row-actions">
        <details ref={actions} onKeyDown={(event) => {
          if (event.key === 'Escape') {
            actions.current.open = false;
            actions.current.querySelector('summary').focus();
          }
        }}>
          <summary aria-label={`Действия: ${name}`}>Действия</summary>
          <div className="row-menu">
            <button type="button" disabled={disabled} onClick={() => select(onEdit)}>Изменить</button>
            <button type="button" disabled={disabled} onClick={() => select(onDelete)}>Удалить</button>
          </div>
        </details>
      </td>
    </tr>
  );
}
