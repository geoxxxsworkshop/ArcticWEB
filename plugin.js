// plugin.js - Tämä koodi ujutetaan jokaiselle verkkosivulle taustalla
console.log("❄️ ArcticWEB Plugin aktivoitu tällä sivulla!");

// Esimerkki plugin-toiminnosta: Luodaan sivun oikeaan yläkulmaan pieni ArcticWEB-merkki
const badge = document.createElement("div");
badge.style.position = "fixed";
badge.style.top = "10px";
badge.style.right = "10px";
badge.style.background = "#131c24";
badge.style.color = "#e3edf7";
badge.style.padding = "5px 10px";
badge.style.borderRadius = "4px";
badge.style.zIndex = "999999";
badge.style.fontSize = "12px";
badge.style.fontFamily = "sans-serif";
badge.style.border = "1px solid #2c4c5e";
badge.innerText = "🏔️ ArcticWEB Protected";

document.body.appendChild(badge);
