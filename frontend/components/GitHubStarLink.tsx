import { Github } from 'lucide-react';

export default function GitHubStarLink() {

  return (
    <a
      href="https://github.com/sahu-adarsh/intervyu"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3.5 py-1.5 text-sm text-slate-600 transition hover:border-slate-400 hover:text-slate-950"
    >
      <Github className="h-4 w-4" />
      <span className="font-medium">Star</span>
    </a>
  );
}
