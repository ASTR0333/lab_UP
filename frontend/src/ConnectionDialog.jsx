import React, { useRef, useState } from 'react';

export default function ConnectionDialog({ onConnected }) {
  const dialog = useRef(null);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  function openDialog() {
    setFailed(false);
    dialog.current.showModal();
  }

  async function connect(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const details = {
      address: values.get('address').trim(),
      database: values.get('database').trim(),
      user: values.get('user').trim(),
    };
    const password = values.get('password');
    form.elements.password.value = '';
    setPending(true);
    setFailed(false);

    try {
      const response = await fetch('/api/connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...details, password }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch {
      setFailed(true);
      return;
    } finally {
      setPending(false);
    }

    dialog.current.close();
    onConnected(details);
  }

  return (
    <>
      <button className="secondary-button" type="button" onClick={openDialog}>
        Подключиться к БД…
      </button>
      <dialog ref={dialog} aria-labelledby="connection-title" onCancel={(event) => {
        if (pending) event.preventDefault();
      }} onClose={(event) => event.currentTarget.querySelector('form').reset()}>
        <h2 id="connection-title">Подключение к БД</h2>
        <form onSubmit={connect}>
          <label>Имя сервера<input name="address" placeholder="db:1433" required /></label>
          <label>Имя базы данных<input name="database" placeholder="fasol" required /></label>
          <label>Логин<input name="user" placeholder="sa" autoComplete="username" required /></label>
          <label>Пароль<input name="password" type="password" autoComplete="current-password" required /></label>

          {failed && (
            <p role="alert">Соединение не установлено. Проверьте параметры подключения.</p>
          )}

          <div className="dialog-actions">
            <button type="submit" disabled={pending}>{pending ? 'Подключение…' : 'Подключиться'}</button>
            <button className="secondary-button" type="button" disabled={pending} onClick={() => dialog.current.close()}>
              Закрыть
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
