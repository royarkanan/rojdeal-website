import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest { return { name: "RojDeal", short_name: "RojDeal", description: "RojDeal classifieds marketplace", start_url: "/ar", display: "standalone", background_color: "#FAF7F2", theme_color: "#EF4433", icons: [{ src: "/brand/rojdeal_mark.png", sizes: "512x512", type: "image/png" }] }; }
