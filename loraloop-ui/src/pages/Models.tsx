import { useEffect } from "react";
import { llmApi } from "@/api/llm";
import { useApi } from "@/hooks/useApi";
import Spinner from "@/components/Spinner";
import styles from "./Models.module.css";

const TIER_ORDER = ["cheap", "balanced", "premium"];

export default function Models() {
  const { data, loading, error, execute } = useApi(llmApi.models);

  useEffect(() => {
    execute();
  }, [execute]);

  const byTier = data
    ? TIER_ORDER.map((tier) => ({
        tier,
        models: data.models.filter((m) => m.tier === tier),
      }))
    : [];

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>LLM Models</h1>
      <p className={styles.sub}>All models registered in the smart router, grouped by cost tier.</p>

      {loading && <Spinner />}
      {error && <p className={styles.error}>{error}</p>}

      {byTier.map(({ tier, models }) => (
        <section key={tier} className={styles.section}>
          <h2 className={`${styles.tier} ${styles[tier]}`}>{tier}</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Provider</th>
                  <th>Context</th>
                  <th>In / 1M</th>
                  <th>Out / 1M</th>
                  <th>Quality</th>
                  <th>Capabilities</th>
                </tr>
              </thead>
              <tbody>
                {models.map((m) => (
                  <tr key={m.id}>
                    <td className={styles.modelId}>{m.id}</td>
                    <td>{m.provider}</td>
                    <td>{(m.context_window / 1000).toFixed(0)}k</td>
                    <td>${m.cost_input_per_1m_usd.toFixed(2)}</td>
                    <td>${m.cost_output_per_1m_usd.toFixed(2)}</td>
                    <td>{m.quality_score}/10</td>
                    <td className={styles.caps}>
                      {m.capabilities.map((c) => (
                        <span key={c} className={styles.cap}>{c}</span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
