import catalog from "@/lib/company-playlists.json";

export type CompanyPlaylistProblem = {
  slug: string;
  title: string;
  topic: string;
  difficulty: "Easy" | "Medium" | "Hard" | null;
};

export type CompanyPlaylist = {
  id: string;
  name: string;
  description: string;
  problems: CompanyPlaylistProblem[];
};

export const companyPlaylists = catalog as CompanyPlaylist[];
