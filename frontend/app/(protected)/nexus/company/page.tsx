import { redirect } from "next/navigation";

export default function MyProtectedSettingsCompany() {
  redirect("/companies");
}