import { redirect } from "next/navigation";

export default function LegacyForYouPage() {
  redirect("/playlists");
}
