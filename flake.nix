{
  description = "ZENO (銭・禅・善) — Japanese Proof-of-Contribution Sovereign Neo-Bank Flake";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
  };

  outputs = inputs@{ self, nixpkgs, flake-parts, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      systems = [ "x86_64-linux" "aarch64-linux" "aarch64-darwin" "x86_64-darwin" ];

      perSystem = { config, self', inputs', pkgs, system, ... }: {
        packages = rec {
          default = zeno-web;
          zeno-web = pkgs.callPackage ./default.nix { };
        };

        apps.default = {
          type = "app";
          program = "${self'.packages.default}/bin/zeno-preview";
        };
      };

      flake = {
        nixosModules.default = import ./infra/nix/zeno-module.nix;
        darwinModules.default = import ./infra/nix/zeno-module.nix;
      };
    };
}
