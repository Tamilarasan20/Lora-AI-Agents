import { Outlet, NavLink } from "react-router-dom";
import styles from "./Layout.module.css";

const NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/agents", label: "Agents" },
  { to: "/models", label: "Models" },
];

export default function Layout() {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <span className={styles.logoMark}>L</span>
          <span className={styles.logoText}>Loraloop</span>
        </div>
        <nav className={styles.nav}>
          {NAV.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.active : ""}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
