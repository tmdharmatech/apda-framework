export function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("JSON inválido no corpo da requisição."));
      }
    });
    req.on("error", reject);
  });
}

export function respond(res) {
  return {
    json(data, status = 200) {
      const body = JSON.stringify(data);
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(body),
      });
      res.end(body);
    },
    status(code) {
      return {
        json: (data) => respond(res).json(data, code),
      };
    },
    setHeader: res.setHeader.bind(res),
    flushHeaders: res.flushHeaders.bind(res),
    write: res.write.bind(res),
    end: res.end.bind(res),
  };
}
