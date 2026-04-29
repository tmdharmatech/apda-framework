import { readBody } from "../lib/http.js";
import { validateArtifact, validateArtifactFile } from "../schema/validate.js";

export async function handleValidate(root, req, res) {
  if (req.method === "POST") {
    const body = await readBody(req);
    if (body.artifact) {
      const result = await validateArtifact(root, body.artifact);
      res.json(result);
      return;
    }
    if (body.file) {
      const result = await validateArtifactFile(root, body.file);
      res.json(result);
      return;
    }
    res.status(400).json({ error: "Forneça artifact (objeto) ou file (caminho)." });
    return;
  }
  res.status(405).json({ error: "Metodo nao permitido." });
}
