export interface GitHubInput extends TracerUploadSourceMapConfiguration {
  path: string;
}

export interface GitHubRepository {
  getInput(): Promise<GitHubInput>;
}

export interface TracerUploadSourceMapConfiguration {
  /** pluginToken from Tracer settings */
  pluginToken: string;
  /** Displayed version name */
  versionName: string;
  /** Version code {number} */
  versionCode: number;
  /** Build identifier */
  buildUuid?: string;
  /** Host url where to upload sourcemaps. Default is Tracer's api host */
  apiHost?: string;
}

export interface TracerSourceMapRepository {
  uploadSourcemap(filePath: string, config: TracerUploadSourceMapConfiguration): Promise<void>;
}

export interface Repositories {
  githubRepository: GitHubRepository;
  tracerSourceMapRepository: TracerSourceMapRepository;
}
