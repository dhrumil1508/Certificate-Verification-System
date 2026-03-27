import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import { apiRequest } from "../utils/api.js";

const EMPTY_CERTIFICATE = {
  studentName: "Unknown Student",
  course: "Pending Verification",
  startDate: "--",
  endDate: "--",
  certificateId: "UNKNOWN",
};

export default function Verify() {
  const [certificateId, setCertificateId] = useState("");
  const [resultId, setResultId] = useState("UNKNOWN");
  const [status, setStatus] = useState("Ready");
  const [activeCertificate, setActiveCertificate] = useState(EMPTY_CERTIFICATE);
  const [loading, setLoading] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmed = certificateId.trim().toUpperCase();

    if (!trimmed) {
      setResultId("UNKNOWN");
      setActiveCertificate(EMPTY_CERTIFICATE);
      setStatus("Not Found");
      return;
    }

    setLoading(true);
    setResultId(trimmed);

    try {
      const data = await apiRequest(`/api/certificates/${trimmed}`);
      setActiveCertificate({
        studentName: data.studentName || "Unknown Student",
        course: data.course || "Not provided",
        startDate: data.startDate || "--",
        endDate: data.endDate || "--",
        certificateId: data.certificateId || trimmed,
      });
      setStatus("Verified");
    } catch {
      setActiveCertificate({
        ...EMPTY_CERTIFICATE,
        certificateId: trimmed,
      });
      setStatus("Not Found");
    } finally {
      setLoading(false);
    }
  };

  const isVerified = status === "Verified";

  useEffect(() => {
    const buildQrCode = async () => {
      if (!isVerified || !resultId || resultId === "UNKNOWN") {
        setQrCodeDataUrl("");
        return;
      }

      const appOrigin = import.meta.env.VITE_APP_URL || window.location.origin;
      const verifyUrl = `${appOrigin}/certificate/${resultId}`;

      try {
        const dataUrl = await QRCode.toDataURL(verifyUrl, {
          margin: 1,
          width: 160,
          color: {
            dark: "#ffffff",
            light: "#0f1b2d",
          },
        });
        setQrCodeDataUrl(dataUrl);
      } catch {
        setQrCodeDataUrl("");
      }
    };

    buildQrCode();
  }, [isVerified, resultId]);

  return (
    <section className="rounded-[24px] bg-white p-5 shadow-hero sm:rounded-[32px] sm:p-8">
      <div>
        <h1 className="font-display text-[2rem] leading-tight sm:text-3xl">
          Student Certificate Verification
        </h1>
        <p className="mt-2 text-sm leading-6 text-ink-soft sm:text-base">
          Enter your Certificate ID to view and download the certificate
          instantly.
        </p>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2 md:gap-6">
        <form
          className="flex flex-col gap-3 rounded-2xl border border-[#f0d7c1] bg-[#f9f4ec] p-4 sm:p-6"
          onSubmit={handleSubmit}
        >
          <label className="font-semibold" htmlFor="certificate-id">
            Certificate ID
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id="certificate-id"
              name="certificate-id"
              type="text"
              placeholder="e.g., CERT-2026-61B551"
              autoComplete="off"
              value={certificateId}
              onChange={(event) => setCertificateId(event.target.value)}
              required
              className="w-full min-w-0 flex-1 rounded-xl border border-[#e8d4c2] bg-white px-4 py-3"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(255,106,61,0.3)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {loading ? "Searching..." : "Search"}
            </button>
          </div>
          <div className="text-xs leading-5 text-ink-soft">
            Tip: Your certificate ID is in the internship confirmation mail.
          </div>
        </form>
        <div className="flex flex-col gap-4 rounded-2xl bg-ink p-4 text-white sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="font-semibold">Certificate Snapshot</div>
            <div className="w-fit rounded-full bg-[#1f2f47] px-3 py-1 text-xs text-[#c7d4ef]">
              {loading ? "Searching" : status}
            </div>
          </div>
          <div className="space-y-3">
            {[
              ["Student", activeCertificate.studentName],
              ["Course", activeCertificate.course],
              [
                "Duration",
                `${activeCertificate.startDate} - ${activeCertificate.endDate}`,
              ],
              ["Certificate ID", resultId],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex flex-col gap-1 border-b border-white/10 pb-2 last:border-none sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="text-sm text-[#c7d4ef]">{label}</span>
                <strong
                  className={`text-sm sm:text-base ${
                    label === "Certificate ID" ? "font-mono" : ""
                  }`}
                >
                  {value}
                </strong>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <button
              className="w-full rounded-full border border-[#f0d7c1] bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              type="button"
              disabled={!isVerified}
              onClick={() => navigate(`/certificate/${resultId}`)}
            >
              View Certificate
            </button>
            <button
              className="w-full rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(255,106,61,0.3)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              type="button"
              disabled={!isVerified}
              onClick={() => navigate(`/certificate/${resultId}`)}
            >
              Download
            </button>
          </div>
          {isVerified ? (
            <div className="mt-2 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-[#c7d4ef]">
                Scan to verify
              </div>
              <div className="mt-3 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                {qrCodeDataUrl ? (
                  <img
                    src={qrCodeDataUrl}
                    alt={`QR code for certificate ${resultId}`}
                    className="h-28 w-28 rounded-2xl bg-white p-2 sm:h-24 sm:w-24"
                  />
                ) : (
                  <div className="flex h-28 w-28 items-center justify-center rounded-2xl bg-white/10 text-xs text-[#c7d4ef] sm:h-24 sm:w-24">
                    Generating...
                  </div>
                )}
                <div className="min-w-0 text-sm text-[#e8eefb]">
                  <div className="font-semibold">Open the verification page</div>
                  <div className="mt-1 break-all text-xs leading-5 text-[#c7d4ef]">
                    {`${import.meta.env.VITE_APP_URL || window.location.origin}/certificate/${resultId}`}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
