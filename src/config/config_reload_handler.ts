import type { ConfigService } from "./service.ts";

export type ConfigReloadLogger = {
  info: (
    action: string,
    target: string,
    payload: Record<string, unknown>,
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
