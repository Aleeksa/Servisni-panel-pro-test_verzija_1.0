import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch, clearToken, getToken, setToken } from './api.js';

const emptyTask = {
  title: '',
  client: '',
  contact: '',
  phone: '',
  assignee: '',
  category: 'servis',
  description: '',
  notes: '',
  priority: 'srednji',
  status: 'novo',
  paymentStatus: 'nije-placeno',
  price: '',
  paidAmount: '',
  tags: '',
  link: '',
  dueDate: ''
};

const pages = [
  ['overview', 'Pregled', 'bi-speedometer2'],
  ['tasks', 'Zadaci', 'bi-kanban'],
  ['clients', 'Klijenti', 'bi-buildings'],
  ['finance', 'Naplata', 'bi-cash-stack'],
  ['calendar', 'Kalendar', 'bi-calendar2-week'],
  ['reports', 'Izveštaji', 'bi-bar-chart-line'],
  ['settings', 'Podešavanja', 'bi-sliders']
];

const statusOptions = [
  ['novo', 'Novo'],
  ['u-radu', 'U radu'],
  ['zavrseno', 'Završeno']
];

const priorityOptions = [
  ['nizak', 'Nizak'],
  ['srednji', 'Srednji'],
  ['hitno', 'Hitno']
];

const paymentOptions = [
  ['nije-placeno', 'Nije plaćeno'],
  ['delimicno', 'Delimično'],
  ['placeno', 'Plaćeno']
];

const categoryOptions = [
  ['servis', 'Servis'],
  ['nalog', 'Radni nalog'],
  ['podrska', 'Podrška'],
  ['odrzavanje', 'Održavanje'],
  ['naplata', 'Naplata'],
  ['hitno', 'Hitna intervencija'],
  ['other', 'Ostalo']
];

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [login, setLogin] = useState({ email: '', password: '' });
  const [tasks, setTasks] = useState([]);
  const [activePage, setActivePage] = useState(localStorage.getItem('servispanel_page') || 'overview');
  const [theme, setTheme] = useState(localStorage.getItem('servispanel_theme') || 'dark');
  const [message, setMessage] = useState('');
  const [filters, setFilters] = useState({ search: '', status: 'all', priority: 'all', payment: 'all', due: 'all' });
  const [viewMode, setViewMode] = useState(localStorage.getItem('servispanel_view') || 'cards');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [taskForm, setTaskForm] = useState(emptyTask);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('servispanel_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('servispanel_page', activePage);
  }, [activePage]);

  useEffect(() => {
    localStorage.setItem('servispanel_view', viewMode);
  }, [viewMode]);

  useEffect(() => {
    const controller = new AbortController();
    async function boot() {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      try {
        const me = await apiFetch('/api/auth/me', { signal: controller.signal });
        setUser(me.user);
        await loadTasks();
      } catch (err) {
        clearToken();
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    boot();
    return () => controller.abort();
  }, []);

  async function loadTasks() {
    const data = await apiFetch('/api/tasks');
    setTasks(data.tasks || []);
  }

  function notify(text) {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 2800);
  }

  async function handleLogin(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(login)
      });
      setToken(data.token);
      setUser(data.user);
      await loadTasks();
      notify('Uspešna prijava.');
    } catch (err) {
      notify(err.message || 'Login nije uspeo.');
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    clearToken();
    setUser(null);
    setTasks([]);
    setLogin({ email: '', password: '' });
  }

  function openNewTask() {
    setEditingId(null);
    setTaskForm(emptyTask);
    setFormOpen(true);
  }

  function editTask(task) {
    setEditingId(task.id);
    setTaskForm({ ...emptyTask, ...task });
    setFormOpen(true);
    setActivePage('tasks');
  }

  async function saveTask(event) {
    event.preventDefault();
    if (!taskForm.title.trim() || !taskForm.client.trim() || !taskForm.description.trim()) {
      notify('Naslov, klijent i opis su obavezni.');
      return;
    }
    setBusy(true);
    try {
      if (editingId) {
        await apiFetch(`/api/tasks/${editingId}`, { method: 'PUT', body: JSON.stringify(taskForm) });
        notify('Zadatak je izmenjen.');
      } else {
        await apiFetch('/api/tasks', { method: 'POST', body: JSON.stringify(taskForm) });
        notify('Zadatak je dodat.');
      }
      setFormOpen(false);
      await loadTasks();
    } catch (err) {
      notify(err.message || 'Čuvanje nije uspelo.');
    } finally {
      setBusy(false);
    }
  }

  async function updateTask(id, patch) {
    const current = tasks.find(task => task.id === id);
    if (!current) return;
    try {
      await apiFetch(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify({ ...current, ...patch }) });
      await loadTasks();
    } catch (err) {
      notify(err.message || 'Izmena nije uspela.');
    }
  }

  async function removeTask(id) {
    if (!window.confirm('Da li sigurno brišeš zadatak?')) return;
    try {
      await apiFetch(`/api/tasks/${id}`, { method: 'DELETE' });
      await loadTasks();
      notify('Zadatak je obrisan.');
    } catch (err) {
      notify(err.message || 'Brisanje nije uspelo.');
    }
  }

  async function clearAll() {
    if (!window.confirm('Ovo briše sve radne naloge iz sistema. Nastavljaš?')) return;
    try {
      await apiFetch('/api/tasks', { method: 'DELETE' });
      await loadTasks();
      notify('Svi zadaci su obrisani.');
    } catch (err) {
      notify(err.message || 'Brisanje nije uspelo.');
    }
  }

  const filtered = useMemo(() => filterTasks(tasks, filters), [tasks, filters]);
  const stats = useMemo(() => calculateStats(tasks), [tasks]);
  const clients = useMemo(() => groupClients(tasks), [tasks]);
  const finance = useMemo(() => financeSummary(tasks), [tasks]);

  const exportCsv = useCallback(() => {
    const rows = [
      ['title', 'client', 'status', 'priority', 'paymentStatus', 'price', 'paidAmount', 'dueDate', 'category', 'assignee', 'description'],
      ...filtered.map(task => [task.title, task.client, task.status, task.priority, task.paymentStatus, task.price, task.paidAmount, task.dueDate, task.category, task.assignee, task.description])
    ];
    const csv = rows.map(row => row.map(value => `"${String(value || '').replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `servisni-nalozi-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  if (loading) {
    return <Loader />;
  }

  if (!user) {
    return (
      <AppShell theme={theme} setTheme={setTheme} message={message}>
        <section className="login-wrap container-fluid px-3 px-lg-4 py-4">
          <div className="row justify-content-center align-items-center min-vh-75 g-4 g-xxl-5">
            <div className="col-12 col-lg-5 col-xxl-4">
              <div className="card glass-card login-card border-0 shadow-lg reveal-card">
                <div className="card-body p-4 p-lg-5">
                  <div className="text-center mb-4">
                    <div className="hero-icon mx-auto mb-3"><i className="bi bi-kanban" /></div>
                    <p className="eyebrow mb-2">Profesionalni servisni sistem</p>
                    <h1 className="display-6 fw-black mb-2">ServisPanel</h1>
                    <p className="text-secondary mb-0">Centralni panel za radne naloge, klijente, rokove i naplatu.</p>
                  </div>

                  <div className="feature-strip mb-4">
                    <span><i className="bi bi-shield-check" /> Sigurna prijava</span>
                    <span><i className="bi bi-kanban" /> Radni nalozi</span>
                    <span><i className="bi bi-cash-coin" /> Naplata</span>
                  </div>

                  <form className="vstack gap-3" onSubmit={handleLogin}>
                    <div className="form-floating-group">
                      <label className="form-label" htmlFor="email">Email</label>
                      <input id="email" type="email" className="form-control form-control-lg" placeholder="admin@firma.com" value={login.email} onChange={e => setLogin({ ...login, email: e.target.value })} required />
                    </div>
                    <div className="form-floating-group">
                      <label className="form-label" htmlFor="password">Lozinka</label>
                      <input id="password" type="password" className="form-control form-control-lg" placeholder="••••••••" value={login.password} onChange={e => setLogin({ ...login, password: e.target.value })} required />
                    </div>
                    <button className="btn btn-primary btn-lg w-100 glow-btn" disabled={busy} type="submit">
                      <i className="bi bi-shield-lock me-2" />{busy ? 'Prijava...' : 'Prijavi se'}
                    </button>
                  </form>

                  <div className="small text-secondary mt-4">
                    Pristup je namenjen ovlašćenim korisnicima. Podatke za prijavu dobija administrator sistema.
                  </div>
                </div>
              </div>
            </div>

            <div className="col-12 col-lg-7 col-xxl-6 d-none d-lg-block">
              <div className="showcase-panel reveal-card delay-2">
                <div className="showcase-topbar"><span /><span /><span /><strong>ServisPanel</strong></div>
                <div className="showcase-hero">
                  <div>
                    <p className="eyebrow mb-2">Poslovni pregled</p>
                    <h2 className="fw-black mb-2">Sve što servisu treba na jednom ekranu.</h2>
                    <p className="text-secondary mb-0">Pratite otvorene poslove, hitne naloge, rokove, klijente i naplatu bez haosa u porukama.</p>
                  </div>
                  <div className="live-pill"><i className="bi bi-activity" /> Online</div>
                </div>
                <div className="preview-grid">
                  <div className="preview-stat"><span>Aktivno</span><strong>12</strong><i className="bi bi-lightning-charge" /></div>
                  <div className="preview-stat accent"><span>Hitno</span><strong>3</strong><i className="bi bi-exclamation-triangle" /></div>
                  <div className="preview-stat success"><span>Naplaćeno</span><strong>86%</strong><i className="bi bi-cash-coin" /></div>
                </div>
                <div className="floating-ticket ticket-a"><span className="mini-badge urgent">Hitno</span><strong>Intervencija kod klijenta</strong><small>Rok danas · 12.000 RSD</small></div>
                <div className="floating-ticket ticket-b"><span className="mini-badge done">Završeno</span><strong>Servisni nalog zatvoren</strong><small>Izveštaj spreman za štampu</small></div>
              </div>
            </div>
          </div>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell theme={theme} setTheme={setTheme} user={user} logout={logout} message={message}>
      <main className="container-fluid px-3 px-lg-4 py-4">
        <section className="dashboard-hero mb-4">
          <div className="row g-3 align-items-center">
            <div className="col-12 col-lg-8">
              <p className="eyebrow mb-2">Poslovni panel</p>
              <h2 className="fw-black mb-2">ServisPanel komandni centar</h2>
              <p className="text-secondary mb-3">Dobrodošli, <strong>{user.email}</strong>. Pregledajte naloge, rokove, klijente i naplatu iz jednog sistema.</p>
              <div className="hero-chip-row">
                <span><i className="bi bi-window-stack" /> Više modula</span>
                <span><i className="bi bi-phone" /> Radi i na telefonu</span>
                <span><i className="bi bi-shield-lock" /> Zaštićen pristup</span>
              </div>
            </div>
            <div className="col-12 col-lg-4">
              <div className="d-flex flex-wrap justify-content-lg-end gap-2">
                <button className="btn btn-outline-secondary" onClick={exportCsv}><i className="bi bi-download me-1" />CSV</button>
                <button className="btn btn-outline-secondary" onClick={() => window.print()}><i className="bi bi-printer me-1" />Štampa</button>
                <button className="btn btn-primary" onClick={openNewTask}><i className="bi bi-plus-lg me-1" />Novi zadatak</button>
              </div>
            </div>
          </div>
        </section>

        <nav className="workspace-tabs glass-card mb-4" aria-label="ServisPanel moduli">
          {pages.map(([key, label, icon]) => (
            <button key={key} className={`workspace-tab ${activePage === key ? 'active' : ''}`} type="button" onClick={() => setActivePage(key)}>
              <i className={`bi ${icon}`} /><span>{label}</span>
            </button>
          ))}
        </nav>

        {activePage === 'overview' && <Overview stats={stats} tasks={tasks} clients={clients} finance={finance} editTask={editTask} />}
        {activePage === 'tasks' && (
          <TasksPage
            tasks={filtered}
            filters={filters}
            setFilters={setFilters}
            viewMode={viewMode}
            setViewMode={setViewMode}
            editTask={editTask}
            updateTask={updateTask}
            removeTask={removeTask}
            openNewTask={openNewTask}
          />
        )}
        {activePage === 'clients' && <ClientsPage clients={clients} editTask={editTask} />}
        {activePage === 'finance' && <FinancePage tasks={tasks} finance={finance} editTask={editTask} />}
        {activePage === 'calendar' && <CalendarPage tasks={tasks} editTask={editTask} />}
        {activePage === 'reports' && <ReportsPage tasks={tasks} stats={stats} clients={clients} finance={finance} />}
        {activePage === 'settings' && <SettingsPage tasks={tasks} user={user} clearAll={clearAll} />}
      </main>

      {formOpen && (
        <TaskFormOverlay
          task={taskForm}
          setTask={setTaskForm}
          onClose={() => setFormOpen(false)}
          onSave={saveTask}
          editing={Boolean(editingId)}
          busy={busy}
        />
      )}
    </AppShell>
  );
}

function AppShell({ children, theme, setTheme, user, logout, message }) {
  useEffect(() => {
    function move(e) {
      document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`);
      document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`);
    }
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, []);

  return (
    <>
      <div className="ambient-bg" aria-hidden="true">
        <span className="orb orb-1" /><span className="orb orb-2" /><span className="orb orb-3" /><span className="mesh-grid" />
      </div>
      <div className="cursor-glow" aria-hidden="true" />
      <nav className="navbar navbar-expand-lg navbar-dark app-navbar sticky-top">
        <div className="container-fluid px-3 px-lg-4">
          <a className="navbar-brand fw-bold d-flex align-items-center gap-2" href="#" onClick={e => e.preventDefault()}>
            <span className="brand-icon"><i className="bi bi-tools" /></span>
            <span>ServisPanel</span>
          </a>
          <div className="ms-auto d-flex align-items-center gap-2">
            <span className="badge rounded-pill text-bg-success">Online</span>
            <button className="btn btn-outline-light btn-sm" type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Promeni temu">
              <i className={`bi ${theme === 'dark' ? 'bi-sun' : 'bi-moon-stars'}`} />
            </button>
            {user && <button className="btn btn-outline-light btn-sm" type="button" onClick={logout}><i className="bi bi-box-arrow-right me-1" />Odjava</button>}
          </div>
        </div>
      </nav>
      {children}
      {message && <div className="toast-float"><i className="bi bi-info-circle me-2" />{message}</div>}
    </>
  );
}

function Overview({ stats, tasks, clients, finance, editTask }) {
  const dueSoon = sortTasks(tasks).filter(task => task.status !== 'zavrseno' && task.dueDate).slice(0, 5);
  const unpaid = tasks.filter(task => task.paymentStatus !== 'placeno').sort((a, b) => money(b.price) - money(a.price)).slice(0, 5);
  return (
    <section className="app-page active">
      <div className="row g-3 mb-4">
        <Stat title="Ukupno" value={stats.total} icon="bi-collection" />
        <Stat title="Novo" value={stats.novo} icon="bi-stars" />
        <Stat title="U radu" value={stats.uRadu} icon="bi-arrow-repeat" />
        <Stat title="Završeno" value={stats.zavrseno} icon="bi-check2-circle" />
        <Stat title="Kasni" value={stats.late} icon="bi-exclamation-triangle" danger />
        <Stat title="Iznos" value={formatMoney(finance.total)} icon="bi-cash-coin" money />
      </div>
      <div className="row g-3 mb-4">
        <div className="col-12 col-xl-7"><Window title="Pregled po statusu" icon="bi-kanban" subtitle="Brz vizuelni pregled aktivnog posla."><MiniKanban tasks={tasks} /></Window></div>
        <div className="col-12 col-xl-5"><Window title="Finansije" icon="bi-wallet2" subtitle="Koliko je dogovoreno i koliko čeka naplatu."><FinanceBars finance={finance} /></Window></div>
      </div>
      <div className="row g-3">
        <div className="col-12 col-lg-4"><Window title="Rokovi uskoro" icon="bi-clock-history" subtitle="Šta prvo treba da uradiš."><StackList items={dueSoon} empty="Nema rokova." editTask={editTask} /></Window></div>
        <div className="col-12 col-lg-4"><Window title="Čeka naplatu" icon="bi-wallet2" subtitle="Zadaci gde pare nisu zatvorene."><StackList items={unpaid} empty="Sve je naplaćeno." editTask={editTask} showMoney /></Window></div>
        <div className="col-12 col-lg-4"><Window title="Aktivni klijenti" icon="bi-people" subtitle="Ko ima najviše otvorenog posla."><ClientStack clients={clients.slice(0, 5)} /></Window></div>
      </div>
    </section>
  );
}

function TasksPage({ tasks, filters, setFilters, viewMode, setViewMode, editTask, updateTask, removeTask, openNewTask }) {
  return (
    <section className="app-page active">
      <div className="page-heading mb-3">
        <div><p className="eyebrow mb-1">Zadaci</p><h3 className="fw-black mb-1">Svi tehnički zadaci</h3><p className="text-secondary mb-0">Filtriraj, menjaj status i otvaraj detalje.</p></div>
        <button className="btn btn-primary" onClick={openNewTask}><i className="bi bi-plus-lg me-1" />Novi zadatak</button>
      </div>

      <div className="card border-0 shadow-sm mb-4 filters-card pro-window">
        <div className="card-body">
          <div className="row g-3 align-items-end">
            <div className="col-12 col-xl-4"><label className="form-label">Pretraga</label><div className="input-group"><span className="input-group-text"><i className="bi bi-search" /></span><input className="form-control" placeholder="Naslov, klijent, opis, telefon, tag..." value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} /></div></div>
            <SelectFilter label="Status" value={filters.status} onChange={v => setFilters({ ...filters, status: v })} options={[['all', 'Svi statusi'], ...statusOptions]} />
            <SelectFilter label="Prioritet" value={filters.priority} onChange={v => setFilters({ ...filters, priority: v })} options={[['all', 'Svi'], ...priorityOptions]} />
            <SelectFilter label="Plaćanje" value={filters.payment} onChange={v => setFilters({ ...filters, payment: v })} options={[['all', 'Sve'], ...paymentOptions]} />
            <SelectFilter label="Rok" value={filters.due} onChange={v => setFilters({ ...filters, due: v })} options={[[ 'all', 'Svi' ], [ 'late', 'Kasni' ], [ 'today', 'Danas' ], [ 'week', '7 dana' ]]} small />
            <div className="col-12 col-xl-1 d-grid"><button className="btn btn-outline-secondary" onClick={() => setFilters({ search: '', status: 'all', priority: 'all', payment: 'all', due: 'all' })}>Reset</button></div>
          </div>
          <div className="d-flex gap-2 justify-content-end mt-3">
            <button className={`btn btn-sm ${viewMode === 'cards' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setViewMode('cards')}><i className="bi bi-grid-3x3-gap me-1" />Kartice</button>
            <button className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setViewMode('table')}><i className="bi bi-table me-1" />Tabela</button>
          </div>
        </div>
      </div>

      {tasks.length === 0 ? <EmptyState icon="bi-inbox" title="Nema zadataka" text="Dodaj prvi zadatak ili promeni filtere." /> : viewMode === 'cards' ? (
        <div className="row g-3">{tasks.map(task => <div className="col-12 col-md-6 col-xxl-4" key={task.id}><TaskCard task={task} editTask={editTask} updateTask={updateTask} removeTask={removeTask} /></div>)}</div>
      ) : (
        <div className="card border-0 shadow-sm pro-window"><div className="table-responsive"><table className="table align-middle mb-0"><thead><tr><th>Naslov</th><th>Klijent</th><th>Status</th><th>Prioritet</th><th>Rok</th><th>Naplata</th><th className="text-end">Akcije</th></tr></thead><tbody>{tasks.map(task => <TaskRow key={task.id} task={task} editTask={editTask} updateTask={updateTask} removeTask={removeTask} />)}</tbody></table></div></div>
      )}
    </section>
  );
}

function ClientsPage({ clients, editTask }) {
  return <section className="app-page active"><div className="page-heading mb-3"><div><p className="eyebrow mb-1">Klijenti</p><h3 className="fw-black mb-1">Klijenti iz zadataka</h3><p className="text-secondary mb-0">Automatski se prave po imenu klijenta.</p></div></div>{clients.length ? <div className="row g-3">{clients.map(client => <div className="col-12 col-md-6 col-xxl-4" key={client.name}><div className="card border-0 shadow-sm pro-window client-card h-100"><div className="card-body"><div className="d-flex justify-content-between align-items-start gap-2 mb-3"><div className="client-avatar">{initials(client.name)}</div><span className={`badge ${client.late ? 'text-bg-danger' : 'text-bg-success'}`}>{client.late ? `${client.late} kasni` : 'U redu'}</span></div><h3 className="h5 fw-black mb-1">{client.name}</h3><p className="text-secondary small mb-3"><i className="bi bi-person-lines-fill me-1" />{client.contact || 'Nema kontakta'}</p><div className="client-metrics"><span><strong>{client.count}</strong><small>zadataka</small></span><span><strong>{client.open}</strong><small>otvoreno</small></span><span><strong>{formatMoney(client.revenue)}</strong><small>iznos</small></span></div><div className="mt-3 stack-list compact"><StackList items={client.tasks.slice(0, 3)} editTask={editTask} empty="Nema" /></div></div></div></div>)}</div> : <EmptyState icon="bi-buildings" title="Nema klijenata" text="Dodaj zadatak sa imenom klijenta." />}</section>;
}

function FinancePage({ tasks, finance, editTask }) {
  const list = [...tasks].sort((a, b) => money(b.price) - money(a.price));
  return <section className="app-page active"><div className="page-heading mb-3"><div><p className="eyebrow mb-1">Naplata</p><h3 className="fw-black mb-1">Pregled naplate</h3><p className="text-secondary mb-0">Prati dogovoreno, plaćeno i preostalo.</p></div></div><div className="row g-3 mb-4"><Stat title="Ukupno" value={formatMoney(finance.total)} icon="bi-cash-coin" money /><Stat title="Plaćeno" value={formatMoney(finance.paid)} icon="bi-check-circle" /><Stat title="Ostaje" value={formatMoney(finance.unpaid)} icon="bi-hourglass-split" danger /><Stat title="Čeka" value={finance.waiting} icon="bi-exclamation-circle" /></div><Window title="Svi nalozi za naplatu" icon="bi-receipt" subtitle="Klikni edit za izmenu plaćanja.">{list.length ? list.map(task => <PaymentRow key={task.id} task={task} editTask={editTask} />) : <EmptyMini text="Nema naplate." />}</Window></section>;
}

function CalendarPage({ tasks, editTask }) {
  const dated = tasks.filter(t => t.dueDate).sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
  return <section className="app-page active"><div className="page-heading mb-3"><div><p className="eyebrow mb-1">Kalendar</p><h3 className="fw-black mb-1">Rokovi po datumu</h3><p className="text-secondary mb-0">Svi zadaci koji imaju upisan rok.</p></div></div><Window title="Timeline rokova" icon="bi-calendar2-week" subtitle="Kasni zadaci su označeni crveno.">{dated.length ? dated.map(task => <div className={`timeline-item ${isLate(task) ? 'late' : ''} ${task.dueDate === todayIso() ? 'today' : ''}`} key={task.id}><div className="timeline-date">{formatDate(task.dueDate)}</div><div className="timeline-card"><div className="d-flex justify-content-between gap-2"><div className="min-width-0"><strong className="d-block text-truncate">{task.title}</strong><span className="small text-secondary">{task.client} · {label(categoryOptions, task.category)}</span></div><Badge type="status" value={task.status} /></div>{isLate(task) && <div className="small text-danger fw-bold mt-2"><i className="bi bi-exclamation-triangle me-1" />Rok je prošao</div>}<div className="mt-2"><button className="btn btn-sm btn-outline-primary" onClick={() => editTask(task)}>Otvori</button></div></div></div>) : <EmptyState icon="bi-calendar-x" title="Nema rokova" text="Upiši rok u zadatku." />}</Window></section>;
}

function ReportsPage({ tasks, stats, clients, finance }) {
  const donePercent = stats.total ? Math.round((stats.zavrseno / stats.total) * 100) : 0;
  const byCategory = groupBy(tasks, 'category');
  const byStatus = groupBy(tasks, 'status');
  return <section className="app-page active"><div className="page-heading mb-3"><div><p className="eyebrow mb-1">Izveštaji</p><h3 className="fw-black mb-1">Analitika posla</h3><p className="text-secondary mb-0">Automatski pregled učinka, rokova, naplate i kategorija posla.</p></div></div><div className="row g-3 mb-4"><Stat title="Završenost" value={`${donePercent}%`} icon="bi-pie-chart" /><Stat title="Klijenti" value={clients.length} icon="bi-people" /><Stat title="Kasni" value={stats.late} icon="bi-exclamation-triangle" danger /><Stat title="Promet" value={formatMoney(finance.total)} icon="bi-cash-stack" money /></div><div className="row g-3"><div className="col-12 col-lg-6"><Window title="Po statusu" icon="bi-bar-chart" subtitle="Raspodela zadataka."><ReportBars items={byStatus} options={statusOptions} /></Window></div><div className="col-12 col-lg-6"><Window title="Po kategoriji" icon="bi-tags" subtitle="Koji tip posla dominira."><ReportBars items={byCategory} options={categoryOptions} /></Window></div></div></section>;
}

function SettingsPage({ tasks, user, clearAll }) {
  return <section className="app-page active"><div className="page-heading mb-3"><div><p className="eyebrow mb-1">Podešavanja</p><h3 className="fw-black mb-1">Sistem</h3><p className="text-secondary mb-0">Upravljanje sistemom i podacima.</p></div></div><div className="row g-3"><div className="col-12 col-lg-6"><Window title="Status aplikacije" icon="bi-server" subtitle="Osnovne informacije o radnom prostoru."><div className="settings-list"><div><span>Sistem</span><strong>ServisPanel </strong></div><div><span>Radni prostor</span><strong>Servisni nalozi i klijenti</strong></div><div><span>Pristup</span><strong>Zaštićena admin prijava</strong></div><div><span>Izvoz</span><strong>CSV i štampa</strong></div><div><span>Korisnik</span><strong>{user.email}</strong></div><div><span>Zadaci</span><strong>{tasks.length}</strong></div></div></Window></div><div className="col-12 col-lg-6"><Window title="Opasna zona" icon="bi-exclamation-triangle" subtitle="Briše sve radne naloge iz sistema."><button className="btn btn-outline-danger" onClick={clearAll}><i className="bi bi-trash3 me-1" />Obriši sve zadatke</button><p className="small text-secondary mt-3 mb-0">Ovu akciju koristi samo kada želiš da resetuješ radni prostor.</p></Window></div></div></section>;
}

function TaskFormOverlay({ task, setTask, onClose, onSave, editing, busy }) {
  const update = (field, value) => setTask(prev => ({ ...prev, [field]: value }));
  return <div className="form-overlay"><div className="form-panel card border-0 shadow-lg pro-window"><div className="card-body p-4"><div className="d-flex justify-content-between align-items-start gap-3 mb-3"><div><p className="eyebrow mb-1">{editing ? 'Izmena' : 'Novi unos'}</p><h3 className="fw-black mb-0">{editing ? 'Izmeni zadatak' : 'Novi zadatak'}</h3></div><button className="btn btn-light" onClick={onClose}><i className="bi bi-x-lg" /></button></div><form onSubmit={onSave} className="row g-3"><Input label="Naslov" value={task.title} onChange={v => update('title', v)} required col="col-12 col-md-6" /><Input label="Klijent" value={task.client} onChange={v => update('client', v)} required col="col-12 col-md-6" /><Input label="Kontakt osoba" value={task.contact} onChange={v => update('contact', v)} col="col-12 col-md-6" /><Input label="Telefon/email" value={task.phone} onChange={v => update('phone', v)} col="col-12 col-md-6" /><Input label="Zadužen" value={task.assignee} onChange={v => update('assignee', v)} col="col-12 col-md-4" /><Select label="Kategorija" value={task.category} onChange={v => update('category', v)} options={categoryOptions} col="col-12 col-md-4" /><Select label="Prioritet" value={task.priority} onChange={v => update('priority', v)} options={priorityOptions} col="col-12 col-md-4" /><Select label="Status" value={task.status} onChange={v => update('status', v)} options={statusOptions} col="col-12 col-md-4" /><Select label="Plaćanje" value={task.paymentStatus} onChange={v => update('paymentStatus', v)} options={paymentOptions} col="col-12 col-md-4" /><Input type="date" label="Rok" value={task.dueDate} onChange={v => update('dueDate', v)} col="col-12 col-md-4" /><Input label="Cena" value={task.price} onChange={v => update('price', v)} placeholder="50€" col="col-12 col-md-4" /><Input label="Plaćeno" value={task.paidAmount} onChange={v => update('paidAmount', v)} placeholder="20€" col="col-12 col-md-4" /><Input label="Link/dokument" value={task.link} onChange={v => update('link', v)} col="col-12 col-md-4" /><Textarea label="Opis" value={task.description} onChange={v => update('description', v)} required col="col-12" /><Textarea label="Interne napomene" value={task.notes} onChange={v => update('notes', v)} col="col-12" rows={2} /><Input label="Tagovi" value={task.tags} onChange={v => update('tags', v)} placeholder="hitno, teren, naplata" col="col-12" /><div className="col-12 d-flex justify-content-end gap-2"><button className="btn btn-outline-secondary" type="button" onClick={onClose}>Otkaži</button><button className="btn btn-primary" disabled={busy} type="submit"><i className="bi bi-check2-circle me-1" />{busy ? 'Čuvam...' : 'Sačuvaj'}</button></div></form></div></div></div>;
}

function TaskCard({ task, editTask, updateTask, removeTask }) {
  const late = isLate(task);
  return <div className={`card task-card ${late ? 'is-late' : ''}`}><div className="card-body"><div className="d-flex justify-content-between align-items-start gap-2 mb-2"><div className="min-width-0"><h3 className="h5 task-title mb-1 text-truncate">{task.title}</h3><div className="task-meta text-truncate"><i className="bi bi-building me-1" />{task.client}</div></div><Badge type="priority" value={task.priority} /></div><p className="task-description small mb-3">{task.description}</p><div className="d-flex flex-wrap gap-2 mb-3"><Badge type="status" value={task.status} /><Badge type="payment" value={task.paymentStatus} />{late && <span className="badge text-bg-danger">Kasni</span>}</div><div className="task-info-grid small mb-3"><span><i className="bi bi-person me-1" />{task.assignee || 'Nije dodeljeno'}</span><span><i className="bi bi-calendar me-1" />{task.dueDate || 'Bez roka'}</span><span><i className="bi bi-cash me-1" />{task.price || '0'}</span><span><i className="bi bi-tags me-1" />{label(categoryOptions, task.category)}</span></div>{task.notes && <div className="note-box small mb-3">{task.notes}</div>}<div className="d-flex gap-2"><select className="form-select form-select-sm" value={task.status || 'novo'} onChange={e => updateTask(task.id, { status: e.target.value })}>{statusOptions.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select><button className="btn btn-sm btn-outline-primary" onClick={() => editTask(task)}><i className="bi bi-pencil" /></button><button className="btn btn-sm btn-outline-danger" onClick={() => removeTask(task.id)}><i className="bi bi-trash3" /></button></div></div></div>;
}

function TaskRow({ task, editTask, updateTask, removeTask }) {
  return <tr><td><strong>{task.title}</strong><div className="small text-secondary text-truncate table-desc">{task.description}</div></td><td>{task.client}</td><td><select className="form-select form-select-sm min-select" value={task.status || 'novo'} onChange={e => updateTask(task.id, { status: e.target.value })}>{statusOptions.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></td><td><Badge type="priority" value={task.priority} /></td><td>{task.dueDate || '-'}</td><td><Badge type="payment" value={task.paymentStatus} /></td><td className="text-end"><button className="btn btn-sm btn-outline-primary me-2" onClick={() => editTask(task)}><i className="bi bi-pencil" /></button><button className="btn btn-sm btn-outline-danger" onClick={() => removeTask(task.id)}><i className="bi bi-trash3" /></button></td></tr>;
}

function MiniKanban({ tasks }) {
  return <div className="mini-kanban">{statusOptions.map(([key, text], idx) => { const items = tasks.filter(task => (task.status || 'novo') === key).slice(0, 4); return <div className="kanban-col" key={key}><div className="kanban-head"><span><i className={`bi ${['bi-stars', 'bi-arrow-repeat', 'bi-check2-circle'][idx]} me-1`} />{text}</span><strong>{tasks.filter(task => (task.status || 'novo') === key).length}</strong></div><div className="kanban-list">{items.length ? items.map(task => <div className="kanban-item" key={task.id}><div className="fw-bold text-truncate">{task.title}</div><div className="small text-secondary text-truncate">{task.client}</div></div>) : <div className="kanban-empty">Nema stavki</div>}</div></div>; })}</div>;
}

function Stat({ title, value, icon, danger, money: moneyType }) { return <div className="col-6 col-xl-2"><div className={`stat-card reveal-card ${danger ? 'danger' : ''} ${moneyType ? 'money' : ''}`}><i className={`bi ${icon} stat-icon`} /><span>{title}</span><strong>{value}</strong></div></div>; }
function Window({ title, subtitle, icon, children }) { return <div className="card border-0 shadow-sm h-100 pro-window"><div className="card-body"><div className="window-title"><i className={`bi ${icon}`} /><div><h3>{title}</h3><p>{subtitle}</p></div></div>{children}</div></div>; }
function SelectFilter({ label, value, onChange, options, small }) { return <div className={`col-6 col-md-3 ${small ? 'col-xl-1' : 'col-xl-2'}`}><label className="form-label">{label}</label><select className="form-select" value={value} onChange={e => onChange(e.target.value)}>{options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></div>; }
function Input({ label, value, onChange, col = 'col-12', type = 'text', required, placeholder }) { return <div className={col}><label className="form-label">{label}{required && ' *'}</label><input type={type} className="form-control" value={value || ''} placeholder={placeholder} onChange={e => onChange(e.target.value)} required={required} /></div>; }
function Select({ label, value, onChange, options, col }) { return <div className={col}><label className="form-label">{label}</label><select className="form-select" value={value || ''} onChange={e => onChange(e.target.value)}>{options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></div>; }
function Textarea({ label, value, onChange, col, required, rows = 3 }) { return <div className={col}><label className="form-label">{label}{required && ' *'}</label><textarea className="form-control" rows={rows} value={value || ''} onChange={e => onChange(e.target.value)} required={required} /></div>; }
function Loader() { return <div className="loader-screen"><div className="hero-icon"><i className="bi bi-tools" /></div><p className="mt-3 fw-bold">Učitavanje...</p></div>; }
function EmptyState({ icon, title, text }) { return <div className="empty-state"><i className={`bi ${icon}`} /><h3>{title}</h3><p>{text}</p></div>; }
function EmptyMini({ text }) { return <div className="kanban-empty">{text}</div>; }
function StackList({ items, empty, editTask, showMoney }) { return <div className="stack-list">{items?.length ? items.map(task => <div className="compact-item" key={task.id}><div className="compact-dot"><i className="bi bi-check2-square" /></div><div className="min-width-0 flex-grow-1"><div className="fw-bold text-truncate">{task.title}</div><div className="small text-secondary">{task.client} · {showMoney ? task.price || '0' : task.dueDate || label(statusOptions, task.status)}</div></div>{editTask && <button className="btn btn-sm btn-outline-primary" onClick={() => editTask(task)}>Otvori</button>}</div>) : <EmptyMini text={empty} />}</div>; }
function ClientStack({ clients }) { return <div className="stack-list">{clients.length ? clients.map(c => <div className="compact-item" key={c.name}><div className="compact-dot"><i className="bi bi-building" /></div><div className="min-width-0 flex-grow-1"><div className="fw-bold text-truncate">{c.name}</div><div className="small text-secondary">{c.count} zad. · {c.open} otvoreno · {formatMoney(c.revenue)}</div></div></div>) : <EmptyMini text="Još nema klijenata." />}</div>; }
function FinanceBars({ finance }) { return <div className="finance-grid"><div><span>Ukupno</span><strong>{formatMoney(finance.total)}</strong></div><div><span>Plaćeno</span><strong>{formatMoney(finance.paid)}</strong></div><div><span>Ostaje</span><strong>{formatMoney(finance.unpaid)}</strong></div><div><span>Čeka</span><strong>{finance.waiting}</strong></div></div>; }
function PaymentRow({ task, editTask }) { const total = money(task.price); const paid = money(task.paidAmount); const percent = total ? Math.min(100, Math.round((paid / total) * 100)) : task.paymentStatus === 'placeno' ? 100 : 0; return <div className="payment-row"><div className="min-width-0 flex-grow-1"><div className="d-flex flex-wrap align-items-center gap-2 mb-1"><strong className="text-truncate">{task.title}</strong><Badge type="payment" value={task.paymentStatus} /></div><div className="small text-secondary">{task.client} · plaćeno {task.paidAmount || '0'} / {task.price || '0'}</div><div className="money-progress mt-2"><span style={{ width: `${percent}%` }} /></div></div><button className="btn btn-sm btn-outline-primary" onClick={() => editTask(task)}><i className="bi bi-pencil" /></button></div>; }
function ReportBars({ items, options }) { const max = Math.max(1, ...Object.values(items)); return <div className="report-bars">{options.map(([key, text]) => <div className="report-row" key={key}><span>{text}</span><div className="report-bar"><i style={{ width: `${((items[key] || 0) / max) * 100}%` }} /></div><strong>{items[key] || 0}</strong></div>)}</div>; }

function Badge({ type, value }) { const map = { status: { 'novo': ['Novo', 'text-bg-primary'], 'u-radu': ['U radu', 'text-bg-warning'], 'zavrseno': ['Završeno', 'text-bg-success'] }, priority: { nizak: ['Nizak', 'text-bg-secondary'], srednji: ['Srednji', 'text-bg-info'], hitno: ['Hitno', 'text-bg-danger'] }, payment: { 'nije-placeno': ['Nije plaćeno', 'text-bg-danger'], delimicno: ['Delimično', 'text-bg-warning'], placeno: ['Plaćeno', 'text-bg-success'] } }; const [text, cls] = map[type]?.[value] || [value || '-', 'text-bg-secondary']; return <span className={`badge ${cls}`}>{text}</span>; }

function filterTasks(tasks, filters) { return sortTasks(tasks).filter(task => { const blob = [task.title, task.client, task.contact, task.phone, task.assignee, task.category, task.description, task.notes, task.tags, task.link].join(' ').toLowerCase(); if (filters.search && !blob.includes(filters.search.toLowerCase())) return false; if (filters.status !== 'all' && task.status !== filters.status) return false; if (filters.priority !== 'all' && task.priority !== filters.priority) return false; if (filters.payment !== 'all' && task.paymentStatus !== filters.payment) return false; if (filters.due === 'late' && !isLate(task)) return false; if (filters.due === 'today' && task.dueDate !== todayIso()) return false; if (filters.due === 'week' && !isWithinDays(task.dueDate, 7)) return false; return true; }); }
function sortTasks(tasks) { const rank = { hitno: 0, srednji: 1, nizak: 2 }; return [...tasks].sort((a, b) => Number(isLate(b)) - Number(isLate(a)) || (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9) || String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999')) || String(b.createdAt || '').localeCompare(String(a.createdAt || ''))); }
function calculateStats(tasks) { return { total: tasks.length, novo: tasks.filter(t => t.status === 'novo').length, uRadu: tasks.filter(t => t.status === 'u-radu').length, zavrseno: tasks.filter(t => t.status === 'zavrseno').length, late: tasks.filter(isLate).length }; }
function groupClients(tasks) { const map = new Map(); for (const task of tasks) { const name = task.client || 'Bez klijenta'; if (!map.has(name)) map.set(name, []); map.get(name).push(task); } return [...map.entries()].map(([name, list]) => ({ name, tasks: sortTasks(list), count: list.length, open: list.filter(t => t.status !== 'zavrseno').length, late: list.filter(isLate).length, revenue: list.reduce((sum, t) => sum + money(t.price), 0), contact: list.find(t => t.contact || t.phone)?.contact || list.find(t => t.contact || t.phone)?.phone || '' })).sort((a, b) => b.open - a.open || b.revenue - a.revenue); }
function financeSummary(tasks) { const total = tasks.reduce((sum, t) => sum + money(t.price), 0); const paid = tasks.reduce((sum, t) => sum + money(t.paidAmount), 0); return { total, paid, unpaid: Math.max(0, total - paid), waiting: tasks.filter(t => t.paymentStatus !== 'placeno').length }; }
function groupBy(tasks, key) { return tasks.reduce((acc, task) => { const value = task[key] || 'other'; acc[value] = (acc[value] || 0) + 1; return acc; }, {}); }
function money(value) { if (!value) return 0; const cleaned = String(value).replace(',', '.').replace(/[^0-9.\-]/g, ''); const n = Number(cleaned); return Number.isFinite(n) ? n : 0; }
function formatMoney(value) { return `${Math.round(value * 100) / 100}€`; }
function todayIso() { return new Date().toISOString().slice(0, 10); }
function isLate(task) { return task.dueDate && task.status !== 'zavrseno' && task.dueDate < todayIso(); }
function isWithinDays(date, days) { if (!date) return false; const now = new Date(todayIso()); const then = new Date(date); const diff = (then - now) / 86400000; return diff >= 0 && diff <= days; }
function formatDate(date) { if (!date) return '-'; return new Date(`${date}T12:00:00`).toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
function label(options, value) { return options.find(([v]) => v === value)?.[1] || value || '-'; }
function initials(name) { return String(name || '?').split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase(); }
