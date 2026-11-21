import Link from "next/link";
import { TacticsBoard } from "@/components/TacticsBoard";

export default function Home() {
  return (
    <>
      <header className="top">
        <div className="top-inner">
          <Link href="/" className="brand" aria-label="Tactora home">
            <span className="brand-mark" aria-hidden="true">
              <span />
            </span>
            Tactora
          </Link>
          <p className="top-by">
            A{" "}
            <a href="https://shubham-portfolio-mu-puce.vercel.app" target="_blank" rel="noopener noreferrer">
              ShubhTech<span className="in">IN</span>
            </a>{" "}
            project
          </p>
        </div>
      </header>

      <main className="wrap">
        <TacticsBoard />
      </main>

      <footer className="foot wrap">
        <p>Boards save on your device. Share links carry every step, so nothing is stored on a server.</p>
        <p>
          Also from ShubhTechIN:{" "}
          <a href="https://dropzuu.vercel.app" target="_blank" rel="noopener noreferrer">
            Dropzuu
          </a>
        </p>
      </footer>
    </>
  );
}
