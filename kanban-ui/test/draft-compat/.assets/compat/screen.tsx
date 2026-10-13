import "./theme.css";
import Link from "next/link";
import clsx from "clsx";
import { FiCheck } from "react-icons/fi";
import Badge from "./parts/badge";

export default function Screen() {
  return (
    <main className={clsx("p-6", "bg-brand")}>
      <Link href="/plans" prefetch={false} className="text-white underline">
        Plans
      </Link>
      <Badge label="Ready">
        <FiCheck />
      </Badge>
    </main>
  );
}
