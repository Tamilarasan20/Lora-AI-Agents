import { Link } from "react-router-dom";
import styles from "./NotFound.module.css";

export default function NotFound() {
  return (
    <div className={styles.page}>
      <h1 className={styles.code}>404</h1>
      <p className={styles.msg}>Page not found.</p>
      <Link to="/dashboard" className={styles.back}>← Back to dashboard</Link>
    </div>
  );
}
