/** Art archive: every one of the 103 original images, byte-identical, with a
 * record of whether Stage 1 draws it on screen or keeps it in the archive. */
const files = await fetch("./art-manifest.json").then((response) => {
  if (!response.ok) throw new Error("Art manifest unavailable");
  return response.json();
});
const container = document.querySelector("#art");
const category = ({ file }) =>
  file.startsWith("tiles/") ? "tiles" : file.startsWith("player/") ? "player" : /rubik|inimigo|cofre|cone/.test(file) ? "rubik" : "story";
function draw(filter) {
  container.replaceChildren();
  const shown = files.filter((entry) => filter === "all" || filter === entry.use || category(entry) === filter);
  for (const entry of shown) {
    const figure = document.createElement("figure");
    figure.className = "art-card " + entry.use;
    const link = document.createElement("a");
    link.href = "./assets/" + entry.file;
    const image = document.createElement("img");
    image.src = link.href;
    image.alt = entry.file;
    image.loading = "lazy";
    const caption = document.createElement("figcaption");
    const name = document.createElement("b");
    name.textContent = entry.file;
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = entry.use === "screen" ? "on screen" : "archive";
    const note = document.createElement("small");
    note.textContent = entry.where;
    caption.append(name, badge, note);
    link.append(image);
    figure.append(link, caption);
    container.append(figure);
  }
  const onScreen = files.filter((entry) => entry.use === "screen").length;
  document.querySelector("#count").textContent = `${shown.length} / ${files.length} original images - ${onScreen} drawn on screen in Stage 1`;
  document.querySelectorAll("[data-filter]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.filter === filter)));
}
document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => draw(button.dataset.filter)));
draw("all");
