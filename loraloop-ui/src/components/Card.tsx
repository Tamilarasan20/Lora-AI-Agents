import type { ReactNode } from "react";
import styles from "./Card.module.css";

interface Props {
  title?: string;
  children: ReactNode;
  className?: string;
}

export default function Card({ title, children, className }: Props) {
  return (
    <div className={`${styles.card} ${className ?? ""}`}>
      {title && <h3 className={styles.title}>{title}</h3>}
      {children}
    </div>
  );
}
