# Node.js Version Compatibility

## Minimum Requirements

This server application supports **Node.js 10.0.0 and above**.

## UUID Generation

### Using uuid Library Instead of crypto.randomUUID()

The `crypto.randomUUID()` function was added in Node.js v14.17.0, which causes compatibility issues on older Node.js versions. To ensure maximum compatibility, we use the `uuid` library instead.

**Implementation:**
- Location: `src/utils/crypto-polyfill.js`
- Uses: `uuid` package (v4 - random UUID generation)
- Compatible with: All Node.js versions 10+

**Usage:**
```javascript
const { randomUUID } = require('./utils/crypto-polyfill');

const uuid = randomUUID();
console.log(uuid); // e.g., "550e8400-e29b-41d4-a716-446655440000"
```

This generates RFC 4122 compliant UUID v4 strings that work across all Node.js versions.

## Checking Your Node.js Version

On your VPS, run:
```bash
node --version
```

## Upgrading Node.js (Recommended)

For better performance, security, and modern features, consider upgrading to Node.js LTS (v18 or v20):

**Using nvm:**
```bash
nvm install 20
nvm use 20
```

**Using package manager:**
```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# CentOS/RHEL
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs
```
