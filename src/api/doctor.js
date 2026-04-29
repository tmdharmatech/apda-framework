import { buildDoctorReport } from "../doctor.js";

export async function handleDoctor(root, _req, res) {
  const report = await buildDoctorReport(root);
  res.json(report);
}
