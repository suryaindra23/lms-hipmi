"use client";

import {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  CloudOff,
  ExternalLink,
  FileUp,
  Loader2,
  Save,
  ShieldAlert,
  Store,
} from "lucide-react";
import { csrfFetch } from "@/lib/csrf";

type ChecklistItem = {
  id: string;
  label: string;
  description?: string;
  weight: number;
  isRequired: boolean;
};
type StoreAssignment = {
  id: string;
  title: string;
  description?: string;
  endDate: string;
  checklistTemplate: { minimumProducts: number; items: ChecklistItem[] };
  storeSubmissions: Array<{
    id: string;
    status: string;
    rowVersion: number;
    currentVersion: number;
    score?: number;
    feedback?: string;
  }>;
};
type Draft = {
  assignmentId: string;
  platform: string;
  storeName: string;
  storeUsername: string;
  storeExternalId: string;
  storeUrl: string;
  category: string;
  description: string;
  createdDate: string;
  productCount: number;
  productName: string;
  productUrl: string;
  productPrice: string;
  productStock: string;
  studentNotes: string;
  obstacles: string;
  declarationAccepted: boolean;
  checklist: Record<string, boolean>;
};

const platforms = ["SHOPEE", "TIKTOK", "TOKOPEDIA", "LAZADA", "INSTAGRAM_SHOP", "WHATSAPP_BUSINESS", "WEBSITE", "OTHER"];
const initialDraft: Draft = {
  assignmentId: "",
  platform: "SHOPEE",
  storeName: "",
  storeUsername: "",
  storeExternalId: "",
  storeUrl: "",
  category: "",
  description: "",
  createdDate: "",
  productCount: 0,
  productName: "",
  productUrl: "",
  productPrice: "",
  productStock: "",
  studentNotes: "",
  obstacles: "",
  declarationAccepted: false,
  checklist: {},
};

async function apiError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null);
  const message = payload?.message;
  return Array.isArray(message) ? message.join(", ") : message || fallback;
}

export default function StudentStorePage() {
  const [assignments, setAssignments] = useState<StoreAssignment[]>([]);
  const [selected, setSelected] = useState<StoreAssignment | null>(null);
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [submission, setSubmission] = useState<any>(null);
  const [step, setStep] = useState(1);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [offlineSavedAt, setOfflineSavedAt] = useState<string>("");
  const [syncStatus, setSyncStatus] = useState<
    "local" | "syncing" | "synced" | "conflict"
  >("local");
  const syncVersion = useRef(0);
  const [conflictDraft, setConflictDraft] = useState<{ version: number; content: Partial<Draft> } | null>(null);

  const loadSyncedDraft = useCallback(
    async (assignmentId: string, hasLocalDraft: boolean) => {
      if (!navigator.onLine) return;
      const response = await fetch(
        `/api/backend/support/sync-drafts/store-${assignmentId}`,
      );
      if (!response.ok) return;
      if (response.status === 204) return;
      const serverDraft = await response.json().catch(() => null);
      if (!serverDraft) return;
      syncVersion.current = serverDraft.version;
      if (!hasLocalDraft && serverDraft.content) {
        setDraft((current) => ({
          ...current,
          ...serverDraft.content,
          assignmentId,
        }));
      }
      setSyncStatus("synced");
    },
    [],
  );

  const loadSubmission = useCallback(async (id: string) => {
    const response = await fetch(
      `/api/backend/student-store/submissions/${id}`,
    );
    if (!response.ok) return;
    const data = await response.json().catch(() => null);
    if (!data) return;
    setSubmission(data);
    const offline = data.draftData || {};
    setDraft((current) => ({
      ...current,
      platform: data.studentStore?.platform || current.platform,
      storeName: data.studentStore?.storeName || "",
      storeUsername: data.studentStore?.storeUsername || "",
      storeExternalId: data.studentStore?.storeExternalId || "",
      storeUrl: data.studentStore?.storeUrl || "",
      category: data.studentStore?.category || "",
      description: data.studentStore?.description || "",
      createdDate: data.studentStore?.createdDate?.slice(0, 10) || "",
      productCount: data.studentStore?.productCount || 0,
      productName: offline.products?.[0]?.name || "",
      productUrl: offline.products?.[0]?.url || "",
      productPrice: offline.products?.[0]?.price || "",
      productStock: offline.products?.[0]?.stock || "",
      studentNotes: offline.studentNotes || "",
      obstacles: offline.obstacles || "",
      declarationAccepted: Boolean(offline.declarationAccepted),
      checklist: Object.fromEntries(
        data.checklistResponses.map((item: any) => [
          item.itemId,
          item.completed,
        ]),
      ),
    }));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/backend/student-store/assignments");
      if (!response.ok)
        throw new Error(
          await apiError(response, "Tugas toko belum dapat dimuat"),
        );
      const data: StoreAssignment[] = await response.json();
      setAssignments(data);
      const requestedId =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("assignmentId")
          : null;
      const target =
        data.find((item) => item.id === requestedId) || data[0] || null;
      setSelected(target);
      if (target) {
        const local = localStorage.getItem(`store-draft:${target.id}`);
        setDraft(
          local
            ? { ...initialDraft, ...JSON.parse(local), assignmentId: target.id }
            : { ...initialDraft, assignmentId: target.id },
        );
        await loadSyncedDraft(target.id, Boolean(local));
        if (target.storeSubmissions[0])
          await loadSubmission(target.storeSubmissions[0].id);
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Data belum dapat dimuat",
      );
    } finally {
      setLoading(false);
    }
  }, [loadSubmission, loadSyncedDraft]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!draft.assignmentId) return;
    const timer = window.setTimeout(async () => {
      localStorage.setItem(
        `store-draft:${draft.assignmentId}`,
        JSON.stringify(draft),
      );
      setOfflineSavedAt(
        new Date().toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
      setSyncStatus("local");
      if (!navigator.onLine) return;
      setSyncStatus("syncing");
      const response = await csrfFetch(
        `/api/backend/support/sync-drafts/store-${draft.assignmentId}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ content: draft, version: syncVersion.current }),
        },
      );
      if (response.status === 409) {
        const payload = await response.json().catch(() => null);
        const conflict = payload?.message && typeof payload.message === "object" ? payload.message : payload;
        setConflictDraft(conflict ? { version: Number(conflict.serverVersion || 0), content: conflict.serverDraft || {} } : null);
        setSyncStatus("conflict");
        return;
      }
      if (!response.ok) {
        setSyncStatus("local");
        return;
      }
      const synced = await response.json();
      syncVersion.current = synced.version;
      setSyncStatus("synced");
    }, 900);
    return () => window.clearTimeout(timer);
  }, [draft]);

  const useServerDraft = () => {
    if (!conflictDraft || !draft.assignmentId) return;
    syncVersion.current = conflictDraft.version;
    setDraft({ ...initialDraft, ...conflictDraft.content, assignmentId: draft.assignmentId });
    setConflictDraft(null);
    setSyncStatus("synced");
    setMessage("Versi draf dari akun dipakai pada perangkat ini.");
  };

  const overwriteServerDraft = async () => {
    if (!conflictDraft || !draft.assignmentId) return;
    setSyncStatus("syncing");
    const response = await csrfFetch(`/api/backend/support/sync-drafts/store-${draft.assignmentId}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ content: draft, version: conflictDraft.version }) });
    if (!response.ok) { setSyncStatus("conflict"); return; }
    const synced = await response.json();
    syncVersion.current = synced.version;
    setConflictDraft(null);
    setSyncStatus("synced");
    setMessage("Draf perangkat ini menggantikan versi akun.");
  };

  const clearLocalDraft = () => {
    if (!draft.assignmentId) return;
    localStorage.removeItem(`store-draft:${draft.assignmentId}`);
    setOfflineSavedAt("");
    setMessage("Salinan draf di perangkat ini telah dihapus.");
  };

  const checklistItems = useMemo(
    () => selected?.checklistTemplate?.items || [],
    [selected],
  );
  const completed = checklistItems.filter(
    (item) => draft.checklist[item.id],
  ).length;
  const isLocked = [
    "APPROVED",
    "SUBMITTED",
    "RESUBMITTED",
    "UNDER_REVIEW",
    "REJECTED",
  ].includes(submission?.status);
  const publicStoreUrl =
    submission?.studentStore?.normalizedStoreUrl || draft.storeUrl;
  const completeness = useMemo(() => {
    const required = [
      draft.storeName.length >= 2,
      /^https?:\/\//.test(draft.storeUrl),
      draft.productCount >= (selected?.checklistTemplate.minimumProducts || 1),
      checklistItems.every(
        (item) => !item.isRequired || draft.checklist[item.id],
      ),
      Boolean(
        submission?.files?.some((file: any) => file.scanStatus === "CLEAN"),
      ),
      draft.declarationAccepted,
    ];
    return Math.round(
      (required.filter(Boolean).length / required.length) * 100,
    );
  }, [draft, checklistItems, selected, submission]);

  const selectAssignment = async (assignment: StoreAssignment) => {
    setSelected(assignment);
    setStep(1);
    setError("");
    setMessage("");
    const local = localStorage.getItem(`store-draft:${assignment.id}`);
    setDraft(
      local
        ? { ...initialDraft, ...JSON.parse(local), assignmentId: assignment.id }
        : { ...initialDraft, assignmentId: assignment.id },
    );
    syncVersion.current = 0;
    setSyncStatus("local");
    await loadSyncedDraft(assignment.id, Boolean(local));
    setSubmission(null);
    if (assignment.storeSubmissions[0])
      await loadSubmission(assignment.storeSubmissions[0].id);
  };

  const saveDraft = async () => {
    if (!selected) return null;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await csrfFetch(
        "/api/backend/student-store/submissions/draft",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            assignmentId: selected.id,
            rowVersion: submission?.rowVersion,
            platform: draft.platform,
            storeName: draft.storeName,
            storeUsername: draft.storeUsername || undefined,
            storeExternalId: draft.storeExternalId || undefined,
            storeUrl: draft.storeUrl,
            category: draft.category || undefined,
            description: draft.description || undefined,
            createdDate: draft.createdDate || undefined,
            productCount: draft.productCount,
            products: draft.productName
              ? [
                  {
                    name: draft.productName,
                    url: draft.productUrl,
                    price: draft.productPrice,
                    stock: draft.productStock,
                  },
                ]
              : [],
            studentNotes: draft.studentNotes || undefined,
            obstacles: draft.obstacles || undefined,
            declarationAccepted: draft.declarationAccepted,
            checklist: checklistItems.map((item) => ({
              itemId: item.id,
              completed: Boolean(draft.checklist[item.id]),
            })),
          }),
        },
      );
      if (!response.ok)
        throw new Error(await apiError(response, "Draf belum dapat disimpan"));
      const saved = await response.json();
      setMessage("Draf aman tersimpan di server.");
      await loadSubmission(saved.id);
      return saved.id as string;
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Draf belum dapat disimpan",
      );
      return null;
    } finally {
      setSaving(false);
    }
  };

  const uploadFiles = async () => {
    if (!pendingFiles.length) return;
    setUploading(true);
    setError("");
    try {
      const submissionId = submission?.id || (await saveDraft());
      if (!submissionId) return;
      for (const [position, file] of pendingFiles.entries()) {
        const prepare = await csrfFetch(
          `/api/backend/student-store/submissions/${submissionId}/files/upload-url`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              fileName: file.name,
              mimeType: file.type,
              sizeBytes: file.size,
              kind: "EVIDENCE",
            }),
          },
        );
        if (!prepare.ok)
          throw new Error(
            await apiError(
              prepare,
              `Unggahan ${file.name} belum dapat disiapkan`,
            ),
          );
        const signed = await prepare.json();
        const upload = await fetch(signed.uploadUrl, {
          method: "PUT",
          headers: { "content-type": file.type },
          body: file,
        });
        if (!upload.ok) throw new Error(`Unggahan ${file.name} gagal`);
        const register = await csrfFetch(
          `/api/backend/student-store/submissions/${submissionId}/files`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              storageKey: signed.storageKey,
              fileName: file.name,
              mimeType: file.type,
              sizeBytes: file.size,
              kind: "EVIDENCE",
              position,
            }),
          },
        );
        if (!register.ok)
          throw new Error(
            await apiError(register, `File ${file.name} belum dapat dicatat`),
          );
      }
      setPendingFiles([]);
      setMessage(
        "Bukti diunggah dan sedang dipindai. Muat ulang beberapa saat lagi.",
      );
      await loadSubmission(submissionId);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Bukti belum dapat diunggah",
      );
    } finally {
      setUploading(false);
    }
  };

  const removeFile = async (fileId: string) => {
    if (!submission?.id) return;
    setSaving(true);
    setError("");
    try {
      const response = await csrfFetch(
        `/api/backend/student-store/files/${fileId}`,
        { method: "DELETE" },
      );
      if (!response.ok)
        throw new Error(await apiError(response, "Bukti belum dapat dihapus"));
      setMessage("Bukti dihapus. Anda dapat mengunggah penggantinya.");
      await loadSubmission(submission.id);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Bukti belum dapat dihapus",
      );
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    const submissionId = submission?.id || (await saveDraft());
    if (!submissionId) return;
    setSaving(true);
    setError("");
    try {
      const response = await csrfFetch(
        `/api/backend/student-store/submissions/${submissionId}/submit`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            declarationAccepted: draft.declarationAccepted,
          }),
        },
      );
      if (!response.ok)
        throw new Error(
          await apiError(response, "Submission belum dapat dikirim"),
        );
      setMessage("Tugas toko berhasil dikirim dan versi tersimpan.");
      localStorage.removeItem(`store-draft:${draft.assignmentId}`);
      await csrfFetch(
        `/api/backend/support/sync-drafts/store-${draft.assignmentId}`,
        { method: "DELETE" },
      );
      syncVersion.current = 0;
      setSyncStatus("synced");
      await loadSubmission(submissionId);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Submission belum dapat dikirim",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <main className="min-h-screen bg-[#FFFFFF] p-8 font-semibold text-orange-600">
        Memuat Student Store...
      </main>
    );
  return (
    <main className="min-h-screen bg-[#FFFFFF] p-4 sm:p-8">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-orange-600">
          Student Store
        </p>
        <h2 className="mt-2 text-2xl font-extrabold text-slate-800">
          Pengumpulan Toko Digital
        </h2>
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <ShieldAlert className="mt-0.5 shrink-0" size={19} />
          <p>
            <strong>Keamanan:</strong> unggah hanya bukti yang sudah disanitasi.
            Jangan pernah memasukkan password, PIN, OTP, cookie, recovery code,
            API secret, atau data pembayaran.
          </p>
        </div>
        {error && (
          <div
            role="alert"
            className="mt-4 flex gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-700"
          >
            <AlertCircle size={18} />
            {error}
          </div>
        )}
        {message && (
          <div
            role="status"
            className="mt-4 flex gap-2 rounded-xl bg-green-50 p-4 text-sm text-green-700"
          >
            <CheckCircle2 size={18} />
            {message}
          </div>
        )}
        {assignments.length === 0 ? (
          <div className="mt-6 rounded-xl bg-white p-8 text-center text-slate-500">
            Belum ada tugas Student Store untuk course Anda.
          </div>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap gap-2">
              {assignments.map((assignment) => (
                <button
                  key={assignment.id}
                  onClick={() => void selectAssignment(assignment)}
                  className={`rounded-full px-4 py-2 text-sm font-bold ${selected?.id === assignment.id ? "bg-orange-600 text-white" : "bg-white text-slate-600"}`}
                >
                  {assignment.title}
                </button>
              ))}
            </div>
            <section className="mt-5 rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="font-bold text-slate-800">
                    {selected?.title}
                  </h3>
                  <p className="mt-1 max-w-2xl text-sm text-slate-500">
                    {selected?.description}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-orange-700">
                    Deadline{" "}
                    {selected &&
                      new Date(selected.endDate).toLocaleString("id-ID")}
                  </p>
                </div>
                <div className="min-w-44">
                  <div className="flex justify-between text-xs font-bold text-slate-600">
                    <span>Kelengkapan</span>
                    <span>{completeness}%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full bg-orange-500"
                      style={{ width: `${completeness}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Status: {submission?.status || "DRAFT"} · Versi{" "}
                    {submission?.currentVersion || 0}
                  </p>
                </div>
              </div>
            </section>
            <nav
              aria-label="Tahap pengumpulan toko"
              className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6"
            >
              {[
                "Info toko",
                "Profil",
                "Produk",
                "Operasional",
                "Bukti",
                "Preview",
              ].map((label, index) => (
                <button
                  key={label}
                  onClick={() => setStep(index + 1)}
                  className={`min-h-12 rounded-xl px-2 text-xs font-bold ${step === index + 1 ? "bg-orange-600 text-white" : "border bg-white text-slate-600"}`}
                >
                  <span className="block">{index + 1}</span>
                  {label}
                </button>
              ))}
            </nav>
            <section className="mt-5 rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
              {isLocked && (
                <div className="mb-4 rounded-xl bg-blue-50 p-4 text-sm text-blue-800">
                  Submission sedang atau sudah direview dan terkunci.
                  Penyuntingan server tersedia kembali jika guru meminta revisi.
                </div>
              )}
              {step === 1 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Platform">
                    <select
                      value={draft.platform}
                      onChange={(event) =>
                        setDraft({ ...draft, platform: event.target.value })
                      }
                      className="form-control"
                    >
                      {platforms.map((item) => (
                        <option key={item}>{item.replaceAll("_", " ")}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Nama toko">
                    <input
                      value={draft.storeName}
                      onChange={(event) =>
                        setDraft({ ...draft, storeName: event.target.value })
                      }
                      className="form-control"
                      placeholder="Nama toko publik"
                    />
                  </Field>
                  <Field label="URL publik toko">
                    <input
                      type="url"
                      value={draft.storeUrl}
                      onChange={(event) =>
                        setDraft({ ...draft, storeUrl: event.target.value })
                      }
                      className="form-control"
                      placeholder="https://..."
                    />
                  </Field>
                  <Field label="Username publik">
                    <input
                      value={draft.storeUsername}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          storeUsername: event.target.value,
                        })
                      }
                      className="form-control"
                    />
                  </Field>
                  <Field label="ID toko publik (opsional)">
                    <input
                      value={draft.storeExternalId}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          storeExternalId: event.target.value,
                        })
                      }
                      className="form-control"
                    />
                  </Field>
                  <Field label="Tanggal dibuat">
                    <input
                      type="date"
                      value={draft.createdDate}
                      onChange={(event) =>
                        setDraft({ ...draft, createdDate: event.target.value })
                      }
                      className="form-control"
                    />
                  </Field>
                </div>
              )}
              {step === 2 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Kategori">
                    <input
                      value={draft.category}
                      onChange={(event) =>
                        setDraft({ ...draft, category: event.target.value })
                      }
                      className="form-control"
                    />
                  </Field>
                  <Field label="Deskripsi toko">
                    <textarea
                      value={draft.description}
                      onChange={(event) =>
                        setDraft({ ...draft, description: event.target.value })
                      }
                      className="form-control min-h-28"
                    />
                  </Field>
                  <div className="rounded-xl bg-orange-50 p-4 text-sm text-orange-900 sm:col-span-2">
                    <Store className="mb-2" />
                    Logo dan banner dapat dipilih bersama bukti pada langkah 5.
                    Semua file disimpan privat dan dipindai.
                  </div>
                </div>
              )}
              {step === 3 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label={`Jumlah produk (minimum ${selected?.checklistTemplate.minimumProducts})`}
                  >
                    <input
                      type="number"
                      min={0}
                      value={draft.productCount}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          productCount: Number(event.target.value),
                        })
                      }
                      className="form-control"
                    />
                  </Field>
                  <Field label="Contoh nama produk utama">
                    <input
                      value={draft.productName}
                      onChange={(event) =>
                        setDraft({ ...draft, productName: event.target.value })
                      }
                      className="form-control"
                    />
                  </Field>
                  <Field label="URL produk">
                    <input
                      type="url"
                      value={draft.productUrl}
                      onChange={(event) =>
                        setDraft({ ...draft, productUrl: event.target.value })
                      }
                      className="form-control"
                    />
                  </Field>
                  <Field label="Harga">
                    <input
                      value={draft.productPrice}
                      onChange={(event) =>
                        setDraft({ ...draft, productPrice: event.target.value })
                      }
                      className="form-control"
                      placeholder="Contoh: 75000"
                    />
                  </Field>
                  <Field label="Stok">
                    <input
                      value={draft.productStock}
                      onChange={(event) =>
                        setDraft({ ...draft, productStock: event.target.value })
                      }
                      className="form-control"
                    />
                  </Field>
                </div>
              )}
              {step === 4 && (
                <div>
                  <h3 className="font-bold text-slate-800">
                    Checklist kelengkapan
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {completed} dari {checklistItems.length} item selesai.
                  </p>
                  <div className="mt-4 space-y-3">
                    {checklistItems.map((item) => (
                      <label
                        key={item.id}
                        className="flex items-start gap-3 rounded-xl border p-4"
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(draft.checklist[item.id])}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              checklist: {
                                ...draft.checklist,
                                [item.id]: event.target.checked,
                              },
                            })
                          }
                          className="mt-1 size-4"
                        />
                        <span className="text-sm text-slate-700">
                          <strong>{item.label}</strong>{" "}
                          <span className="text-orange-700">
                            · {item.weight}%{item.isRequired ? " · wajib" : ""}
                          </span>
                          {item.description && (
                            <span className="mt-1 block text-slate-500">
                              {item.description}
                            </span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                  <Field label="Catatan proses">
                    <textarea
                      value={draft.studentNotes}
                      onChange={(event) =>
                        setDraft({ ...draft, studentNotes: event.target.value })
                      }
                      className="form-control mt-1 min-h-24"
                    />
                  </Field>
                  <Field label="Kendala yang ditemui">
                    <textarea
                      value={draft.obstacles}
                      onChange={(event) =>
                        setDraft({ ...draft, obstacles: event.target.value })
                      }
                      className="form-control mt-1 min-h-20"
                    />
                  </Field>
                </div>
              )}
              {step === 5 && (
                <div>
                  <h3 className="font-bold text-slate-800">Bukti privat</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    JPG, PNG, WebP, PDF, atau MP4. Maksimal 20 MB per file.
                  </p>
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,application/pdf,video/mp4"
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setPendingFiles(Array.from(event.target.files || []))
                    }
                    className="mt-4 block w-full rounded-xl border p-3 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => void uploadFiles()}
                    disabled={!pendingFiles.length || uploading || isLocked}
                    className="mt-3 flex min-h-11 items-center gap-2 rounded-xl bg-orange-600 px-4 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {uploading ? (
                      <Loader2 className="animate-spin" size={17} />
                    ) : (
                      <FileUp size={17} />
                    )}
                    Unggah {pendingFiles.length || ""} bukti
                  </button>
                  <div className="mt-4 grid gap-2">
                    {submission?.files?.map((file: any) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3 text-sm"
                      >
                        <span className="min-w-0 truncate">
                          {file.originalFileName}
                        </span>
                        <span
                          className={`font-bold ${file.scanStatus === "CLEAN" ? "text-green-700" : file.scanStatus === "INFECTED" || file.scanStatus === "FAILED" ? "text-red-600" : "text-amber-700"}`}
                        >
                          {file.scanStatus}
                        </span>
                        {!isLocked && (
                          <button
                            type="button"
                            onClick={() => void removeFile(file.id)}
                            className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600"
                          >
                            Hapus/ganti
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {step === 6 && (
                <div>
                  <h3 className="font-bold text-slate-800">
                    Preview & konfirmasi
                  </h3>
                  <dl className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-slate-500">Toko</dt>
                      <dd className="font-bold">{draft.storeName || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Platform</dt>
                      <dd className="font-bold">{draft.platform}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Produk</dt>
                      <dd className="font-bold">{draft.productCount}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Checklist</dt>
                      <dd className="font-bold">
                        {completed}/{checklistItems.length}
                      </dd>
                    </div>
                  </dl>
                  {publicStoreUrl && (
                    <a
                      href={publicStoreUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-orange-600"
                    >
                      Buka URL publik <ExternalLink size={16} />
                    </a>
                  )}
                  <label className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
                    <input
                      type="checkbox"
                      checked={draft.declarationAccepted}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          declarationAccepted: event.target.checked,
                        })
                      }
                      className="mt-1 size-4"
                    />
                    <span>
                      Saya menyatakan toko dan bukti ini milik saya/kelompok
                      saya, serta tidak memuat kredensial atau data pembayaran
                      sensitif.
                    </span>
                  </label>
                  {submission?.versions?.length > 0 && (
                    <div className="mt-5">
                      <h4 className="font-bold">Riwayat versi</h4>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {submission.versions.map((version: any) => (
                          <span
                            key={version.id}
                            className="rounded-full bg-slate-100 px-3 py-1 text-xs"
                          >
                            Versi {version.versionNumber} ·{" "}
                            {new Date(version.createdAt).toLocaleString(
                              "id-ID",
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {submission?.feedback && (
                    <div className="mt-4 rounded-xl bg-blue-50 p-4 text-sm text-blue-800">
                      <strong>Feedback:</strong> {submission.feedback}
                      {submission.score != null && (
                        <span className="ml-2 font-bold">
                          Nilai {submission.score}
                        </span>
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => void submit()}
                    disabled={saving || !draft.declarationAccepted || isLocked}
                    className="mt-5 min-h-12 w-full rounded-xl bg-green-600 font-bold text-white disabled:opacity-50"
                  >
                    Kumpulkan dan simpan versi
                  </button>
                </div>
              )}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <span
                  className={`flex items-center gap-2 text-xs ${syncStatus === "conflict" ? "font-bold text-red-600" : "text-slate-500"}`}
                >
                  {syncStatus === "conflict" ? (
                    <CloudOff size={15} />
                  ) : (
                    <Cloud size={15} />
                  )}
                  {syncStatus === "syncing"
                    ? "Menyinkronkan draf..."
                    : syncStatus === "synced"
                      ? "Draf tersinkron ke akun"
                      : syncStatus === "conflict"
                        ? "Konflik draf: muat ulang sebelum melanjutkan"
                        : `Draf lokal otomatis ${offlineSavedAt ? `pukul ${offlineSavedAt}` : ""}`}
                </span>
                {syncStatus === "conflict" && conflictDraft && (
                  <div className="flex w-full flex-wrap gap-2 rounded-xl bg-red-50 p-3 text-xs">
                    <button type="button" onClick={useServerDraft} className="min-h-10 rounded-lg bg-white px-3 font-bold text-red-700">Pakai versi akun</button>
                    <button type="button" onClick={() => void overwriteServerDraft()} className="min-h-10 rounded-lg border border-red-200 px-3 font-bold text-red-700">Pakai versi perangkat</button>
                  </div>
                )}
                <div className="flex gap-2">
                  <button type="button" onClick={clearLocalDraft} className="min-h-11 rounded-xl border px-4 text-sm font-bold text-slate-600">Hapus draf lokal</button>
                  <button
                    type="button"
                    onClick={() => setStep(Math.max(1, step - 1))}
                    disabled={step === 1}
                    className="min-h-11 rounded-xl border px-4 text-sm font-bold disabled:opacity-40"
                  >
                    Kembali
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveDraft()}
                    disabled={saving || isLocked}
                    className="flex min-h-11 items-center gap-2 rounded-xl border border-orange-300 px-4 text-sm font-bold text-orange-700 disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <Save size={16} />
                    )}
                    Simpan server
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(Math.min(6, step + 1))}
                    disabled={step === 6}
                    className="min-h-11 rounded-xl bg-orange-600 px-4 text-sm font-bold text-white disabled:opacity-40"
                  >
                    Lanjut
                  </button>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-bold text-slate-700">
      {label}
      <span className="mt-1 block">{children}</span>
    </label>
  );
}
