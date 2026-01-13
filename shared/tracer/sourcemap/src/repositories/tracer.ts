import { uploadSourceMap } from '@apptracer/sourcemap';
import type {
  TracerSourceMapRepository,
  TracerUploadSourceMapConfiguration,
} from '../entities/repositories';

export class TracerSourceMap implements TracerSourceMapRepository {
  public async uploadSourcemap(
    path: string,
    { pluginToken, ...sourcemapUploadOptions }: TracerUploadSourceMapConfiguration,
  ): Promise<void> {
    return new Promise((onSuccess, onError) => {
      uploadSourceMap(path, {
        sourcemapToken: pluginToken,
        ...sourcemapUploadOptions,
        onSuccess,
        onError,
      });
    });
  }
}
