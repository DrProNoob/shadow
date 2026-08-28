import { notFound } from "next/navigation";
import { ToolLab } from "@/components/tool-lab/tool-lab";

export default function ToolLabPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ToolLab />;
}
