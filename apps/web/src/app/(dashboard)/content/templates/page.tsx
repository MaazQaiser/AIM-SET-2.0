import { redirect } from "next/navigation";

export default function ContentTemplatesPage() {
  redirect("/content?tab=templates");
}
