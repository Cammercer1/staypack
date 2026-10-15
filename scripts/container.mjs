import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function containerSettings(checkout, commonDirectory, requestedPort) {
  const primary = path.resolve(commonDirectory) === path.join(checkout, ".git");
  const port = requestedPort || (primary ? "3000" : "");
  if (!/^\d+$/.test(port) || Number(port) < 1024 || Number(port) > 65535) {
    throw new Error("Set STAYPACK_DEV_PORT to an unused port between 1024 and 65535 for this worktree (for example 3101).");
  }
  if (!primary && Number(port) === 3000) {
    throw new Error("Port 3000 is reserved for the primary checkout. Choose another STAYPACK_DEV_PORT for this worktree.");
  }
  return {
    port: String(Number(port)),
    project: primary ? "staypacks" : `staypacks-${createHash("sha256").update(checkout).digest("hex").slice(0, 12)}`,
  };
}

export function assertContainerSource(checkout, containers) {
  for (const container of containers) {
    const source = container.Mounts?.find((mount) => mount.Destination === "/workspace")?.Source;
    if (source !== checkout) {
      throw new Error(`Docker project belongs to ${source || "an unknown source"}, not ${checkout}. Stop that project's container from its own checkout before continuing.`);
    }
  }
}

function run() {
  const checkout = realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
  const git = (...args) => execFileSync("git", args, { cwd: checkout, encoding: "utf8" }).trim();
  const commonDirectory = git("rev-parse", "--path-format=absolute", "--git-common-dir");
  const { port, project } = containerSettings(checkout, commonDirectory, process.env.STAYPACK_DEV_PORT);
  const env = { ...process.env, COMPOSE_PROJECT_NAME: project, STAYPACK_DEV_PORT: port };
  const docker = (...args) => execFileSync("docker", args, { cwd: checkout, env, encoding: "utf8" }).trim();
  // Inspect stopped containers too: `up` could otherwise replace a different checkout.
  const ids = docker("ps", "-aq", "--filter", `label=com.docker.compose.project=${project}`, "--filter", "label=com.docker.compose.service=app").split(/\s+/).filter(Boolean);
  const containers = ids.length ? JSON.parse(docker("inspect", ...ids)) : [];
  assertContainerSource(checkout, containers);
  const branch = git("branch", "--show-current") || "detached HEAD";
  const dirty = git("status", "--porcelain") ? " (uncommitted changes)" : "";
  console.log(`StayPacks: ${checkout}\nGit: ${branch} ${git("rev-parse", "--short", "HEAD")}${dirty}\nDocker: ${project} · configured URL http://localhost:${port}`);
  const [command = "status", ...args] = process.argv.slice(2);
  if (command === "status") {
    console.log(containers.length ? containers.map((container) => {
      const ports = container.NetworkSettings?.Ports?.["3000/tcp"] ?? [];
      const urls = ports.map((binding) => `http://localhost:${binding.HostPort}`).join(", ");
      return `${container.Name}: ${container.State.Status}${urls ? ` · listening at ${urls}` : ""}`;
    }).join("\n") : "Container is not created.");
    return;
  }
  // Pin the file as well as the project: an inherited COMPOSE_FILE or an old
  // compose.override.yaml must not redirect the validated container elsewhere.
  const result = spawnSync("docker", ["compose", "--file", path.join(checkout, "compose.yaml"), "--project-directory", checkout, "--project-name", project, command, ...args], { cwd: checkout, env, stdio: "inherit" });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    run();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
