import React, { useEffect, useRef, useState } from 'react';
import { catalogRequest } from './catalogApi.js';

function readImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Не удалось прочитать фотографию.'));
    reader.readAsDataURL(file);
  });
}

export default function ProductDialog({ product, onClose, onSaved, onDisconnected }) {
  const dialog = useRef(null);
  const [categories, setCategories] = useState(null);
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    dialog.current.showModal();
    catalogRequest('categories', { signal: controller.signal }).then(setCategories).catch(() => {
      if (!controller.signal.aborted) setError('Не удалось загрузить категории. Закройте форму и попробуйте ещё раз.');
    });
    return () => controller.abort();
  }, []);

  async function save(event) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const input = { name: fields.get('name').trim(), categoryId: Number(fields.get('categoryId')), date: fields.get('date') };
    const photo = fields.get('photo');
    setSaving(true);
    setError('');
    try {
      if (photo.size > 0) {
        if (photo.size > 2 * 1024 * 1024 || !['image/png', 'image/jpeg'].includes(photo.type)) {
          throw new Error('Выберите PNG или JPEG размером до 2 МБ.');
        }
        input.image = await readImage(photo);
      } else if (fields.has('removeImage')) {
        input.image = '';
      }
      await catalogRequest(product ? `products/${product.id}` : 'products', {
        method: product ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
    } catch (failure) {
      if (failure.status === 401) onDisconnected();
      else setError(failure.message);
      return;
    } finally {
      setSaving(false);
    }
    onSaved();
  }

  return (
    <dialog ref={dialog} aria-labelledby="product-title" onCancel={(event) => {
      event.preventDefault();
      if (!saving) onClose();
    }}>
      <h2 id="product-title">{product ? 'Изменить товар' : 'Добавить товар'}</h2>
      <form onSubmit={save}>
        <label>Название<input name="name" defaultValue={product?.name} maxLength={30} required /></label>
        <label>Категория
          <select name="categoryId" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} disabled={!categories} required>
            <option value="" disabled>{categories ? 'Выберите категорию' : 'Загрузка категорий…'}</option>
            {categories?.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <label>Дата производства<input type="date" name="date" defaultValue={product?.date} min="0001-01-01" max="9999-12-31" /></label>
        {product?.imageUrl && (
          <div className="existing-photo">
            <img src={product.imageUrl} alt="Текущая фотография товара" />
            <label><input type="checkbox" name="removeImage" /> Удалить фотографию</label>
          </div>
        )}
        <label>Фотография (PNG или JPEG до 2 МБ)<input type="file" name="photo" accept="image/png,image/jpeg" /></label>
        {error && <p role="alert">{error}</p>}
        <div className="dialog-actions">
          <button type="submit" disabled={!categories?.length || saving}>{saving ? 'Сохранение…' : 'Сохранить'}</button>
          <button className="secondary-button" type="button" onClick={onClose} disabled={saving}>Отмена</button>
        </div>
      </form>
    </dialog>
  );
}
