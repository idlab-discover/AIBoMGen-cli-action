import * as core from "@actions/core";
import {
  attachReleaseAssets,
  getAIBoMGenCommand,
  runAIBoMGenAction,
  runAndFailBuildOnException,
} from "./github/AIBoMGenGithubAction";

const run = core.getInput("run") || "scan";

runAndFailBuildOnException(async () => {
  switch (run) {
    case "scan":
      await runAIBoMGenAction();
      await attachReleaseAssets();
      break;
    case "download-aibomgen": {
      const cmd = await getAIBoMGenCommand();
      core.setOutput("cmd", cmd);
      break;
    }
    default:
      core.setFailed(`Unknown run value: ${run}`);
  }
});
