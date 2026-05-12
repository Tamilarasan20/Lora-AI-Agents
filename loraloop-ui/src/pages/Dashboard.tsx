import { useEffect } from "react";
import { Link } from "react-router-dom";
import { llmApi } from "@/api/llm";
import { useApi } from "@/hooks/useApi";
import Card from "@/components/Card";
import Spinner from "@/components/Spinner";
import styles from "./Dashboard.module.css";

const AGENTS = [
  { id: "lora", name: "Lora", role: "Brand Strategist", path: null },
  { id: "sophie", name: "Sophie", role: "SEO + GEO Manager", path: "/agents/sophie" },
  { id: "clara", name: "Clara", role: "Content Writer", path: null },
  { id: "steve", name: "Steve", role: "Social Media Manager", path: null },
  { id: "theo", name: "Theo", role: "Video Producer", path: null },
  { id: "elena", name: "Elena", role: "Ads Manager", path: null },
  { id: "nick", name: "Nick", role: "Performance Analyst", path: null },
  { id: "sarah", name: "Sarah", role: "Email Marketer", path: null },
  { id: "sam", name: "Sam", role: "Scheduler", path: null },
];

export default function Dashboard() {
  const { data, loading, error, execute } = useApi(llmApi.models);

  useEffect(() => {
    execute();
  }, [execute]);

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Loraloop Platform</h1>
      <p className={styles.sub}>Autonomous AI marketing — 9 specialist agents, one smart LLM router.</p>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Agents</h2>
        <div className={styles.agentGrid}>
          {AGENTS.map((a) => (
            <div key={a.id} className={styles.agentCard}>
              <div className={styles.agentAvatar}>{a.name[0]}</div>
              <div>
                <div className={styles.agentName}>{a.name}</div>
                <div className={styles.agentRole}>{a.role}</div>
              </div>
              {a.path && (
                <Link to={a.path} className={styles.agentLink}>
                  Open →
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>LLM Router</h2>
        {loading && <Spinner />}
        {error && <p className={styles.error}>{error}</p>}
        {data && (
          <Card>
            <p className={styles.statLine}>
              <strong>{data.count}</strong> models registered across{" "}
              <strong>
                {new Set(data.models.map((m) => m.provider)).size}
              </strong>{" "}
              providers
            </p>
            <div className={styles.tierBadges}>
              {["cheap", "balanced", "premium"].map((t) => (
                <span key={t} className={`${styles.badge} ${styles[t]}`}>
                  {t}: {data.models.filter((m) => m.tier === t).length} models
                </span>
              ))}
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}
