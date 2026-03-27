import React, { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { apiRequest } from "../utils/api.js";
import { downloadCertificatePdf } from "../utils/certificatePdf.js";

const readPreviewValue = (row, keys) =>
  keys.find((key) => row[key] !== undefined && row[key] !== "") !== undefined
    ? row[keys.find((key) => row[key] !== undefined && row[key] !== "")]
    : "";

const formatPreviewDate = (value) => {
  if (!value) {
    return "";
  }

  const formatParts = (day, month, year) =>
    `${String(day).padStart(2, "0")}-${String(month).padStart(2, "0")}-${year}`;

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) {
      return String(value);
    }

    return formatParts(parsed.d, parsed.m, parsed.y);
  }

  if (/^\d{5}$/.test(String(value).trim())) {
    const serial = Number(String(value).trim());
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    excelEpoch.setUTCDate(excelEpoch.getUTCDate() + serial);
    return formatParts(
      excelEpoch.getUTCDate(),
      excelEpoch.getUTCMonth() + 1,
      excelEpoch.getUTCFullYear(),
    );
  }

  const parsedDate = new Date(value);
  if (!Number.isNaN(parsedDate.getTime())) {
    return formatParts(
      parsedDate.getDate(),
      parsedDate.getMonth() + 1,
      parsedDate.getFullYear(),
    );
  }

  return String(value);
};

export default function AdminDashboard() {
  const fileInputRef = useRef(null);
  const downloadHintTimerRef = useRef(null);
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalCertificates: 0,
    certificatesDownloaded: 0,
    recentUploadActivity: 0,
    registeredStudentUsers: 0,
  });
  const [students, setStudents] = useState([]);
  const [previewRows, setPreviewRows] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [activeStudentId, setActiveStudentId] = useState("");
  const [editingStudent, setEditingStudent] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", course: "", email: "" });
  const [downloadHintStudentId, setDownloadHintStudentId] = useState("");
  const [deleteConfirmStudentId, setDeleteConfirmStudentId] = useState("");
  const [previewCertificate, setPreviewCertificate] = useState(null);
  const [previewStudentName, setPreviewStudentName] = useState("");
  const [status, setStatus] = useState({ type: "idle", message: "" });

  const formatTableDate = (value) => {
    if (!value) {
      return "--";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "--";
    }

    return date.toLocaleDateString("en-IN");
  };

  const refreshDashboard = async () => {
    const [statsData, studentsData] = await Promise.all([
      apiRequest("/api/admin/stats"),
      apiRequest("/api/admin/students"),
    ]);

    setStats(statsData);
    setStudents(studentsData.students || []);
  };

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        await refreshDashboard();
      } catch (error) {
        setStatus({ type: "error", message: error.message });
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboard();

    return () => {
      if (downloadHintTimerRef.current) {
        clearTimeout(downloadHintTimerRef.current);
      }
    };
  }, []);

  const showDownloadHint = (studentId) => {
    setDownloadHintStudentId(studentId);

    if (downloadHintTimerRef.current) {
      clearTimeout(downloadHintTimerRef.current);
    }

    downloadHintTimerRef.current = setTimeout(() => {
      setDownloadHintStudentId("");
    }, 3000);
  };

  const handleFilePreview = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      const normalizedPreview = rows.map((row, index) => ({
        id: index + 1,
        name: readPreviewValue(row, [
          "Name",
          "Student Name",
          "name",
          "studentName",
        ]),
        course: readPreviewValue(row, ["Course", "Course Name", "course"]),
        email: readPreviewValue(row, ["Email", "Email Address", "email"]),
        startDate: formatPreviewDate(
          readPreviewValue(row, ["Start Date", "startDate", "StartDate"]),
        ),
        endDate: formatPreviewDate(
          readPreviewValue(row, [
            "Completion Date",
            "completionDate",
            "CompletionDate",
            "End Date",
            "endDate",
            "EndDate",
          ]),
        ),
      }));

      setSelectedFile(file);
      setPreviewRows(normalizedPreview);
      setStatus({
        type: "success",
        message: `${file.name} ready for import.`,
      });
    } catch {
      setStatus({
        type: "error",
        message: "Unable to read the selected Excel file.",
      });
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setStatus({ type: "error", message: "Choose an Excel file first." });
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    setIsUploading(true);
    setStatus({ type: "idle", message: "" });

    try {
      const data = await apiRequest("/api/upload", {
        method: "POST",
        body: formData,
      });

      setStudents(data.students || []);
      setPreviewRows([]);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      await refreshDashboard();
      setStatus({ type: "success", message: data.message });
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setIsUploading(false);
    }
  };

  const handleGenerateCertificate = async (studentId) => {
    setActiveStudentId(studentId);
    setStatus({ type: "idle", message: "" });

    try {
      const data = await apiRequest(`/api/certificates/generate/${studentId}`, {
        method: "POST",
      });

      setStudents((current) =>
        current.map((student) =>
          student._id === studentId
            ? {
                ...student,
                certificateId: data.certificate.certificateId,
                certificateUrl: data.certificate.certificateUrl,
              }
            : student,
        ),
      );
      await refreshDashboard();
      setStatus({ type: "success", message: data.message });
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setActiveStudentId("");
    }
  };

  const handlePreviewCertificate = async (student) => {
    if (!student.certificateId) {
      showDownloadHint(student._id);
      return;
    }

    setDownloadHintStudentId("");
    setActiveStudentId(student._id);
    setStatus({ type: "idle", message: "" });

    try {
      const certificate = await apiRequest(
        `/api/certificates/${student.certificateId}`,
      );
      setPreviewCertificate(certificate);
      setPreviewStudentName(student.name);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setActiveStudentId("");
    }
  };

  const closePreviewModal = () => {
    setPreviewCertificate(null);
    setPreviewStudentName("");
  };

  const handleDownloadFromPreview = async () => {
    if (!previewCertificate) {
      return;
    }

    try {
      await downloadCertificatePdf(previewCertificate);
      await apiRequest(
        `/api/certificates/${previewCertificate.certificateId}/downloaded`,
        {
          method: "POST",
        },
      );
      await refreshDashboard();
      setStatus({
        type: "success",
        message: `Certificate downloaded for ${previewStudentName}.`,
      });
      closePreviewModal();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  };

  const openEditModal = (student) => {
    setEditingStudent(student);
    setEditForm({
      name: student.name,
      course: student.course,
      email: student.email,
    });
    setStatus({ type: "idle", message: "" });
  };

  const closeEditModal = () => {
    setEditingStudent(null);
    setEditForm({ name: "", course: "", email: "" });
  };

  const handleEditChange = (event) => {
    setEditForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const handleUpdateStudent = async (event) => {
    event.preventDefault();

    if (!editingStudent) {
      return;
    }

    setActiveStudentId(editingStudent._id);
    setStatus({ type: "idle", message: "" });

    try {
      const data = await apiRequest(
        `/api/admin/students/${editingStudent._id}`,
        {
          method: "PUT",
          body: JSON.stringify(editForm),
        },
      );

      setStudents((current) =>
        current.map((student) =>
          student._id === editingStudent._id ? data.student : student,
        ),
      );
      await refreshDashboard();
      closeEditModal();
      setStatus({ type: "success", message: data.message });
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setActiveStudentId("");
    }
  };

  const handleDeleteStudent = async (student) => {
    setActiveStudentId(student._id);
    setStatus({ type: "idle", message: "" });

    try {
      const data = await apiRequest(`/api/admin/students/${student._id}`, {
        method: "DELETE",
      });

      setStudents((current) =>
        current.filter((item) => item._id !== student._id),
      );
      await refreshDashboard();
      setStatus({ type: "success", message: data.message });
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setActiveStudentId("");
    }
  };

  const openDeleteConfirm = (studentId) => {
    setDeleteConfirmStudentId(studentId);
    setDownloadHintStudentId("");
  };

  const closeDeleteConfirm = () => {
    setDeleteConfirmStudentId("");
  };

  const statCards = [
    ["Total Students", stats.totalStudents, "Imported student records"],
    ["Certificates", stats.totalCertificates, "Generated certificate files"],
    ["Downloads", stats.certificatesDownloaded, "PDF downloads tracked"],
    ["Recent Uploads", stats.recentUploadActivity, "Added in the last 7 days"],
  ];

  return (
    <section className="space-y-10">
      <div>
        <h1 className="font-display text-3xl">Admin Dashboard</h1>
        <p className="mt-2 text-ink-soft">
          Import students, generate certificates, and manage downloads from one
          modern control panel.
        </p>
      </div>

      {status.message ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            status.type === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {status.message}
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-4 md:gap-6 xl:grid-cols-4">
        {statCards.map(([label, value], index) => (
          <div
            key={label}
            className="group relative overflow-hidden rounded-[24px] border border-[#f1e2d2] bg-[linear-gradient(145deg,#fffdf9_0%,#fff7ef_100%)] p-4 shadow-[0_14px_30px_rgba(15,27,45,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(15,27,45,0.12)]"
          >
            <div
              className={`absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-80 blur-2xl ${
                [
                  "bg-[#ffd4c5]",
                  "bg-[#dbe7ff]",
                  "bg-[#c9f3e9]",
                  "bg-[#ffe0bf]",
                ][index]
              }`}
            />
            <div className="relative flex items-center justify-between gap-3">
              <div
                className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                  [
                    "bg-[#fff0e8] text-accent-dark",
                    "bg-[#edf3ff] text-[#3d66d9]",
                    "bg-[#e8faf5] text-[#008a6d]",
                    "bg-[#fff3e8] text-[#d86a3d]",
                  ][index]
                }`}
              >
                {label}
              </div>
              <div
                className={`h-3 w-3 rounded-full shadow-[0_0_0_6px_rgba(255,255,255,0.85)] ${
                  ["bg-accent", "bg-[#4a7bff]", "bg-mint", "bg-[#f7b267]"][
                    index
                  ]
                }`}
              />
            </div>
            <div className="relative mt-6 flex items-end justify-between gap-4">
              <div className="flex min-h-[74px] flex-col justify-end">
                <div className="text-[34px] font-semibold leading-none tracking-[-0.05em] text-ink">
                  {isLoading ? "--" : value}
                </div>
              </div>
              <div className="flex h-[64px] w-[72px] items-end">
                <div className="flex h-full w-full items-end gap-1.5">
                  {[18, 32, 24, 42].map((bar, barIndex) => (
                    <div
                      key={`${label}-${barIndex}`}
                      className={`w-full rounded-t-[999px] ${
                        [
                          [
                            "bg-[#ffc7b1]",
                            "bg-[#ffab8a]",
                            "bg-[#ff875d]",
                            "bg-[#ff6a3d]",
                          ],
                          [
                            "bg-[#d5e2ff]",
                            "bg-[#aec8ff]",
                            "bg-[#7ea8ff]",
                            "bg-[#4a7bff]",
                          ],
                          [
                            "bg-[#cdf6eb]",
                            "bg-[#9be7d2]",
                            "bg-[#52cfaa]",
                            "bg-[#00b894]",
                          ],
                          [
                            "bg-[#ffe2bd]",
                            "bg-[#ffc980]",
                            "bg-[#f7b267]",
                            "bg-[#f4845f]",
                          ],
                        ][index][barIndex]
                      }`}
                      style={{ height: `${bar}px` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr,0.9fr]">
        <div className="rounded-[24px] border border-dashed border-[#f0cdb0] bg-gradient-to-br from-white via-[#fff7ef] to-[#ffe9d6] px-5 py-5 sm:px-6 sm:py-6">
          <div className="max-w-xl">
            <div className="text-[13px] uppercase tracking-[0.2em] text-ink-soft">
              Bulk Upload
            </div>
            <h2 className="mt-2 font-display text-[1.35rem] leading-tight">
              Upload student records and manage imports instantly
            </h2>
            <p className="mt-2 text-[15px] leading-6 text-ink-soft">
              Upload your Excel sheet to preview student records before
              importing them into the dashboard.
            </p>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFilePreview}
              className="hidden"
              id="student-excel-upload"
            />
            <label
              htmlFor="student-excel-upload"
              className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-[18px] border border-[#f0d7c1] bg-white px-4 py-3 shadow-[0_8px_20px_rgba(15,27,45,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(15,27,45,0.08)]"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#fff1e8] text-base text-accent-dark">
                  +
                </div>
                <div>
                  <div className="text-[15px] font-semibold text-ink">
                    {selectedFile ? selectedFile.name : "Choose Excel file"}
                  </div>
                  <div className="text-[13px] text-ink-soft">
                    Upload `.xlsx` or `.xls` student sheets
                  </div>
                </div>
              </div>
              <span className="rounded-full bg-[#f9f4ec] px-3 py-1.5 text-[13px] font-semibold text-ink">
                Browse
              </span>
            </label>
            <button
              type="button"
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
              className="rounded-full bg-accent px-5 py-3 text-[15px] font-semibold text-white shadow-[0_12px_24px_rgba(255,106,61,0.3)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUploading ? "Importing..." : "Import Excel"}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2.5 text-[13px] text-ink-soft">
            <span className="rounded-full bg-white px-3 py-1.5">
              Student data
            </span>
            <span className="rounded-full bg-white px-3 py-1.5">
              Quick file preview
            </span>
            <span className="rounded-full bg-white px-3 py-1.5">
              Ready for certificate generation
            </span>
          </div>
        </div>

        <div className="rounded-[24px] border border-[#f1e2d2] bg-white p-4 shadow-[0_12px_24px_rgba(15,27,45,0.08)]">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs uppercase tracking-[0.2em] text-ink-soft">
              Import Preview
            </div>
            {previewRows.length ? (
              <div className="rounded-full bg-[#f9f4ec] px-3 py-1.5 text-xs font-semibold text-ink-soft">
                {previewRows.length} rows
              </div>
            ) : null}
          </div>
          <div className="mt-3 max-h-[320px] space-y-2 overflow-y-auto pr-1">
            {previewRows.length ? (
              previewRows.map((row) => (
                <div
                  key={`${row.email}-${row.id}`}
                  className="rounded-[14px] border border-[#f1e2d2] bg-gradient-to-br from-white to-[#fff8f1] p-2 shadow-[0_6px_14px_rgba(15,27,45,0.04)]"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-[#f3e7db] pb-1.5">
                    <div className="truncate pr-2 text-[11px] font-semibold text-ink">
                      {row.name || "Unnamed Student"}
                    </div>
                    <div className="shrink-0 rounded-full bg-[#fff1e8] px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-accent-dark">
                      Row {row.id}
                    </div>
                  </div>
                  <div className="mt-2 grid gap-1.5 text-xs text-ink-soft">
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="rounded-lg bg-white px-2 py-1.5">
                        <div className="text-[8px] font-semibold uppercase tracking-[0.12em] text-ink-soft/65">
                          Course
                        </div>
                        <div className="mt-0.5 truncate text-[11px] font-medium text-ink">
                          {row.course || "Not provided"}
                        </div>
                      </div>
                      <div className="rounded-lg bg-white px-2 py-1.5">
                        <div className="text-[8px] font-semibold uppercase tracking-[0.12em] text-ink-soft/65">
                          Email
                        </div>
                        <div className="mt-0.5 truncate text-[11px] font-medium text-ink">
                          {row.email || "Not provided"}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="rounded-lg bg-[#fff6ee] px-2 py-1.5">
                        <div className="text-[8px] font-semibold uppercase tracking-[0.12em] text-ink-soft/65">
                          Start Date
                        </div>
                        <div className="mt-0.5 text-[11px] font-medium text-ink">
                          {row.startDate || "Not provided"}
                        </div>
                      </div>
                      <div className="rounded-lg bg-[#fff6ee] px-2 py-1.5">
                        <div className="text-[8px] font-semibold uppercase tracking-[0.12em] text-ink-soft/65">
                          End Date
                        </div>
                        <div className="mt-0.5 text-[11px] font-medium text-ink">
                          {row.endDate || "Not provided"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-[#f0d7c1] bg-[#f9f4ec] p-4 text-sm text-ink-soft">
                Upload a file to preview all imported rows before import.
              </div>
            )}
          </div>
        </div>
      </section>

      <section>
        <div className="rounded-3xl border border-[#f1e2d2] bg-white p-6 shadow-[0_12px_24px_rgba(15,27,45,0.08)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-ink-soft">
                Student Data
              </div>
              <h2 className="mt-3 text-xl font-semibold">
                Imported students and certificate actions
              </h2>
            </div>
            <div className="rounded-full bg-[#f9f4ec] px-4 py-2 text-sm text-ink-soft">
              {students.length} records
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-3xl border border-[#f1e2d2]">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#f9f4ec] text-ink-soft">
                  <tr>
                    <th className="px-4 py-3 font-semibold">ID</th>
                    <th className="px-4 py-3 font-semibold">Student Name</th>
                    <th className="px-4 py-3 font-semibold">Course</th>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">
                      Generate Certificate
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      Preview Certificate
                    </th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f3e5d7] bg-white">
                  {students.length ? (
                    students.map((student, index) => (
                      <tr key={student._id} className="align-top">
                        <td className="px-4 py-4 font-mono text-xs text-ink-soft">
                          {student.certificateId ||
                            `STD-${String(index + 1).padStart(3, "0")}`}
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-semibold text-ink">
                            {student.name}
                          </div>
                          <div className="mt-1 text-xs text-ink-soft">
                            {student.email}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-ink-soft">
                          {student.course}
                        </td>
                        <td className="px-4 py-4 text-ink-soft">
                          {formatTableDate(student.createdAt)}
                        </td>
                        <td className="px-4 py-4">
                          <button
                            type="button"
                            onClick={() =>
                              handleGenerateCertificate(student._id)
                            }
                            disabled={activeStudentId === student._id}
                            className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {activeStudentId === student._id
                              ? "Generating..."
                              : student.certificateId
                                ? "Regenerate"
                                : "Generate"}
                          </button>
                        </td>
                        <td className="px-4 py-4">
                          <div className="relative space-y-2">
                            <button
                              type="button"
                              onClick={() => handlePreviewCertificate(student)}
                              disabled={activeStudentId === student._id}
                              className="rounded-full border border-[#f0d7c1] bg-white px-4 py-2 text-xs font-semibold text-ink transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {activeStudentId === student._id
                                ? "Opening..."
                                : "Preview"}
                            </button>
                            {downloadHintStudentId === student._id ? (
                              <div className="absolute left-0 top-full z-20 mt-2 w-[220px] rounded-2xl border border-[#f1d7c7] bg-[#fff6f0] px-3 py-2 text-xs leading-5 text-[#c2552e] shadow-[0_10px_24px_rgba(15,27,45,0.12)]">
                                Please generate the certificate first.
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="relative flex flex-nowrap items-center gap-2 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => openEditModal(student)}
                              disabled={activeStudentId === student._id}
                              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#d9e5ff] bg-[#edf3ff] text-[#315ccf] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                              aria-label={`Edit ${student.name}`}
                              title="Edit"
                            >
                              ✎
                            </button>
                            <button
                              type="button"
                              onClick={() => openDeleteConfirm(student._id)}
                              disabled={activeStudentId === student._id}
                              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#ffd8d1] bg-[#fff1ee] text-[#d54d33] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                              aria-label={`Delete ${student.name}`}
                              title="Delete"
                            >
                              ×
                            </button>
                            {deleteConfirmStudentId === student._id ? (
                              <div className="absolute right-0 top-full z-20 mt-2 min-w-[270px] max-w-xs rounded-2xl border border-[#f1d7c7] bg-[#fff6f0] p-3 text-xs text-[#c2552e] shadow-[0_10px_24px_rgba(15,27,45,0.12)]">
                                <div className="font-semibold text-[#b64923]">
                                  Delete this student?
                                </div>
                                <div className="mt-1 leading-5 break-words">
                                  This will also remove the linked certificate
                                  record.
                                </div>
                                <div className="mt-3 flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={closeDeleteConfirm}
                                    className="rounded-full border border-[#f0cdb0] bg-white px-3 py-1.5 text-[11px] font-semibold text-ink"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      closeDeleteConfirm();
                                      handleDeleteStudent(student);
                                    }}
                                    className="rounded-full bg-[#d54d33] px-3 py-1.5 text-[11px] font-semibold text-white"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan="6"
                        className="px-4 py-8 text-center text-ink-soft"
                      >
                        No students imported yet. Upload an Excel sheet to
                        populate the table.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {editingStudent ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#0f1b2d]/35 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-[#f1e2d2] bg-white p-6 shadow-[0_24px_80px_rgba(15,27,45,0.18)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-ink-soft">
                  Edit Student
                </div>
                <h3 className="mt-2 font-display text-2xl">
                  Update student details
                </h3>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-full border border-[#f0d7c1] px-3 py-1.5 text-xs font-semibold text-ink"
              >
                Close
              </button>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleUpdateStudent}>
              <div>
                <label className="text-sm font-semibold text-ink">
                  Student Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={editForm.name}
                  onChange={handleEditChange}
                  className="mt-2 w-full rounded-2xl border border-[#ead8c8] bg-[#fffdfa] px-4 py-3 text-sm text-ink outline-none"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-ink">Course</label>
                <input
                  type="text"
                  name="course"
                  value={editForm.course}
                  onChange={handleEditChange}
                  className="mt-2 w-full rounded-2xl border border-[#ead8c8] bg-[#fffdfa] px-4 py-3 text-sm text-ink outline-none"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-ink">Email</label>
                <input
                  type="email"
                  name="email"
                  value={editForm.email}
                  onChange={handleEditChange}
                  className="mt-2 w-full rounded-2xl border border-[#ead8c8] bg-[#fffdfa] px-4 py-3 text-sm text-ink outline-none"
                />
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="submit"
                  disabled={activeStudentId === editingStudent._id}
                  className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {activeStudentId === editingStudent._id
                    ? "Saving..."
                    : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="rounded-full border border-[#f0d7c1] bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:-translate-y-0.5"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {previewCertificate ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#0f1b2d]/35 px-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-3xl border border-[#f1e2d2] bg-white p-6 shadow-[0_24px_80px_rgba(15,27,45,0.18)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-ink-soft">
                  Certificate Preview
                </div>
                <h3 className="mt-2 font-display text-2xl text-ink">
                  {previewCertificate.studentName}
                </h3>
              </div>
              <button
                type="button"
                onClick={closePreviewModal}
                className="rounded-full border border-[#f0d7c1] px-3 py-1.5 text-xs font-semibold text-ink"
              >
                Close
              </button>
            </div>

            <div className="mt-5 rounded-3xl border border-[#f4dec7] bg-gradient-to-br from-[#fdf6eb] to-white p-7">
              <div className="text-center">
                <div className="font-display text-3xl text-ink">
                  Certificate of Achievement
                </div>
                <div className="mt-3 text-sm text-ink-soft">
                  This certificate is proudly presented to
                </div>
                <div className="mt-4 font-display text-2xl text-ink">
                  {previewCertificate.studentName}
                </div>
                <div className="mt-3 text-sm text-ink-soft">
                  for successfully completing the{" "}
                  <span className="font-semibold text-ink">
                    {previewCertificate.course}
                  </span>{" "}
                  program.
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ["Certificate ID", previewCertificate.certificateId],
                  [
                    "Start Date",
                    previewCertificate.startDate || "Not provided",
                  ],
                  ["End Date", previewCertificate.endDate || "Not provided"],
                  ["Duration", previewCertificate.duration || "Not available"],
                  [
                    "Issue Date",
                    new Date(previewCertificate.issuedAt).toLocaleDateString(
                      "en-IN",
                    ),
                  ],
                  ["Email", previewCertificate.email],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl bg-white p-4">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-ink-soft">
                      {label}
                    </div>
                    <div className="mt-2 text-sm font-semibold text-ink">
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={closePreviewModal}
                className="rounded-full border border-[#f0d7c1] bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:-translate-y-0.5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDownloadFromPreview}
                className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(255,106,61,0.28)] transition hover:-translate-y-0.5"
              >
                Download PDF
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
