/** Art archive: every one of the 103 original images, byte-identical, with a
 * record of whether World 1 draws it on screen or keeps it in the archive.
 * The itch.io build withholds the unverified third-party player/ pack: its
 * packaged manifest marks those entries `packaged: false`, and they show as a
 * note card instead of an image request that would 404. */
import { installCss } from "./pixel-ui.mjs";
installCss(); // the pixel sprites the page's buttons and checker use
const files = await fetch("./art-manifest.json").then((response) => {
  if (!response.ok) throw new Error("Art manifest unavailable");
  return response.json();
});
const container = document.querySelector("#art");
const shipped = (entry) => entry.packaged !== false;
const category = ({ file }) =>
  file.startsWith("tiles/") ? "tiles" : file.startsWith("player/") ? "player" : /rubik|inimigo|cofre|cone/.test(file) ? "rubik" : "story";
function card(entry) {
  const figure = document.createElement("figure");
  figure.className = "art-card " + entry.use + (shipped(entry) ? "" : " withheld");
  const caption = document.createElement("figcaption");
  const name = document.createElement("b");
  name.textContent = entry.file;
  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = !shipped(entry) ? "not in this build" : entry.use === "screen" ? "on screen" : "archive";
  const note = document.createElement("small");
  note.textContent = shipped(entry) ? entry.where : `Left out of this build: ${entry.withheld}.`;
  caption.append(name, badge, note);
  if (shipped(entry)) {
    const link = document.createElement("a");
    link.href = "./assets/" + entry.file;
    const image = document.createElement("img");
    image.src = link.href;
    image.alt = entry.file;
    image.loading = "lazy";
    link.append(image);
    figure.append(link);
  } else {
    const blank = document.createElement("div");
    blank.className = "art-blank";
    blank.setAttribute("aria-hidden", "true");
    figure.append(blank);
  }
  figure.append(caption);
  return figure;
}
function draw(filter) {
  container.replaceChildren();
  const shown = files.filter((entry) => filter === "all" || filter === entry.use || category(entry) === filter);
  for (const entry of shown) container.append(card(entry));
  const onScreen = files.filter((entry) => entry.use === "screen").length,
    left = files.filter((entry) => !shipped(entry)).length;
  document.querySelector("#count").textContent =
    `${shown.length} / ${files.length} original images - ${onScreen} drawn on screen in World 1` + (left ? ` - ${left} not in this build` : "");
  document.querySelectorAll("[data-filter]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.filter === filter)));
}
const withheldNote = document.querySelector("#withheld-note");
if (withheldNote && files.some((entry) => !shipped(entry))) withheldNote.hidden = false;
document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => draw(button.dataset.filter)));
draw("all");
