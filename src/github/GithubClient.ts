import artifactClient, { UploadArtifactOptions } from "@actions/artifact";
import * as core from "@actions/core";
import * as github from "@actions/github";
import { GitHub } from "@actions/github/lib/utils";
import * as cache from "@actions/tool-cache";
import { Release } from "@octokit/webhooks-types";
import fs from "fs";
import os from "os";
import path from "path";
import { stringify } from "./Util";

export type GithubRepo = { owner: string; repo: string };

export interface ReleaseAsset {
  id: number;
  name: string;
}

interface ReleaseProps {
  release: Release;
}

export interface Artifact {
  id?: number;
  name: string;
}

export interface WorkflowRun {
  id: number;
}

/**
 * Wraps a string in dashes to 80 chars width, used as a log section header.
 */
export function dashWrap(str: string): string {
  let out = ` ${str} `;
  const width = 80;
  while (out.length < width) {
    out = `-${out}-`;
  }
  if (out.length > width) {
    out = out.substring(0, width);
  }
  return out;
}

/**
 * Logs multiple values under a labelled debug group when debug mode is active.
 */
export function debugLog(label: string, ...args: unknown[]): void {
  if (core.isDebug()) {
    core.group(label, async () => {
      for (const arg of args) {
        if (typeof arg === "string") {
          core.debug(arg);
        } else if (arg instanceof Error) {
          core.debug(arg.message);
          core.debug(stringify(arg.stack));
        } else {
          core.debug(stringify(arg));
        }
      }
    });
  }
}

/**
 * Returns a configured Octokit client.
 */
export function getClient(repo: GithubRepo, token: string): GithubClient {
  const octokit = github.getOctokit(token);
  return new GithubClient(octokit, repo);
}

/**
 * Thin wrapper around the GitHub REST API for operations needed by this action.
 */
export class GithubClient {
  private octokit: InstanceType<typeof GitHub>;
  private repo: GithubRepo;

  constructor(octokit: InstanceType<typeof GitHub>, repo: GithubRepo) {
    this.octokit = octokit;
    this.repo = repo;
  }

  // ─── Artifacts ────────────────────────────────────────────────────────────

  async uploadWorkflowArtifact({
    files,
    rootDir,
    name,
    retention,
  }: {
    files: string[];
    rootDir: string;
    name: string;
    retention: number;
  }): Promise<void> {
    const options: UploadArtifactOptions = {};
    if (retention > 0) {
      options.retentionDays = retention;
    }
    await artifactClient.uploadArtifact(name, files, rootDir, options);
  }

  async listCurrentWorkflowArtifacts(): Promise<Artifact[]> {
    const { runId } = github.context;
    return this.listWorkflowRunArtifacts({ runId });
  }

  async listWorkflowRunArtifacts({ runId }: { runId: number }): Promise<Artifact[]> {
    const { owner, repo } = this.repo;
    const res = await this.octokit.rest.actions.listWorkflowRunArtifacts({
      owner,
      repo,
      run_id: runId,
    });
    return res.data.artifacts.map((a) => ({ id: a.id, name: a.name }));
  }

  async downloadWorkflowRunArtifact({ artifactId }: { artifactId: number }): Promise<string> {
    const { owner, repo } = this.repo;
    const res = await this.octokit.rest.actions.downloadArtifact({
      owner,
      repo,
      artifact_id: artifactId,
      archive_format: "zip",
    });
    const url = (res as { url?: string }).url as string;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aibomgen-artifact-"));
    const zipPath = await cache.downloadTool(url);
    await cache.extractZip(zipPath, tmpDir);
    return tmpDir;
  }

  async downloadWorkflowArtifact(artifact: Artifact): Promise<string> {
    if (artifact.id === undefined) {
      throw new Error("Artifact has no id");
    }
    return this.downloadWorkflowRunArtifact({ artifactId: artifact.id });
  }

  // ─── Releases ──────────────────────────────────────────────────────────────

  async findRelease({ tag }: { tag: string }): Promise<Release | undefined> {
    const { owner, repo } = this.repo;
    try {
      const res = await this.octokit.rest.repos.getReleaseByTag({ owner, repo, tag });
      return res.data as unknown as Release;
    } catch {
      return undefined;
    }
  }

  async listReleaseAssets({ release }: ReleaseProps): Promise<ReleaseAsset[]> {
    const { owner, repo } = this.repo;
    const res = await this.octokit.rest.repos.listReleaseAssets({
      owner,
      repo,
      release_id: release.id,
    });
    return res.data.map((a) => ({ id: a.id, name: a.name }));
  }

  async deleteReleaseAsset({ asset }: { release: Release; asset: ReleaseAsset }): Promise<void> {
    const { owner, repo } = this.repo;
    await this.octokit.rest.repos.deleteReleaseAsset({
      owner,
      repo,
      asset_id: asset.id,
    });
  }

  async uploadReleaseAsset({
    release,
    assetName,
    contents,
    contentType,
  }: {
    release: Release;
    assetName: string;
    contents: string;
    contentType: string;
  }): Promise<void> {
    const { owner, repo } = this.repo;
    await this.octokit.rest.repos.uploadReleaseAsset({
      owner,
      repo,
      release_id: release.id,
      name: assetName,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: contents as any,
      headers: { "content-type": contentType },
    });
  }

  // ─── Workflows ─────────────────────────────────────────────────────────────

  async findLatestWorkflowRunForBranch({
    branch,
  }: {
    branch: string;
  }): Promise<WorkflowRun | undefined> {
    const { owner, repo } = this.repo;
    const { workflow_id } = github.context as unknown as { workflow_id: string };
    try {
      const res = await this.octokit.rest.actions.listWorkflowRuns({
        owner,
        repo,
        workflow_id,
        branch,
        per_page: 1,
        status: "completed",
      });
      return res.data.workflow_runs[0];
    } catch {
      return undefined;
    }
  }
}
