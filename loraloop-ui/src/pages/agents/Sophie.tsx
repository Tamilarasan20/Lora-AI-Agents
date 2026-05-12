import { useState, useCallback } from "react";
import { agentsApi, type SophieRequest } from "@/api/agents";
import { useApi } from "@/hooks/useApi";
import Card from "@/components/Card";
import Spinner from "@/components/Spinner";
import styles from "./Sophie.module.css";

export default function SophiePage() {
  const [form, setForm] = useState<SophieRequest>({
    topic: "",
    brand_name: "",
    brand_voice: "",
    platform: "blog",
    target_keywords: [],
    audience: "",
  });
  const [keywordsRaw, setKeywordsRaw] = useState("");

  const fn = useCallback(
    (req: SophieRequest) => agentsApi.sophie(req),
    []
  );
  const { data, loading, error, execute } = useApi(fn);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    execute({
      ...form,
      target_keywords: keywordsRaw
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
    });
  }

  const brief = data?.brief as Record<string, unknown> | undefined;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.avatar}>S</div>
        <div>
          <h1 className={styles.name}>Sophie</h1>
          <p className={styles.role}>SEO + GEO Manager</p>
        </div>
      </div>

      <div className={styles.body}>
        <Card title="Brief Request" className={styles.formCard}>
          <form onSubmit={handleSubmit} className={styles.form}>
            <label className={styles.field}>
              <span>Topic *</span>
              <input
                required
                value={form.topic}
                onChange={(e) => setForm({ ...form, topic: e.target.value })}
                placeholder="e.g. How to grow on TikTok in 2025"
              />
            </label>
            <label className={styles.field}>
              <span>Brand name *</span>
              <input
                required
                value={form.brand_name}
                onChange={(e) => setForm({ ...form, brand_name: e.target.value })}
                placeholder="Acme Inc"
              />
            </label>
            <label className={styles.field}>
              <span>Brand voice</span>
              <input
                value={form.brand_voice}
                onChange={(e) => setForm({ ...form, brand_voice: e.target.value })}
                placeholder="Professional but approachable"
              />
            </label>
            <label className={styles.field}>
              <span>Platform</span>
              <select
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value })}
              >
                <option value="blog">Blog</option>
                <option value="linkedin">LinkedIn</option>
                <option value="landing-page">Landing page</option>
                <option value="youtube">YouTube</option>
              </select>
            </label>
            <label className={styles.field}>
              <span>Seed keywords (comma-separated)</span>
              <input
                value={keywordsRaw}
                onChange={(e) => setKeywordsRaw(e.target.value)}
                placeholder="tiktok growth, social media strategy"
              />
            </label>
            <label className={styles.field}>
              <span>Target audience</span>
              <input
                value={form.audience}
                onChange={(e) => setForm({ ...form, audience: e.target.value })}
                placeholder="SaaS founders, 25-45"
              />
            </label>
            <button type="submit" className={styles.btn} disabled={loading}>
              {loading ? <Spinner size={16} /> : "Generate brief"}
            </button>
          </form>
        </Card>

        <div className={styles.results}>
          {error && <p className={styles.error}>{error}</p>}
          {data && brief && (
            <>
              <Card title="SEO + GEO Brief">
                <pre className={styles.json}>
                  {JSON.stringify(brief, null, 2)}
                </pre>
              </Card>
              <Card title="Router telemetry" className={styles.telemetry}>
                <div className={styles.telRow}>
                  <span>Model</span>
                  <strong>{data.router.model}</strong>
                </div>
                <div className={styles.telRow}>
                  <span>Provider</span>
                  <strong>{data.router.provider}</strong>
                </div>
                <div className={styles.telRow}>
                  <span>Cost</span>
                  <strong>${data.router.cost_usd.toFixed(5)}</strong>
                </div>
                <div className={styles.telRow}>
                  <span>Latency</span>
                  <strong>{data.router.latency_ms} ms</strong>
                </div>
                {data.router.fallback_path.length > 1 && (
                  <div className={styles.telRow}>
                    <span>Fallback path</span>
                    <strong>{data.router.fallback_path.join(" → ")}</strong>
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
