function generateUID() {
  const base = '1.3.6.1.4.1.16568';
  const now = Date.now();
  const rand = Math.floor(Math.random() * 1e9);
  return `${base}.${now}.${rand}`;
}

module.exports = { generateUID };