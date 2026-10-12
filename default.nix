{ pkgs ? import <nixpkgs> { } }:

pkgs.stdenv.mkDerivation {
  pname = "zeno-vaked-dev";
  version = "1.2.0";

  src = ./.;

  nativeBuildInputs = [
    pkgs.nodejs_20
    pkgs.python311
    pkgs.openssl
  ];

  buildPhase = ''
    runHook preBuild
    python3 apps/wallet/generate_pass.py
    node deploy/build.mjs
    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall
    mkdir -p $out/share/zeno $out/bin
    cp -r index.html style.css app.js sound.js zeno-engine.js manifest.webmanifest \
          favicon.svg og.svg robots.txt sitemap.xml beacon.json spec apps deploy $out/share/zeno/

    cat << EOF > $out/bin/zeno-preview
#!/usr/bin/env bash
exec ${pkgs.python311}/bin/python3 -m http.server 8089 --directory "$out/share/zeno"
EOF
    chmod +x $out/bin/zeno-preview
    runHook postInstall
  '';

  meta = with pkgs.lib; {
    description = "ZENO (銭・禅・善) — Japanese Proof-of-Contribution Sovereign Neo-Bank";
    homepage = "https://zeno.vaked.dev/";
    license = licenses.mit;
    platforms = platforms.all;
  };
}
