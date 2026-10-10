{ config, lib, pkgs, ... }:

with lib;

let
  cfg = config.peterlodri.services.zeno;
in
{
  options.peterlodri.services.zeno = {
    enable = mkEnableOption "Zeno Japanese Proof-of-Contribution Sovereign Neo-Bank Service";

    port = mkOption {
      type = types.port;
      default = 8089;
      description = "Port on which the Zeno edge banking daemon listens.";
    };

    domain = mkOption {
      type = types.str;
      default = "zeno.vaked.dev";
      description = "Canonical domain for Zeno web surface and API.";
    };

    stateDir = mkOption {
      type = types.path;
      default = "/var/lib/zeno";
      description = "State directory for Kintsugi immutable ledger storage.";
    };

    tokenRateJpy = mkOption {
      type = types.int;
      default = 100;
      description = "Exchange rate of 1 FOKEN to JPY equivalent.";
    };
  };

  config = mkIf cfg.enable {
    systemd.tmpfiles.rules = [
      "d '${cfg.stateDir}' 0750 zeno zeno - -"
    ];

    users.users.zeno = {
      isSystemUser = true;
      group = "zeno";
      description = "Zeno Neo-Bank daemon user";
      home = cfg.stateDir;
    };
    users.groups.zeno = {};

    systemd.services.zeno = {
      description = "ZENO Neo-Bank Core Ledger & Gateway";
      after = [ "network.target" ];
      wantedBy = [ "multi-user.target" ];

      environment = {
        ZENO_PORT = toString cfg.port;
        ZENO_STATE_DIR = cfg.stateDir;
        ZENO_TOKEN_RATE_JPY = toString cfg.tokenRateJpy;
      };

      serviceConfig = {
        Type = "simple";
        User = "zeno";
        Group = "zeno";
        WorkingDirectory = cfg.stateDir;
        ExecStart = "${pkgs.python311}/bin/python3 -m http.server ${toString cfg.port}";
        Restart = "always";
        RestartSec = "5s";

        # Fleet sandboxing & hardening
        ProtectSystem = "strict";
        ProtectHome = true;
        PrivateTmp = true;
        PrivateDevices = true;
        ProtectKernelTunables = true;
        ProtectKernelModules = true;
        ProtectControlGroups = true;
        RestrictAddressFamilies = [ "AF_INET" "AF_INET6" "AF_UNIX" ];
        RestrictNamespaces = true;
        LockPersonality = true;
        MemoryDenyWriteExecute = true;
        ReadWritePaths = [ cfg.stateDir ];
      };
    };
  };
}
