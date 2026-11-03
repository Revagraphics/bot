import Chat from './components/Chat';
import AdminPage from './components/AdminPage';
// import ProductCatalog from './components/ProductCatalog';

export default function App() {
  const isAdminPage = window.location.pathname.replace(/\/+$/, '') === '/admin';

  if (isAdminPage) return <AdminPage />;

  return (
    <div className="min-h-screen bg-[#05060b] text-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <header className="mb-8 flex items-center justify-between gap-4">
          <h1 className="text-3xl font-bold tracking-tight">Eezy-Office</h1>
          {/* <a href="/admin" className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-indigo-500 hover:text-white">
            Admin portal
          </a> */}
        </header>

        {/* <ProductCatalog onAskAbout={askAboutProduct} /> */}


        <section>
          {/* <h2 className="mb-4 text-2xl font-bold">Ask us anything</h2> */}
          <Chat />
        </section>
      </div>
    </div>
  );
}