import React, { useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import logo from './fasol-logo.png';
import ConnectionDialog from './ConnectionDialog.jsx';
import ProductDialog from './ProductDialog.jsx';
import ProductRow from './ProductRow.jsx';
import ChartDialog from './ChartDialog.jsx';
import { catalogRequest } from './catalogApi.js';
import { exportCatalog } from './exportCatalog.js';
import './styles.css';

function Catalog() {
  const [connection, setConnection] = useState(null);
  const [products, setProducts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState(null);
  const [showChart, setShowChart] = useState(false);
  const [exporting, setExporting] = useState(false);

  function handleConnected(details) {
    flushSync(() => setConnection(details));
    window.alert('Вы успешно подключились');
  }

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const data = await catalogRequest('products');
      const version = Date.now();
      setProducts(data.map((product) => product.imageUrl
        ? { ...product, imageUrl: `${product.imageUrl}?v=${version}` }
        : product));
    } catch {
      setError('Не удалось загрузить товары. Попробуйте обновить список.');
    } finally {
      setLoading(false);
    }
  }

  function disconnect() {
    setEditor(null);
    setProducts(null);
    setConnection(null);
    setError('Подключитесь к базе данных заново.');
  }

  async function remove(product) {
    if (!window.confirm(`Удалить товар «${product.name}»?`)) return;
    setLoading(true);
    setError('');
    try {
      await catalogRequest(`products/${product.id}`, { method: 'DELETE' });
      setProducts((current) => current.filter(({ id }) => id !== product.id));
    } catch (failure) {
      if (failure.status === 401) disconnect();
      else setError(failure.message);
    } finally {
      setLoading(false);
    }
  }

  async function exportReport(format, menu) {
    menu.open = false;
    setExporting(true);
    setError('');
    try {
      await exportCatalog(format, products);
    } catch {
      setError('Не удалось сформировать файл. Попробуйте ещё раз.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="catalog">
      <header className="catalog-header">
        <h1><img className="catalog-logo" src={logo} width="506" height="180" alt="Фасоль" /></h1>
        {connection && (
          <button type="button" onClick={refresh} disabled={loading}>
            {loading ? 'Загрузка…' : 'Обновить'}
          </button>
        )}
      </header>

      <div className="connection-bar">
        {connection ? (
          <p role="status">Соединение с базой данных {connection.database} установлено.</p>
        ) : (
          <ConnectionDialog onConnected={handleConnected} />
        )}
      </div>

      {error && <p className="notice" role="alert">{error}</p>}

      {products !== null && <>
        <div className="catalog-tools">
          <button type="button" disabled={loading} onClick={() => setEditor({})}>Добавить товар</button>
          <button className="secondary-button" type="button" onClick={() => setShowChart(true)}>График</button>
          <details className="export-menu">
            <summary>{exporting ? 'Экспорт…' : 'Экспорт'}</summary>
            {['HTML', 'Word', 'PDF'].map((label, index) => (
              <button type="button" key={label} disabled={exporting || loading} onClick={(event) => {
                exportReport(['html', 'docx', 'pdf'][index], event.currentTarget.closest('details'));
              }}>{label}</button>
            ))}
          </details>
        </div>
        <div className="catalog-table">
        <table aria-label="Товары" aria-busy={loading}>
          <thead>
            <tr>
              <th scope="col">ID</th>
              <th scope="col">Товар</th>
              <th scope="col">Категория</th>
              <th scope="col">Дата производства</th>
              <th scope="col">Действия</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => <ProductRow key={product.id} product={product} disabled={loading}
              onEdit={(selected) => setEditor({ product: selected })} onDelete={remove} />)}
            {products.length === 0 && (
              <tr><td colSpan={5}>Товаров пока нет.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </>}

      {editor && <ProductDialog product={editor.product} onClose={() => setEditor(null)} onDisconnected={disconnect}
        onSaved={() => { setEditor(null); refresh(); }} />}
      {showChart && <ChartDialog onClose={() => setShowChart(false)} />}
    </main>
  );
}

createRoot(document.getElementById('root')).render(<Catalog />);
