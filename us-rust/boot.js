import init from "/us-rust/zeno_leptos.js";

const statusEl = document.getElementById("rust-boot-status");

init({ module_or_path: "/us-rust/zeno_leptos_bg.wasm" })
  .then(() => {
    if (statusEl) statusEl.remove();
  })
  .catch((err) => {
    if (statusEl) {
      statusEl.textContent = `Rust Leptos WASM boot error: ${err && err.message ? err.message : String(err)}`;
    }
  });
