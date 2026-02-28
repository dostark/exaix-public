/**
 * @module ConfigReloadHandler
 * @path src/config/config_reload_handler.ts
 * @description Provides a factory for creating file watcher events that trigger configuration reloads when exo.config.toml changes.
 * @architectural-layer Config
 * @dependencies [config_service]
 * @related-files [src/config/service.ts, src/services/daemon.ts]
 */

import type { ConfigService } from "./service.ts";
import { LogMetadata } from "../shared/types/json.ts";

export type ConfigReloadLogger = {
  info: (
    action: string,
    target: string,
    payload: LogMetadata,
  ) => Promise<void> | void;
};

export type FileWatcherEvent = {
  path: string;
};

export function createConfigReloadHandler(
  configService: ConfigService,
  logger: ConfigReloadLogger,
): (event: FileWatcherEvent) => Promise<void> {
  return async (event: FileWatcherEvent) => {
    if (!event.path.endsWith("exo.config.toml")) {
      return;
    }

    const oldChecksum = configService.getChecksum();
    const newConfig = configService.reload();
    const newChecksum = configService.getChecksum();

    if (oldChecksum !== newChecksum) {
      await logger.info("config.updated", "exo.config.toml", {
        old_checksum: oldChecksum.slice(0, 8),
        new_checksum: newChecksum.slice(0, 8),
        portals_count: newConfig.portals?.length || 0,
      });
    }
  };
}
