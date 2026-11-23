import React, { useEffect, useRef, useState } from 'react';
import { catalogRequest } from './catalogApi.js';

const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

export default function ChartDialog({ onClose }) {
  const dialog = useRef(null);
  const [points, setPoints] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    dialog.current.showModal();
    catalogRequest('chart', { signal: controller.signal }).then(setPoints).catch(() => {
      if (!controller.signal.aborted) setError(true);
    });
    return () => controller.abort();
  }, []);

  const max = Math.max(1, ...(points?.map(({ value }) => Math.abs(value)) ?? []));

  return (
    <dialog className="chart-dialog" ref={dialog} aria-labelledby="chart-title" onCancel={(event) => {
      event.preventDefault();
      onClose();
    }}>
      <h2 id="chart-title">Финансовый результат по месяцам</h2>
      {error && <p role="alert">Не удалось загрузить график.</p>}
      {!error && !points && <p role="status">Загрузка…</p>}
      {points?.length === 0 && <p>Данных для графика пока нет.</p>}
      {points?.length > 0 && (
        <ol className="chart" aria-label="Демонстрационные данные, тыс. ₽">
          {points.map(({ month, value }) => (
            <li key={month}>
              <span>{months[month - 1]}</span>
              <span className="chart-axis" aria-hidden="true">
                <span className={value < 0 ? 'chart-negative' : 'chart-positive'} style={{ width: `${Math.abs(value) / max * 50}%` }} />
              </span>
              <span>{value.toLocaleString('ru-RU')}</span>
            </li>
          ))}
        </ol>
      )}
      <button className="secondary-button" type="button" onClick={onClose}>Закрыть</button>
    </dialog>
  );
}
