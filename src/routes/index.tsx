import { createFileRoute } from "@tanstack/react-router";
import { AtlasApp } from "@/components/atlas/atlas-app";

export const Route = createFileRoute("/")({ component: AtlasApp });
