import { createFileRoute } from "@tanstack/react-router";
import FruitGame from "../components/FruitGame";

export const Route = createFileRoute("/")({
    head: () => ({
        meta: [
            { title: "Air Fruit Ninja — Gesture Controlled" },
            {
                name: "description",
                content:
                    "Slice fruit in the air with your index finger. A webcam-powered, hand-tracked browser game.",
            },
            { property: "og:title", content: "Air Fruit Ninja — Gesture Controlled" },
            {
                property: "og:description",
                content: "Webcam-powered hand-tracked Fruit Ninja in your browser.",
            },
        ],
    }),
    component: Index,
});

function Index() {
    return <FruitGame />;
}
