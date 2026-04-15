import { redirect } from "next/navigation";

/**
 * Root page — redirect to /new which creates a conversation and redirects.
 */
export default function Home() {
  redirect("/new");
}
