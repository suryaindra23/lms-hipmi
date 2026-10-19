export default function PackageLoading() {
  return (
    <main className="min-h-screen bg-[#FFFFFF] px-4 py-20" aria-busy="true" aria-label="Memuat pilihan paket">
      <div className="mx-auto max-w-7xl animate-pulse">
        <div className="mx-auto h-10 max-w-xl rounded-xl bg-amber-100" />
        <div className="mx-auto mt-5 h-5 max-w-2xl rounded bg-amber-50" />
        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {[0, 1, 2].map((item) => <div key={item} className="h-[520px] rounded-3xl border border-amber-100 bg-white" />)}
        </div>
      </div>
    </main>
  );
}
