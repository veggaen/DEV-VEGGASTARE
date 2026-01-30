import { redirect } from "next/navigation";

export default function MyProtectedSettingsCompanyCreationPage() {
  redirect("/companies/create");
}