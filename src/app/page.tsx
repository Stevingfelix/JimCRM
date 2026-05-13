import { redirect } from "next/navigation";

export default function Home() {
  // Quote builder lands Day 3; until then send users to Parts.
  redirect("/parts");
}
