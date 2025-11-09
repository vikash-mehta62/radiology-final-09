const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class CryptoService {
  constructor() {
    this.algorithm = 'RSA-SHA256';
    this.keySize = 2048;
    this.privateKey = null;
    this.publicKey = null;
    this.keyVersion = null;
    this.archivedKeys = new Map(); // version -> publicKey

    this.loadKeys();
  }

  loadKeys() {
    try {
      const keysDir = process.env.SIGNATURE_KEYS_PATH || path.join(__dirname, '../../keys');
      const privateKeyPath = path.join(keysDir, 'signature-private.pem');
      const publicKeyPath = path.join(keysDir, 'signature-public.pem');
      const versionFile = path.join(keysDir, 'key-version.txt');

      if (!fs.existsSync(keysDir)) {
        fs.mkdirSync(keysDir, { recursive: true, mode: 0o700 });
      }

      if (!fs.existsSync(privateKeyPath) || !fs.existsSync(publicKeyPath)) {
        this.generateKeyPair(keysDir);
      }

      this.privateKey = fs.readFileSync(privateKeyPath, 'utf8');
      this.publicKey = fs.readFileSync(publicKeyPath, 'utf8');

      if (fs.existsSync(versionFile)) {
        this.keyVersion = fs.readFileSync(versionFile, 'utf8').trim();
      } else {
        this.keyVersion = 'v1';
        fs.writeFileSync(versionFile, this.keyVersion, { mode: 0o600 });
      }

      this.loadArchivedKeys(keysDir);
    } catch (err) {
      console.error('Error loading cryptographic keys:', err);
      throw new Error('Failed to load cryptographic keys');
    }
  }

  loadArchivedKeys(keysDir) {
    try {
      const archiveDir = path.join(keysDir, 'archive');
      if (!fs.existsSync(archiveDir)) return;

      const files = fs.readdirSync(archiveDir);
      for (const file of files) {
        if (file.startsWith('signature-public-') && file.endsWith('.pem')) {
          const version = file.replace('signature-public-', '').replace('.pem', '');
          const keyPath = path.join(archiveDir, file);
          const publicKey = fs.readFileSync(keyPath, 'utf8');
          this.archivedKeys.set(version, publicKey);
        }
      }
    } catch (err) {
      console.warn('Error loading archived keys:', err.message);
    }
  }

  generateKeyPair(keysDir) {
    try {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: this.keySize,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem',
          cipher: 'aes-256-cbc',
          passphrase: process.env.SIGNATURE_KEY_PASSPHRASE || 'default_passphrase_change_in_production'
        }
      });

      const privateKeyPath = path.join(keysDir, 'signature-private.pem');
      const publicKeyPath = path.join(keysDir, 'signature-public.pem');
      fs.writeFileSync(privateKeyPath, privateKey, { mode: 0o600 });
      fs.writeFileSync(publicKeyPath, publicKey, { mode: 0o644 });

      this.privateKey = privateKey;
      this.publicKey = publicKey;
    } catch (err) {
      console.error('Error generating key pair:', err);
      throw new Error('Failed to generate key pair');
    }
  }

  generateSignature(data) {
    if (!this.privateKey) throw new Error('Private key not loaded');
    if (!data || typeof data !== 'string') throw new Error('Invalid data for signing');

    const sign = crypto.createSign(this.algorithm);
    sign.update(data);
    sign.end();

    return sign.sign({
      key: this.privateKey,
      passphrase: process.env.SIGNATURE_KEY_PASSPHRASE || 'default_passphrase_change_in_production'
    }, 'base64');
  }

  getKeyVersion() {
    return this.keyVersion;
  }

  verifySignature(data, signature, keyVersion = null) {
    try {
      if (!data || typeof data !== 'string') return false;
      if (!signature || typeof signature !== 'string') return false;

      let publicKey = this.publicKey;
      if (keyVersion && keyVersion !== this.keyVersion) {
        // prefer archived key by version, if exists
        publicKey = this.archivedKeys.get(String(keyVersion)) || this.publicKey;
      }

      const verify = crypto.createVerify(this.algorithm);
      verify.update(data);
      verify.end();
      return verify.verify(publicKey, signature, 'base64');
    } catch (err) {
      console.error('Error verifying signature:', err);
      return false;
    }
  }

  hashData(data) {
    if (!data || typeof data !== 'string') throw new Error('Invalid data for hashing');
    const hash = crypto.createHash('sha256');
    hash.update(data);
    return hash.digest('hex');
  }

  encryptData(data, key = null) {
    try {
      const encryptionKey = key || crypto.scryptSync(
        process.env.ENCRYPTION_KEY || 'default_encryption_key_change_in_production',
        'salt',
        32
      );
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', encryptionKey, iv);
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return { encrypted, iv: iv.toString('hex'), algorithm: 'aes-256-cbc' };
    } catch (err) {
      console.error('Error encrypting data:', err);
      throw new Error('Failed to encrypt data');
    }
  }

  decryptData(encryptedData, ivHex, key = null) {
    try {
      const decryptionKey = key || crypto.scryptSync(
        process.env.ENCRYPTION_KEY || 'default_encryption_key_change_in_production',
        'salt',
        32
      );
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', decryptionKey, iv);
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (err) {
      console.error('Error decrypting data:', err);
      throw new Error('Failed to decrypt data');
    }
  }

  generateRandomToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  getPublicKey() {
    return this.publicKey;
  }

  rotateKeys(reason = 'Scheduled rotation') {
    try {
      const keysDir = process.env.SIGNATURE_KEYS_PATH || path.join(__dirname, '../../keys');
      const archiveDir = path.join(keysDir, 'archive');
      const rotationLogPath = path.join(keysDir, 'rotation-log.json');
      if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true, mode: 0o700 });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const oldVersion = this.keyVersion || 'v1';

      const privateKeyPath = path.join(keysDir, 'signature-private.pem');
      const publicKeyPath = path.join(keysDir, 'signature-public.pem');

      if (fs.existsSync(privateKeyPath)) {
        fs.renameSync(privateKeyPath, path.join(archiveDir, `signature-private-${oldVersion}.pem`));
      }
      if (fs.existsSync(publicKeyPath)) {
        fs.renameSync(publicKeyPath, path.join(archiveDir, `signature-public-${oldVersion}.pem`));
      }

      const versionNum = parseInt(String(oldVersion).replace('v', '')) || 1;
      const newVersion = `v${versionNum + 1}`;

      this.generateKeyPair(keysDir);
      this.keyVersion = newVersion;
      const versionFile = path.join(keysDir, 'key-version.txt');
      fs.writeFileSync(versionFile, newVersion, { mode: 0o600 });

      // refresh archived key map
      this.loadArchivedKeys(keysDir);

      const entry = {
        timestamp: new Date().toISOString(),
        oldVersion,
        newVersion,
        reason,
        performedBy: process.env.USER || 'system'
      };
      let history = [];
      if (fs.existsSync(rotationLogPath)) {
        history = JSON.parse(fs.readFileSync(rotationLogPath, 'utf8'));
      }
      history.push(entry);
      fs.writeFileSync(rotationLogPath, JSON.stringify(history, null, 2), { mode: 0o600 });

      return { success: true, oldVersion, newVersion, timestamp: entry.timestamp };
    } catch (err) {
      console.error('Error rotating keys:', err);
      throw new Error('Failed to rotate keys');
    }
  }

  getRotationHistory() {
    try {
      const keysDir = process.env.SIGNATURE_KEYS_PATH || path.join(__dirname, '../../keys');
      const rotationLogPath = path.join(keysDir, 'rotation-log.json');
      if (fs.existsSync(rotationLogPath)) {
        return JSON.parse(fs.readFileSync(rotationLogPath, 'utf8'));
      }
      return [];
    } catch (err) {
      console.error('Error reading rotation history:', err);
      return [];
    }
  }

  getKeyInfo() {
    return {
      currentVersion: this.keyVersion,
      algorithm: this.algorithm,
      keySize: this.keySize,
      archivedVersions: Array.from(this.archivedKeys.keys()),
      rotationHistory: this.getRotationHistory()
    };
  }
}

module.exports = new CryptoService();

